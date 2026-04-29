"""
tomato_grading_api/views.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Views — Grading + Pricing Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Endpoints:

  PIPELINE (primary)
    POST /api/v1/grade-and-price/       GradeAndPriceView
         Upload image + 4 context inputs.
         Returns grade + price in a single atomic call.
         Saves both GradingSession and PricingSession.

  HISTORY
    GET  /api/v1/history/grading/       GradingHistoryListView
    GET  /api/v1/history/grading/<uuid> GradingHistoryDetailView
    GET  /api/v1/history/pricing/       PricingHistoryListView
    GET  /api/v1/history/pricing/<uuid> PricingHistoryDetailView
    DELETE /api/v1/history/<uuid>       (grading session + cascades to pricing)

  FEEDBACK
    POST /api/v1/feedback/grading/      GradingFeedbackView
    POST /api/v1/feedback/pricing/      PricingFeedbackView

  SUPPORTING
    GET  /api/v1/market-data/           MarketDataView  (dropdowns)
    GET  /api/v1/analytics/             AnalyticsView
    GET  /api/v1/health/                HealthCheckView (public)

  AUTH
    POST /api/v1/auth/register/         RegisterView
    POST /api/v1/auth/login/            simplejwt TokenObtainPairView
    POST /api/v1/auth/refresh/          simplejwt TokenRefreshView
    POST /api/v1/auth/logout/           LogoutView
    GET  /api/v1/auth/me/               UserProfileView
"""
import threading 
import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    GradingSession,
    PricingSession,
    GradingFeedback,
    PricingFeedback,
    Product,
    ProductImage,
    UserProfile,
    FarmerProfile,
    ProductCategory,
)

from .serializers import (
    ImageUploadSerializer,
    GradingSessionSerializer,
    PricingSessionSerializer, PricingSessionDetailSerializer,
    GradingFeedbackSerializer, PricingFeedbackSerializer,
    AnalyticsSerializer, MarketDataSerializer, HealthCheckSerializer,
    UserRegistrationSerializer,
    GradeOnlySerializer,
    PriceFromGradeSerializer,
    ProductSerializer,
    ProductCreateSerializer,
    FarmerProfileListSerializer,
    CountySerializer,
    ProductCategorySerializer,
    FarmerProfileSerializer,
)
from ml_engine.feature_imputer import FeatureImputer

logger = logging.getLogger("tomato_grading_api")


def _get_client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ─────────────────────────────────────────────────────────────────────────────
# PRIMARY PIPELINE ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

class GradeAndPriceView(APIView):
    """
    POST /api/v1/grade-and-price/

    The single endpoint that drives the full mobile workflow:
      1. User photographs tomato → image uploaded here.
      2. Grading model classifies the image (Grade A/B/C/Reject).
      3. FeatureImputer resolves all 13 missing pricing features
         from the grade + 4 user context inputs.
      4. Pricing model predicts the market price.
      5. Both sessions are saved to the database.
      6. A single unified JSON response is returned.

    Request (multipart/form-data):
      image           : <image file>       REQUIRED
      market_location : "Harare Market"    REQUIRED
      month           : "July"             REQUIRED
      market_type     : "Retail"           REQUIRED
      farm_lat        : -17.8252           OPTIONAL (GPS auto-fill)
      farm_lon        : 31.0335            OPTIONAL (GPS auto-fill)

    Response (200):
      {
        grading_session_id: uuid,
        pricing_session_id: uuid,
        grading: { grade, grade_code, confidence, confidence_level,
                   description, marketable, color_hint, all_probabilities,
                   inference_time_ms, model_version, manual_review },
        pricing: { predicted_price_usd_per_kg, price_range_low,
                   price_range_high, currency, model_version, grade_label,
                   inference_time_ms },
        user_inputs:      { market_location, month, market_type, farm_lat, farm_lon },
        imputed_features: { ...all 18 features... },
        resolution_log:   { ...per-feature source tags... },
        warnings:         [ ...any imputation warnings... ],
        total_pipeline_time_ms: float,
        created_at: iso8601,
      }
    """

    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = "grade"

    def post(self, request) -> Response:
        # ── Validate input ────────────────────────────────────────────────────
        ser = ImageUploadSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"error": "validation_error", "details": ser.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = ser.validated_data

        # ── Run inference pipeline ────────────────────────────────────────────
        try:
            from ml_engine.inference_pipeline import InferencePipeline
            pipeline = InferencePipeline.get_instance()

            result = pipeline.run(
                image_bytes     = data["image"].read(),
                market_location = data["market_location"],
                month           = data["month"],
                market_type     = data["market_type"],
                farm_lat        = data.get("farm_lat"),
                farm_lon        = data.get("farm_lon"),
            )
        except Exception as exc:
            logger.exception("Pipeline failed for user %s: %s", request.user.id, exc)
            return Response(
                {"error": "pipeline_failed", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        grading = result["grading"]
        pricing = result["pricing"]

        # ── Persist GradingSession ────────────────────────────────────────────
        data["image"].seek(0)   # reset after pipeline read
        grading_session = GradingSession.objects.create(
            user              = request.user,
            image             = data["image"],
            predicted_grade   = grading["grade"],
            grade_code        = grading["grade_code"],
            confidence        = grading["confidence"],
            confidence_level  = grading["confidence_level"],
            all_probabilities = grading["all_probabilities"],
            inference_time_ms = grading["inference_time_ms"],
            model_version     = grading["model_version"],
            manual_review     = grading["manual_review"],
            marketable        = grading["marketable"],
            ip_address        = _get_client_ip(request),
            user_agent        = request.META.get("HTTP_USER_AGENT", "")[:500],
        )

        # ── Persist PricingSession ────────────────────────────────────────────
        pricing_session = PricingSession.objects.create(
            user                   = request.user,
            grading_session        = grading_session,
            market_location        = data["market_location"],
            month                  = data["month"],
            market_type            = data["market_type"],
            farm_lat               = data.get("farm_lat"),
            farm_lon               = data.get("farm_lon"),
            imputed_features       = result["features"],
            resolution_log         = result["resolution_log"],
            imputation_warnings    = result["warnings"],
            predicted_price        = pricing["predicted_price_usd_per_kg"],
            price_range_low        = pricing["price_range_low"],
            price_range_high       = pricing["price_range_high"],
            currency               = pricing["currency"],
            pricing_model_version  = pricing["model_version"],
            inference_time_ms      = pricing["inference_time_ms"],
            total_pipeline_time_ms = result["total_inference_time_ms"],
            ip_address             = _get_client_ip(request),
        )

        logger.info(
            "Pipeline complete: user=%s grade=%s confidence=%.1f%% "
            "price=%.2f [%.2f–%.2f] ms=%.1f",
            request.user.id,
            grading["grade_code"],
            grading["confidence"],
            pricing["predicted_price_usd_per_kg"],
            pricing["price_range_low"],
            pricing["price_range_high"],
            result["total_inference_time_ms"],
        )

        # ── Build response ────────────────────────────────────────────────────
        return Response({
            "grading_session_id": str(grading_session.id),
            "pricing_session_id": str(pricing_session.id),
            "grading":  grading,
            "pricing":  pricing,
            "user_inputs": {
                "market_location": data["market_location"],
                "month":           data["month"],
                "market_type":     data["market_type"],
                "farm_lat":        data.get("farm_lat"),
                "farm_lon":        data.get("farm_lon"),
            },
            "imputed_features": result["features"],
            "resolution_log":   result["resolution_log"],
            "warnings":         result["warnings"],
            "total_pipeline_time_ms": result["total_inference_time_ms"],
            "created_at": grading_session.created_at.isoformat(),
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
# ML TESTING (GRADE FIRST → OPTIONAL PRICING)
# ─────────────────────────────────────────────────────────────────────────────

class GradeOnlyView(APIView):
    """POST /api/v1/ml/grade/ — upload image and get grade only."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "grade"

    def post(self, request) -> Response:
        ser = GradeOnlySerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"error": "validation_error", "details": ser.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image = ser.validated_data["image"]

        try:
            from ml_engine.predictor import TomatoGrader
            grading = TomatoGrader.get_instance().predict_from_bytes(image.read())
        except Exception as exc:
            logger.exception("Grading failed for user %s: %s", request.user.id, exc)
            return Response(
                {"error": "grading_failed", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        image.seek(0)
        grading_session = GradingSession.objects.create(
            user=request.user,
            image=image,
            predicted_grade=grading.get("grade"),
            grade_code=grading.get("grade_code"),
            confidence=grading.get("confidence", 0.0),
            confidence_level=grading.get("confidence_level"),
            all_probabilities=grading.get("all_probabilities", {}),
            inference_time_ms=grading.get("inference_time_ms", 0.0),
            model_version=grading.get("model_version", "1.0.0"),
            manual_review=grading.get("manual_review", False),
            marketable=grading.get("marketable", True),
            ip_address=_get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )

        return Response(
            {
                "grading_session_id": str(grading_session.id),
                "grading": grading,
                "created_at": grading_session.created_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class PriceFromGradeView(APIView):
    """POST /api/v1/ml/price/ — compute price from an existing grading_session_id."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "price"

    def post(self, request) -> Response:
        ser = PriceFromGradeSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"error": "validation_error", "details": ser.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = ser.validated_data
        grading_session_id = data["grading_session_id"]

        try:
            grading_session = GradingSession.objects.get(
                id=grading_session_id,
                user=request.user,
            )
        except GradingSession.DoesNotExist:
            return Response(
                {"error": "not_found", "message": "Grading session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if hasattr(grading_session, "pricing_session"):
            existing = grading_session.pricing_session
            # Return the existing pricing result to keep the endpoint idempotent.
            return Response(
                {
                    "grading_session_id": str(grading_session.id),
                    "pricing_session_id": str(existing.id),
                    "grading": {
                        "grade": grading_session.predicted_grade,
                        "grade_code": grading_session.grade_code,
                        "confidence": grading_session.confidence,
                        "confidence_level": grading_session.confidence_level,
                    },
                    "pricing": {
                        "predicted_price_usd_per_kg": existing.predicted_price,
                        "price_range_low": existing.price_range_low,
                        "price_range_high": existing.price_range_high,
                        "currency": existing.currency,
                        "model_version": existing.pricing_model_version,
                    },
                    "user_inputs": {
                        "market_location": existing.market_location,
                        "month": existing.month,
                        "market_type": existing.market_type,
                        "farm_lat": existing.farm_lat,
                        "farm_lon": existing.farm_lon,
                    },
                    "created_at": existing.created_at.isoformat(),
                },
                status=status.HTTP_200_OK,
            )

        try:
            from ml_engine.feature_imputer import FeatureImputer
            from ml_engine.pricing_predictor import TomatoPricingPredictor

            imputed = FeatureImputer.impute(
                tomato_grade=grading_session.grade_code,
                market_location=data["market_location"],
                month=data["month"],
                market_type=data["market_type"],
                farm_lat=data.get("farm_lat"),
                farm_lon=data.get("farm_lon"),
            )

            pricing = TomatoPricingPredictor.get_instance().predict(imputed.features)
        except Exception as exc:
            logger.exception("Pricing failed for user %s: %s", request.user.id, exc)
            return Response(
                {"error": "pricing_failed", "message": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        pricing_session = PricingSession.objects.create(
            user=request.user,
            grading_session=grading_session,
            market_location=data["market_location"],
            month=data["month"],
            market_type=data["market_type"],
            farm_lat=data.get("farm_lat"),
            farm_lon=data.get("farm_lon"),
            imputed_features=imputed.features,
            resolution_log=imputed.resolution_log,
            imputation_warnings=imputed.warnings,
            predicted_price=pricing["predicted_price_usd_per_kg"],
            price_range_low=pricing["price_range_low"],
            price_range_high=pricing["price_range_high"],
            currency=pricing["currency"],
            pricing_model_version=pricing.get("model_version", "1.0.0"),
            inference_time_ms=pricing.get("inference_time_ms", 0.0),
            total_pipeline_time_ms=pricing.get("inference_time_ms", 0.0),
            ip_address=_get_client_ip(request),
        )

        return Response(
            {
                "grading_session_id": str(grading_session.id),
                "pricing_session_id": str(pricing_session.id),
                "grading": {
                    "grade": grading_session.predicted_grade,
                    "grade_code": grading_session.grade_code,
                    "confidence": grading_session.confidence,
                    "confidence_level": grading_session.confidence_level,
                },
                "pricing": pricing,
                "user_inputs": {
                    "market_location": data["market_location"],
                    "month": data["month"],
                    "market_type": data["market_type"],
                    "farm_lat": data.get("farm_lat"),
                    "farm_lon": data.get("farm_lon"),
                },
                "imputed_features": imputed.features,
                "resolution_log": imputed.resolution_log,
                "warnings": imputed.warnings,
                "created_at": pricing_session.created_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
# MARKET DATA VIEW (for frontend dropdowns)
# ─────────────────────────────────────────────────────────────────────────────

class MarketDataView(APIView):
    """
    GET /api/v1/market-data/

    Returns all dropdown options the React Native form needs.
    Cached — no DB query required.  Public (no auth needed for dropdowns).
    """
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        return Response({
            "markets":      FeatureImputer.get_market_list(),
            "months":       FeatureImputer.get_months(),
            "market_types": ["Retail", "Wholesale", "Farm Gate"],
        })


# ─────────────────────────────────────────────────────────────────────────────
# MARKETPLACE (PRODUCT LISTINGS)
# ─────────────────────────────────────────────────────────────────────────────

class ProductListCreateView(APIView):
    """GET /api/v1/products/ (public) and POST /api/v1/products/ (farmer-only)."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request) -> Response:
        qs = Product.objects.filter(is_active=True).select_related("farmer").prefetch_related("images")

        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(description__icontains=q)
                | Q(county__icontains=q)
                | Q(category__icontains=q)
            )

        category = request.query_params.get("category")
        if category and category.lower() != "all":
            qs = qs.filter(category=category)

        county = request.query_params.get("county")
        if county:
            qs = qs.filter(county__icontains=county)

        ser = ProductSerializer(qs, many=True, context={"request": request})
        return Response({"results": ser.data}, status=status.HTTP_200_OK)

    def post(self, request) -> Response:
        if not request.user.is_authenticated:
            return Response({"error": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        role = getattr(getattr(request.user, "profile", None), "role", None)
        if role != "farmer":
            return Response(
                {"error": "forbidden", "message": "Only farmer accounts can create product listings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payload = request.data.copy()
        images = request.FILES.getlist("images")
        if images:
            payload.setlist("images", images)

        ser = ProductCreateSerializer(data=payload)
        if not ser.is_valid():
            return Response({"error": "validation_error", "details": ser.errors}, status=400)

        data = ser.validated_data

        farmer_location = getattr(getattr(request.user, "profile", None), "location", "")

        product = Product.objects.create(
            farmer=request.user,
            name=data["name"].strip(),
            category=data["category"],
            description=data["description"].strip(),
            price=data["price"],
            unit=data["unit"],
            quantity=data["quantity"],
            is_organic=data.get("isOrganic", False),
            county=data["county"],
            farmer_location=farmer_location,
            harvest_date=data.get("harvestDate") or timezone.now().date(),
            lat=data.get("lat"),
            lng=data.get("lng"),
        )

        for img in data.get("images", [])[:5]:
            ProductImage.objects.create(product=product, image=img)

        out = ProductSerializer(product, context={"request": request}).data
        return Response(out, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    """GET /api/v1/products/<uuid>/ (public), PUT/PATCH/DELETE (owner-only)."""

    permission_classes = [AllowAny]

    def get(self, request, pk) -> Response:
        try:
            product = Product.objects.select_related("farmer").prefetch_related("images").get(id=pk, is_active=True)
        except Product.DoesNotExist:
            return Response({"error": "not_found"}, status=404)
        ser = ProductSerializer(product, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)

    def put(self, request, pk) -> Response:
        """Full product update - farmer only."""
        if not request.user.is_authenticated:
            return Response({"error": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return Response({"error": "not_found"}, status=404)

        if product.farmer_id != request.user.id:
            return Response({"error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProductSerializer(product, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk) -> Response:
        """Partial product update - farmer only."""
        if not request.user.is_authenticated:
            return Response({"error": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return Response({"error": "not_found"}, status=404)

        if product.farmer_id != request.user.id:
            return Response({"error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProductSerializer(product, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk) -> Response:
        if not request.user.is_authenticated:
            return Response({"error": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return Response({"error": "not_found"}, status=404)

        if product.farmer_id != request.user.id:
            return Response({"error": "forbidden"}, status=status.HTTP_403_FORBIDDEN)

        product.is_active = False
        product.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# GRADING HISTORY
# ─────────────────────────────────────────────────────────────────────────────

class GradingHistoryListView(APIView):
    """GET /api/v1/history/grading/  — paginated list of grading sessions."""
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        qs = GradingSession.objects.filter(user=request.user).select_related(
            "pricing_session"
        )
        # Filters
        grade = request.query_params.get("grade")
        if grade:
            qs = qs.filter(grade_code=grade.upper())
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # Pagination
        page_size = int(request.query_params.get("page_size", 20))
        page      = int(request.query_params.get("page", 1))
        total     = qs.count()
        qs        = qs[(page - 1) * page_size: page * page_size]

        ser = GradingSessionSerializer(qs, many=True, context={"request": request})
        return Response({
            "count":    total,
            "page":     page,
            "pages":    (total + page_size - 1) // page_size,
            "results":  ser.data,
        })


class GradingHistoryDetailView(APIView):
    """GET/DELETE /api/v1/history/grading/<uuid>/"""
    permission_classes = [IsAuthenticated]

    def _get_session(self, pk, user):
        try:
            return GradingSession.objects.get(id=pk, user=user)
        except GradingSession.DoesNotExist:
            return None

    def get(self, request, pk) -> Response:
        session = self._get_session(pk, request.user)
        if not session:
            return Response({"error": "not_found"}, status=404)
        ser = GradingSessionSerializer(session, context={"request": request})
        return Response(ser.data)

    def delete(self, request, pk) -> Response:
        session = self._get_session(pk, request.user)
        if not session:
            return Response({"error": "not_found"}, status=404)
        # Delete image file
        if session.image:
            session.image.delete(save=False)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# PRICING HISTORY
# ─────────────────────────────────────────────────────────────────────────────

class PricingHistoryListView(APIView):
    """GET /api/v1/history/pricing/  — paginated list of pricing sessions."""
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        qs = PricingSession.objects.filter(
            user=request.user
        ).select_related("grading_session")

        # Filters
        grade = request.query_params.get("grade")
        if grade:
            qs = qs.filter(grading_session__grade_code=grade.upper())
        market = request.query_params.get("market")
        if market:
            qs = qs.filter(market_location__icontains=market)
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        page_size = int(request.query_params.get("page_size", 20))
        page      = int(request.query_params.get("page", 1))
        total     = qs.count()
        qs        = qs[(page - 1) * page_size: page * page_size]

        ser = PricingSessionSerializer(qs, many=True, context={"request": request})
        return Response({
            "count":   total,
            "page":    page,
            "pages":   (total + page_size - 1) // page_size,
            "results": ser.data,
        })


class PricingHistoryDetailView(APIView):
    """GET /api/v1/history/pricing/<uuid>/  — includes imputed_features + resolution_log."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk) -> Response:
        try:
            session = PricingSession.objects.select_related(
                "grading_session"
            ).get(id=pk, user=request.user)
        except PricingSession.DoesNotExist:
            return Response({"error": "not_found"}, status=404)
        ser = PricingSessionDetailSerializer(session, context={"request": request})
        return Response(ser.data)


# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK
# ─────────────────────────────────────────────────────────────────────────────

class GradingFeedbackView(APIView):
    """POST /api/v1/feedback/grading/"""
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        ser = GradingFeedbackSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"error": "validation_error", "details": ser.errors}, status=400)
        feedback = ser.save(submitted_by=request.user)
        return Response({
            "id":             feedback.id,
            "correct_grade":  feedback.correct_grade,
            "model_was_wrong":feedback.model_was_wrong,
            "message":        "Thank you — your feedback improves the grading model.",
        }, status=status.HTTP_201_CREATED)


class PricingFeedbackView(APIView):
    """POST /api/v1/feedback/pricing/"""
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        ser = PricingFeedbackSerializer(data=request.data)
        if not ser.is_valid():
            return Response({"error": "validation_error", "details": ser.errors}, status=400)
        feedback = ser.save(submitted_by=request.user)
        return Response({
            "id":               feedback.id,
            "actual_price":     feedback.actual_price,
            "price_was_wrong":  feedback.price_was_wrong,
            "message":          "Thank you — your feedback improves the pricing model.",
        }, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

class AnalyticsView(APIView):
    """GET /api/v1/analytics/?period=last_30_days"""
    permission_classes = [IsAuthenticated]

    _PERIODS = {
        "last_7_days":  7,
        "last_30_days": 30,
        "last_90_days": 90,
        "all_time":     None,
    }

    def get(self, request) -> Response:
        period_key = request.query_params.get("period", "last_30_days")
        days = self._PERIODS.get(period_key, 30)

        grading_qs = GradingSession.objects.filter(user=request.user)
        pricing_qs = PricingSession.objects.filter(user=request.user)

        if days:
            since = timezone.now() - timedelta(days=days)
            grading_qs = grading_qs.filter(created_at__gte=since)
            pricing_qs = pricing_qs.filter(created_at__gte=since)

        # Grade distribution
        grade_dist = dict(
            grading_qs.values("grade_code")
            .annotate(count=Count("id"))
            .values_list("grade_code", "count")
        )

        # Average confidence
        avg_conf = grading_qs.aggregate(avg=Avg("confidence"))["avg"] or 0.0

        # Marketable rate
        total = grading_qs.count()
        marketable = grading_qs.filter(marketable=True).count()
        rate = (marketable / total * 100) if total else 0.0

        # Average price by grade
        avg_prices = {}
        for row in (
            pricing_qs
            .values("grading_session__grade_code")
            .annotate(avg_price=Avg("predicted_price"))
        ):
            avg_prices[row["grading_session__grade_code"]] = round(
                row["avg_price"] or 0.0, 3
            )

        # Top markets by volume
        top_markets = list(
            pricing_qs
            .values("market_location")
            .annotate(count=Count("id"), avg_price=Avg("predicted_price"))
            .order_by("-count")[:5]
        )

        # Monthly price trend (last 12 months)
        from django.db.models.functions import TruncMonth
        monthly = list(
            pricing_qs
            .annotate(month_trunc=TruncMonth("created_at"))
            .values("month_trunc")
            .annotate(avg_price=Avg("predicted_price"), count=Count("id"))
            .order_by("month_trunc")
        )

        return Response({
            "period":                  period_key,
            "total_grading_sessions":  total,
            "total_pricing_sessions":  pricing_qs.count(),
            "grade_distribution":      grade_dist,
            "average_confidence":      round(avg_conf, 2),
            "marketable_rate":         round(rate, 2),
            "average_price_by_grade":  avg_prices,
            "top_markets":             top_markets,
            "price_trend_monthly":     [
                {
                    "month":     r["month_trunc"].strftime("%Y-%m"),
                    "avg_price": round(r["avg_price"] or 0.0, 3),
                    "count":     r["count"],
                }
                for r in monthly
            ],
        })


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

class HealthCheckView(APIView):
    """GET /api/v1/health/  — public, no auth required."""
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        try:
            from ml_engine.inference_pipeline import InferencePipeline
            pipeline_health = InferencePipeline.get_instance().health_check()
        except Exception as exc:
            pipeline_health = {
                "pipeline_healthy": False,
                "error": str(exc),
                "grading_model": {"healthy": False},
                "pricing_model": {"healthy": False},
            }

        http_status = status.HTTP_200_OK

        return Response({
            "status":           "ok",
            "pipeline_healthy": pipeline_health.get("pipeline_healthy", True),
            "grading_model":    pipeline_health.get("grading_model", {}),
            "pricing_model":    pipeline_health.get("pricing_model", {}),
            "timestamp":        timezone.now().isoformat(),
            "version":          "2.0.0",
        }, status=http_status)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────────────────────────────────────

import logging
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle

from .models import EmailVerification, TwoFactorAuth, LoginAttempt, PasswordReset
from .serializers import (
    UserRegistrationSerializer, LoginSerializer, TwoFactorSetupSerializer,
    TwoFactorVerifySerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer, UserProfileSerializer,
    ForgotPasswordSerializer, PasswordResetVerifyCodeSerializer,
    PasswordResetConfirmSerializer as PasswordResetConfirmSerializerNew,
)

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Get client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def track_login_attempt(email, ip_address, user_agent, was_successful, failure_reason=""):
    """Track login attempt for security monitoring."""
    LoginAttempt.objects.create(
        email=email,
        ip_address=ip_address,
        user_agent=user_agent,
        was_successful=was_successful,
        failure_reason=failure_reason
    )


class RegisterView(APIView):
    """Enhanced user registration with email verification."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def post(self, request) -> Response:
        logger.info(f"🔐 REGISTRATION REQUEST RECEIVED")
        logger.info(f"   Request data: {request.data}")
        logger.info(f"   Client IP: {get_client_ip(request)}")
        logger.info(f"   User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}")
        
        serializer = UserRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ REGISTRATION VALIDATION FAILED")
            logger.warning(f"   Errors: {serializer.errors}")
            return Response({
                "error": "validation_error",
                "message": "Please correct the errors below.",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = serializer.save()
            logger.info(f"✅ USER CREATED SUCCESSFULLY")
            logger.info(f"   User ID: {user.id}")
            logger.info(f"   Username: {user.username}")
            logger.info(f"   Email: {user.email}")
            
            # Send verification email (code-based, not URL/token in body)
            verification = user.email_verification
            verification_code = verification.verification_code or verification.generate_code()
            logger.info(f"📧 SENDING ACCOUNT ACTIVATION EMAIL")
            logger.info(f"   Verification Code: {verification_code}")
            logger.info(f"   Expires: {verification.expires_at}")
            
            # ✅ Non-blocking — fires email in background thread
            first_name       = user.first_name
            username         = user.username
            email_addr       = user.email

            def _send_activation_email():
                try:
                    send_mail(
                        subject='Activate Your AgriLink Account - Verification Code Required',
                        message=f'''
            Hi {first_name or username},

            Welcome to AgriLink! 🌾

            Your account has been created successfully. To activate your account and start using AgriLink, please verify your email address.

            ACTIVATE ACCOUNT
            ──────────────────────────────────
            Verification Code: {verification_code}

            How to activate:
            1. Open the AgriLink app
            2. Enter your email: {email_addr}
            3. Enter the 6-digit verification code above
            4. Your account will be activated instantly

            This code will expire in 24 hours.

            ⚠️  IMPORTANT SECURITY NOTES:
            - AgriLink staff will NEVER ask you for this code
            - Never share this code with anyone
            - If you didn't create this account, please ignore this email

            Questions? Contact our support team.

            Best regards,
            The AgriLink Team
                        ''',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[email_addr],
                        fail_silently=True,
                    )
                    logger.info(f"✅ ACTIVATION EMAIL SENT SUCCESSFULLY TO: {email_addr}")
                except Exception as e:
                    logger.error(f"❌ FAILED TO SEND ACTIVATION EMAIL TO {email_addr}: {e}")

            threading.Thread(target=_send_activation_email, daemon=True).start()
            logger.info(f"📧 ACTIVATION EMAIL THREAD STARTED FOR: {user.email}")
            
            # Track successful registration
            track_login_attempt(
                email=user.email,
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                was_successful=True
            )
            
            return Response({
                "message": "Account created successfully. Please check your email for the verification code.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
                "email_verification_required": True,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"User registration failed: {e}")
            return Response({
                "error": "registration_failed",
                "message": "Failed to create account. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyEmailView(APIView):
    """Email verification endpoint."""
    permission_classes = [AllowAny]

    def get(self, request, token) -> Response:
        try:
            verification = get_object_or_404(EmailVerification, token=token)
            
            if verification.is_verified:
                return Response({
                    "message": "Email already verified.",
                    "verified": True
                })
            
            if verification.is_expired():
                return Response({
                    "error": "token_expired",
                    "message": "Verification token has expired. Please request a new one."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify the email
            verification.is_verified = True
            verification.save()
            
            return Response({
                "message": "Email verified successfully! You can now log in.",
                "verified": True
            })
            
        except Exception as e:
            logger.error(f"Email verification failed: {e}")
            return Response({
                "error": "verification_failed",
                "message": "Invalid verification token."
            }, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailCodeView(APIView):
    """Email verification using code (not token)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify-email'

    def post(self, request) -> Response:
        from .serializers import EmailVerificationCodeSerializer
        serializer = EmailVerificationCodeSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ CODE VERIFICATION VALIDATION FAILED: {serializer.errors}")
            return Response({
                "error": "validation_error",
                "message": "Please correct the errors below.",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        try:
            user = User.objects.get(email__iexact=email)
            verification = user.email_verification

            logger.info(f"🔐 VERIFYING EMAIL CODE FOR: {email}")
            logger.info(f"   Provided Code: {code}")

            # Check if already verified
            if verification.is_verified:
                return Response({
                    "message": "Email already verified.",
                    "verified": True
                }, status=status.HTTP_200_OK)

            # Check if expired
            if verification.is_expired() or verification.is_code_expired():
                logger.warning(f"❌ VERIFICATION CODE EXPIRED: {email}")
                return Response({
                    "error": "code_expired",
                    "message": "Verification code has expired. Please request a new one."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Verify code
            if verification.verify_code(code):
                logger.info(f"✅ EMAIL VERIFIED FOR: {email}")

                return Response({
                    "message": "Email verified successfully! Your account is now activated.",
                    "verified": True
                }, status=status.HTTP_200_OK)
            else:
                logger.warning(f"❌ INVALID CODE PROVIDED FOR: {email}")
                return Response({
                    "error": "invalid_code",
                    "message": "Invalid verification code."
                }, status=status.HTTP_400_BAD_REQUEST)

        except User.DoesNotExist:
            logger.warning(f"⚠️  CODE VERIFICATION FOR NON-EXISTENT USER: {email}")
            return Response({
                "error": "user_not_found",
                "message": "User account not found."
            }, status=status.HTTP_404_NOT_FOUND)

        except EmailVerification.DoesNotExist:
            logger.warning(f"⚠️  EMAIL VERIFICATION NOT FOUND FOR: {email}")
            return Response({
                "error": "verification_not_found",
                "message": "Email verification not found. Please register again."
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.error(f"❌ EMAIL CODE VERIFICATION FAILED: {e}")
            return Response({
                "error": "verification_failed",
                "message": "An error occurred during verification. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import threading
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework import status

class ResendVerificationView(APIView):
    """Resend email verification code."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'verify-email'

    def post(self, request) -> Response:
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ RESEND VERIFICATION VALIDATION FAILED: {serializer.errors}")
            return Response({
                "message": "Please provide a valid email address."
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email__iexact=email)
            verification = user.email_verification

            logger.info(f"📧 RESENDING VERIFICATION CODE FOR: {email}")

            # Generate new code
            new_code = verification.generate_code()

            # Prepare variables for threading
            _first_name  = user.first_name
            _username    = user.username
            _email_addr  = user.email
            _new_code    = new_code

            # ✅ Non-blocking resend
            def _send_resend_email():
                try:
                    send_mail(
                        subject='Activate Your AgriLink Account - New Verification Code',
                        message=f'''
Hi {_first_name or _username},

We received a request to resend your verification code.

ACTIVATE ACCOUNT
──────────────────────────────────
Your new verification code is: {_new_code}

How to activate:
1. Open the AgriLink app
2. Enter your email: {_email_addr}
3. Enter the 6-digit verification code above
4. Your account will be activated instantly

This code will expire in 24 hours.

⚠️  IMPORTANT SECURITY NOTES:
- AgriLink staff will NEVER ask you for this code
- Never share this code with anyone
- If you didn't create this account, please ignore this email

Questions? Contact our support team.

Best regards,
The AgriLink Team
                        ''',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[_email_addr],
                        fail_silently=True,
                    )
                    logger.info(f"✅ VERIFICATION CODE RESENT TO: {_email_addr}")
                except Exception as e:
                    logger.error(f"❌ FAILED TO RESEND VERIFICATION CODE: {e}")

            threading.Thread(target=_send_resend_email, daemon=True).start()
            logger.info(f"📧 RESEND EMAIL THREAD STARTED FOR: {email}")

        except User.DoesNotExist:
            logger.warning(f"⚠️ RESEND REQUEST FOR NON-EXISTENT EMAIL: {email}")
            # Prevent email enumeration
            pass
        except Exception as e:
            logger.error(f"❌ FAILED TO RESEND VERIFICATION CODE: {e}")
            # Still return 200 to prevent enumeration

        return Response({
            "message": "If an account exists with this email, a new verification code has been sent."
        }, status=status.HTTP_200_OK)
class LoginView(APIView):
    """Enhanced login with 2FA support."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request) -> Response:
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": "validation_error",
                "message": "Please correct the errors below.",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Check if user exists
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            track_login_attempt(email, ip_address, user_agent, False, "Invalid email")
            return Response({
                "error": "invalid_credentials",
                "message": "Invalid email or password."
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if email is verified
        try:
            if not user.email_verification.is_verified:
                track_login_attempt(email, ip_address, user_agent, False, "Email not verified")
                return Response({
                    "error": "email_not_verified",
                    "message": "Please verify your email address before logging in.",
                    "requires_verification": True
                }, status=status.HTTP_401_UNAUTHORIZED)
        except EmailVerification.DoesNotExist:
            track_login_attempt(email, ip_address, user_agent, False, "Email verification not found")
            return Response({
                "error": "email_not_verified",
                "message": "Please verify your email address before logging in.",
                "requires_verification": True
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Authenticate user
        authenticated_user = authenticate(username=user.username, password=password)
        if not authenticated_user:
            track_login_attempt(email, ip_address, user_agent, False, "Invalid password")
            return Response({
                "error": "invalid_credentials",
                "message": "Invalid email or password."
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if 2FA is enabled
        try:
            two_factor = authenticated_user.two_factor
            if two_factor.is_enabled:
                # Generate and send 2FA token
                token = two_factor.generate_email_token()
                
                try:
                    send_mail(
                        subject='AgriLink - Your 2FA Code',
                        message=f'Your verification code is: {token}\n\nThis code will expire in 10 minutes.',
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[authenticated_user.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.error(f"Failed to send 2FA email to {authenticated_user.email}: {e}")
                    return Response({
                        "error": "2fa_failed",
                        "message": "Failed to send 2FA code. Please try again."
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Return 2FA required response
                return Response({
                    "message": "Please enter the 2FA code sent to your email.",
                    "requires_2fa": True,
                    "user_id": authenticated_user.id
                }, status=status.HTTP_202_ACCEPTED)
                
        except TwoFactorAuth.DoesNotExist:
            # 2FA not set up, continue with normal login
            pass
        
        # Successful login - generate tokens
        refresh = RefreshToken.for_user(authenticated_user)
        
        # Ensure UserProfile exists and get profile data
        profile, created = UserProfile.objects.get_or_create(
            user=authenticated_user,
            defaults={
                'role': 'buyer',  # Default to buyer, should be set during registration
                'phone': '',
                'county': '',
                'location': ''
            }
        )
        
        # Track successful login
        track_login_attempt(email, ip_address, user_agent, True)
        
        return Response({
            "message": "Login successful.",
            "user": {
                "id": authenticated_user.id,
                "username": authenticated_user.username,
                "email": authenticated_user.email,
                "first_name": authenticated_user.first_name,
                "last_name": authenticated_user.last_name,
            },
            "profile": {
                "role": profile.role,
                "county": profile.county,
                "location": profile.location,
                "phone": profile.phone,
            },
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            "requires_2fa": False
        }, status=status.HTTP_200_OK)


class TwoFactorLoginView(APIView):
    """Handle 2FA verification during login."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = '2fa'

    def post(self, request) -> Response:
        serializer = TwoFactorVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": "validation_error",
                "message": "Please correct the errors below.",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user_id = request.data.get('user_id')
        token = serializer.validated_data.get('token')
        backup_code = serializer.validated_data.get('backup_code')
        
        try:
            user = User.objects.get(id=user_id)
            two_factor = user.two_factor
            
            # Check if account is locked
            if two_factor.is_locked():
                return Response({
                    "error": "account_locked",
                    "message": "Account temporarily locked due to too many failed attempts. Please try again later."
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            
            # Verify token or backup code
            if token and two_factor.verify_email_token(token):
                # Success - generate tokens
                refresh = RefreshToken.for_user(user)
                
                # Ensure UserProfile exists and get profile data
                profile, created = UserProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'role': 'farmer',
                        'phone': '',
                        'county': '',
                        'location': ''
                    }
                )
                
                return Response({
                    "message": "2FA verification successful.",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                    "profile": {
                        "role": profile.role,
                        "county": profile.county,
                        "location": profile.location,
                        "phone": profile.phone,
                    },
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    }
                }, status=status.HTTP_200_OK)
            
            elif backup_code and backup_code in two_factor.backup_codes:
                # Remove used backup code
                two_factor.backup_codes.remove(backup_code)
                two_factor.failed_attempts = 0
                two_factor.save()
                
                # Generate tokens
                refresh = RefreshToken.for_user(user)
                
                # Ensure UserProfile exists and get profile data
                profile, created = UserProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'role': 'buyer',  # Default to buyer, should be set during registration
                        'phone': '',
                        'county': '',
                        'location': ''
                    }
                )
                
                return Response({
                    "message": "Backup code verification successful.",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    },
                    "profile": {
                        "role": profile.role,
                        "county": profile.county,
                        "location": profile.location,
                        "phone": profile.phone,
                    },
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                    "backup_codes_remaining": len(two_factor.backup_codes)
                }, status=status.HTTP_200_OK)
            
            else:
                # Failed verification
                remaining_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3) - two_factor.failed_attempts
                
                return Response({
                    "error": "invalid_2fa",
                    "message": "Invalid 2FA code or backup code.",
                    "remaining_attempts": max(0, remaining_attempts - 1),
                    "account_locked": two_factor.is_locked()
                }, status=status.HTTP_401_UNAUTHORIZED)
                
        except User.DoesNotExist:
            return Response({
                "error": "user_not_found",
                "message": "User not found."
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"2FA verification failed: {e}")
            return Response({
                "error": "2fa_failed",
                "message": "2FA verification failed. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SetupTwoFactorView(APIView):
    """Set up two-factor authentication."""
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        serializer = TwoFactorSetupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": "validation_error",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            two_factor = TwoFactorAuth.setup_for_user(request.user)
            two_factor.is_enabled = True
            two_factor.save()
            
            # Generate and send test token
            token = two_factor.generate_email_token()
            
            send_mail(
                subject='AgriLink - Test 2FA Code',
                message=f'Your test 2FA code is: {token}\n\nUse this to confirm 2FA setup.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
                fail_silently=False,
            )
            
            return Response({
                "message": "2FA setup initiated. Please check your email for verification code.",
                "backup_codes": two_factor.backup_codes,
                "requires_verification": True
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"2FA setup failed for user {request.user.id}: {e}")
            return Response({
                "error": "setup_failed",
                "message": "Failed to set up 2FA. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyTwoFactorSetupView(APIView):
    """Verify 2FA setup with test token."""
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        serializer = TwoFactorVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": "validation_error",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        token = serializer.validated_data.get('token')
        
        try:
            two_factor = request.user.two_factor
            
            if two_factor.verify_email_token(token):
                return Response({
                    "message": "2FA setup completed successfully!",
                    "two_factor_enabled": True
                }, status=status.HTTP_200_OK)
            else:
                # Disable 2FA if setup verification fails
                two_factor.is_enabled = False
                two_factor.save()
                
                return Response({
                    "error": "verification_failed",
                    "message": "Invalid verification code. 2FA setup cancelled.",
                    "two_factor_enabled": False
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"2FA setup verification failed for user {request.user.id}: {e}")
            return Response({
                "error": "verification_failed",
                "message": "Failed to verify 2FA setup."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutView(APIView):
    """Enhanced logout with token blacklisting."""
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            return Response({
                "message": "Logged out successfully."
            }, status=status.HTTP_200_OK)
            
        except Exception as exc:
            logger.error(f"Logout failed for user {request.user.id}: {exc}")
            return Response({
                "error": "logout_failed",
                "message": "Failed to logout properly."
            }, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
# PASSWORD RESET ENDPOINTS (2FA-based flow)
# ─────────────────────────────────────────────────────────────────────────────

class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    
    Initiate password reset using 2FA flow:
    1. User provides email
    2. System validates email exists (without revealing)
    3. 6-digit code is sent to email (no URL exposed)
    4. Email reads: "RESET PASSWORD" instead of link
    
    Security:
    - Always returns 200 OK regardless of email existence
    - Prevents email enumeration attacks
    - Code is 6-digit (not in URL)
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'forgot_password'

    def post(self, request) -> Response:
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ FORGOT PASSWORD VALIDATION FAILED: {serializer.errors}")
            return Response({
                "message": "If an account exists with this email, you will receive a password reset code shortly."
            }, status=status.HTTP_200_OK)
        
        email = serializer.validated_data['email']
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        try:
            user = User.objects.get(email__iexact=email)
            logger.info(f"🔐 PASSWORD RESET REQUEST FOR: {email}")
            
            # Create password reset request
            reset = PasswordReset.create_reset_request(user, ip_address, user_agent)
            code = reset.generate_reset_code()
            
            logger.info(f"   Reset Token: {reset.token}")
            logger.info(f"   Reset Code: {code}")
            logger.info(f"   IP: {ip_address}")
            
            # Send email with code (no URL!)
            send_mail(
                subject='Reset Your AgriLink Password - Verification Code Required',
                message=f'''
Hi {user.first_name or user.username},

We received a request to reset your AgriLink account password.

RESET PASSWORD
──────────────────────────────────
Your verification code is: {code}

This code will expire in 10 minutes.

⚠️  IMPORTANT: NEVER SHARE THIS CODE WITH ANYONE
AgriLink staff will NEVER ask you for this code.

Instructions to reset your password:
1. Go to the password reset screen in the AgriLink app
2. Enter your email: {email}
3. Enter the 6-digit code above
4. Create a new password

If you didn't request this reset, please ignore this email and your account remains secure.

Questions? Contact our support team.

Best regards,
The AgriLink Team
                ''',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"✅ RESET CODE EMAIL SENT TO: {email}")
            
        except User.DoesNotExist:
            logger.warning(f"⚠️  PASSWORD RESET REQUESTED FOR NON-EXISTENT EMAIL: {email}")
            # Don't reveal that email doesn't exist
            pass
        except Exception as e:
            logger.error(f"❌ FAILED TO SEND RESET EMAIL: {e}")
            # Still return 200 to prevent enumeration
        
        # Always return the same message regardless of outcome
        return Response({
            "message": "If an account exists with this email, you will receive a password reset code shortly."
        }, status=status.HTTP_200_OK)


class PasswordResetVerifyCodeView(APIView):
    """
    POST /api/v1/auth/password-reset/verify-code/
    
    Verify the 2FA code sent to user's email during password reset.
    
    After successful verification, user can proceed to set new password.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request) -> Response:
        serializer = PasswordResetVerifyCodeSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ CODE VERIFICATION VALIDATION FAILED: {serializer.errors}")
            return Response({
                "error": "validation_error",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        token = serializer.validated_data['token']
        code = serializer.validated_data['code']
        
        try:
            user = User.objects.get(email__iexact=email)
            reset = PasswordReset.objects.get(token=token, user=user, is_used=False)
            
            logger.info(f"🔐 VERIFYING RESET CODE FOR: {email}")
            logger.info(f"   Token: {token}")
            logger.info(f"   Provided Code: {code}")
            
            # Check if reset expired
            if reset.is_expired():
                logger.warning(f"❌ RESET TOKEN EXPIRED: {token}")
                return Response({
                    "error": "reset_expired",
                    "message": "Your password reset request has expired. Please request a new one."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if locked due to failed attempts
            if reset.is_locked():
                remaining_minutes = int((reset.locked_until - timezone.now()).total_seconds() / 60)
                logger.warning(f"❌ RESET LOCKED DUE TO FAILED ATTEMPTS: {email}")
                return Response({
                    "error": "reset_locked",
                    "message": f"Too many failed attempts. Please try again in {remaining_minutes} minutes."
                }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            
            # Verify code
            if reset.verify_reset_code(code):
                logger.info(f"✅ CODE VERIFIED FOR: {email}")
                logger.info(f"   Reset is now confirmed and ready for password change")
                
                return Response({
                    "message": "Code verified successfully. You can now set your new password.",
                    "token": str(reset.token)
                }, status=status.HTTP_200_OK)
            else:
                logger.warning(f"❌ INVALID CODE PROVIDED FOR: {email}")
                remaining_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3) - reset.failed_attempts
                
                if remaining_attempts <= 0:
                    logger.error(f"❌ MAX ATTEMPTS REACHED FOR: {email}")
                    return Response({
                        "error": "reset_locked",
                        "message": "Too many failed attempts. Please request a new password reset."
                    }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                
                return Response({
                    "error": "invalid_code",
                    "message": f"Invalid verification code. {remaining_attempts} attempts remaining.",
                    "attempts_remaining": remaining_attempts
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except PasswordReset.DoesNotExist:
            logger.warning(f"❌ NO RESET REQUEST FOUND FOR: {email} with token: {token}")
            return Response({
                "error": "reset_not_found",
                "message": "Password reset request not found. Please request a new one."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except User.DoesNotExist:
            logger.warning(f"⚠️  CODE VERIFICATION FOR NON-EXISTENT USER: {email}")
            return Response({
                "error": "user_not_found",
                "message": "User account not found."
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            logger.error(f"❌ CODE VERIFICATION FAILED: {e}")
            return Response({
                "error": "verification_failed",
                "message": "An error occurred during verification. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/
    
    Confirm new password and complete password reset.
    
    Prerequisites:
    - Email must be verified via 2FA code
    - Reset token must not be expired
    - Passwords must match and meet requirements
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'

    def post(self, request) -> Response:
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"❌ PASSWORD RESET CONFIRM VALIDATION FAILED: {serializer.errors}")
            return Response({
                "error": "validation_error",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        try:
            user = User.objects.get(email__iexact=email)
            reset = PasswordReset.objects.get(token=token, user=user, is_used=False)
            
            logger.info(f"🔐 CONFIRMING PASSWORD RESET FOR: {email}")
            logger.info(f"   Token: {token}")
            
            # Validate prerequisites
            if not reset.is_confirmed:
                logger.warning(f"❌ RESET NOT CONFIRMED (2FA CODE NOT VERIFIED): {email}")
                return Response({
                    "error": "reset_not_confirmed",
                    "message": "Please verify your email code first."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if reset.is_expired():
                logger.warning(f"❌ RESET REQUEST EXPIRED: {email}")
                return Response({
                    "error": "reset_expired",
                    "message": "Your password reset request has expired. Please request a new one."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update password
            user.set_password(new_password)
            user.save()
            
            # Mark reset as used
            reset.mark_as_used()
            
            logger.info(f"✅ PASSWORD SUCCESSFULLY RESET FOR: {email}")
            logger.info(f"   Reset marked as used: {reset.token}")
            
            # Send confirmation email
            try:
                send_mail(
                    subject='Your AgriLink Password Has Been Changed',
                    message=f'''
Hi {user.first_name or user.username},

Your AgriLink account password has been successfully changed.

If you did not make this change, please contact our support team immediately.

You can now log in with your new password.

Best regards,
The AgriLink Team
                    ''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                logger.info(f"✅ PASSWORD CHANGE CONFIRMATION EMAIL SENT TO: {email}")
            except Exception as e:
                logger.error(f"⚠️  FAILED TO SEND CONFIRMATION EMAIL: {e}")
                # Don't fail the reset if confirmation email fails
            
            return Response({
                "message": "Password successfully reset. You can now log in with your new password.",
                "email": user.email
            }, status=status.HTTP_200_OK)
        
        except PasswordReset.DoesNotExist:
            logger.warning(f"❌ PASSWORD RESET REQUEST NOT FOUND: {email}")
            return Response({
                "error": "reset_not_found",
                "message": "Password reset request not found. Please request a new one."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except User.DoesNotExist:
            logger.warning(f"⚠️  PASSWORD RESET FOR NON-EXISTENT USER: {email}")
            return Response({
                "error": "user_not_found",
                "message": "User account not found."
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            logger.error(f"❌ PASSWORD RESET CONFIRMATION FAILED: {e}")
            return Response({
                "error": "reset_failed",
                "message": "An error occurred during password reset. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserProfileView(APIView):
    """Enhanced user profile with security information."""
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        try:
            total_gradings = GradingSession.objects.filter(user=request.user).count()
            total_pricings = PricingSession.objects.filter(user=request.user).count()
            
            serializer = UserProfileSerializer(request.user)
            user_data = serializer.data
            
            user_data['stats'] = {
                "total_gradings": total_gradings,
                "total_pricings": total_pricings,
            }
            
            return Response(user_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get user profile for {request.user.id}: {e}")
            return Response({
                "error": "profile_failed",
                "message": "Failed to retrieve profile information."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as exc:
            logger.error(f"Logout failed for user {request.user.id}: {exc}")
            return Response({
                "error": "logout_failed",
                "message": "Failed to logout properly."
            }, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """Enhanced user profile with security information."""
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        try:
            total_gradings = GradingSession.objects.filter(user=request.user).count()
            total_pricings = PricingSession.objects.filter(user=request.user).count()
            
            serializer = UserProfileSerializer(request.user)
            user_data = serializer.data
            
            user_data['stats'] = {
                "total_gradings": total_gradings,
                "total_pricings": total_pricings,
            }
            
            return Response(user_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to get user profile for {request.user.id}: {e}")
            return Response({
                "error": "profile_failed",
                "message": "Failed to retrieve profile information."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    def put(self, request) -> Response:
        """Full profile update."""
        try:
            # Get or create user profile
            profile, created = UserProfile.objects.get_or_create(
                user=request.user,
                defaults={
                    'role': 'farmer',
                    'phone': '',
                    'county': '',
                    'location': ''
                }
            )
            
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Failed to update profile for {request.user.id}: {e}")
            return Response({
                "error": "profile_update_failed",
                "message": "Failed to update profile information."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request) -> Response:
        """Partial profile update."""
        try:
            # Get or create user profile
            profile, created = UserProfile.objects.get_or_create(
                user=request.user,
                defaults={
                    'role': 'farmer',
                    'phone': '',
                    'county': '',
                    'location': ''
                }
            )
            
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Failed to update profile for {request.user.id}: {e}")
            return Response({
                "error": "profile_update_failed",
                "message": "Failed to update profile information."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserDetailView(APIView):
    """Get user details for marketplace display."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk) -> Response:
        """Get user details by ID."""
        try:
            user = User.objects.get(pk=pk)
            try:
                profile = user.profile
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'role': profile.role,
                    'county': profile.county,
                    'location': profile.location,
                    'phone': profile.phone,
                    'date_joined': user.date_joined,
                })
            except UserProfile.DoesNotExist:
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'role': 'farmer',  # Default
                    'county': '',
                    'location': '',
                    'phone': '',
                    'date_joined': user.date_joined,
                })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, 
                           status=status.HTTP_404_NOT_FOUND)


class CountyListView(APIView):
    """List all active counties."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active counties."""
        counties = County.objects.filter(is_active=True)
        serializer = CountySerializer(counties, many=True)
        return Response(serializer.data)


class ProductCategoryListView(APIView):
    """List all active product categories."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active product categories."""
        categories = ProductCategory.objects.filter(is_active=True)
        serializer = ProductCategorySerializer(categories, many=True)
        return Response(serializer.data)


class FarmerDirectoryView(APIView):
    """Farmer directory with search and filtering."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of farmers with optional filtering."""
        queryset = FarmerProfile.objects.select_related('user', 'county').all()
        
        # Filter by county
        county_id = request.query_params.get('county')
        if county_id:
            queryset = queryset.filter(county_id=county_id)
        
        # Filter by crops
        crops = request.query_params.get('crops')
        if crops:
            crop_list = [c.strip() for c in crops.split(',')]
            queryset = queryset.filter(crops__overlap=crop_list)
        
        # Filter by verification status
        verified_only = request.query_params.get('verified', 'false').lower() == 'true'
        if verified_only:
            queryset = queryset.filter(is_verified=True)
        
        # Search by name or location
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(business_name__icontains=search) |
                models.Q(location__icontains=search) |
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search)
            )
        
        # Order by rating by default
        ordering = request.query_params.get('ordering', '-rating')
        queryset = queryset.order_by(ordering)
        
        # Pagination
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = queryset.count()
        farmers = queryset[start:end]
        
        serializer = FarmerProfileListSerializer(farmers, many=True)
        
        return Response({
            'count': total_count,
            'next': page * page_size < total_count,
            'previous': page > 1,
            'results': serializer.data
        })


class FarmerDetailView(APIView):
    """Get detailed farmer profile."""
    permission_classes = [AllowAny]
    
    def get(self, request, pk) -> Response:
        """Get detailed farmer profile by ID."""
        try:
            farmer = FarmerProfile.objects.select_related('user', 'county').get(pk=pk)
            serializer = FarmerProfileSerializer(farmer)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MyFarmerProfileView(APIView):
    """Get or update current user's farmer profile."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request) -> Response:
        """Get current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(profile)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def patch(self, request) -> Response:
        """Update current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(
                profile, data=request.data, partial=True
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(
                serializer.errors, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MarketPriceListView(APIView):
    """List current market prices for tomatoes."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get current market prices with optional filtering."""
        # For now, return mock data structure
        # In production, this would fetch from real market data sources
        mock_prices = [
            {
                'id': 'mp1',
                'crop': 'Tomatoes (Grade A)',
                'category': 'Vegetables',
                'price': 1.8,
                'unit': 'kg',
                'change': 5,
                'change_percent': 6.5,
                'market': 'Mbare Musika (Harare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp2',
                'crop': 'Tomatoes (Grade B)',
                'category': 'Vegetables',
                'price': 1.4,
                'unit': 'kg',
                'change': -3,
                'change_percent': -5.9,
                'market': 'Sakubva Market (Mutare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp3',
                'crop': 'Tomatoes (Grade C)',
                'category': 'Vegetables',
                'price': 1.1,
                'unit': 'kg',
                'change': 2,
                'change_percent': 4.8,
                'market': 'Sakubva & Gweru Markets',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            }
        ]
        
        # Filter by crop if specified
        crop_filter = request.query_params.get('crop')
        if crop_filter:
            mock_prices = [p for p in mock_prices if crop_filter.lower() in p['crop'].lower()]
        
        # Filter by market if specified
        market_filter = request.query_params.get('market')
        if market_filter:
            mock_prices = [p for p in mock_prices if market_filter.lower() in p['market'].lower()]
        
        return Response(mock_prices)


class FeedbackListView(APIView):
    """List user feedback by type."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, feedback_type) -> Response:
        """List user feedback by type."""
        if feedback_type == 'grading':
            feedback = GradingFeedback.objects.filter(
                session__user=request.user
            ).select_related('session')
            serializer = GradingFeedbackSerializer(feedback, many=True)
        elif feedback_type == 'pricing':
            feedback = PricingFeedback.objects.filter(
                session__user=request.user
            ).select_related('session')
            serializer = PricingFeedbackSerializer(feedback, many=True)
        else:
            return Response({
                'error': 'Invalid feedback type. Use: grading or pricing'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.data)


class FeedbackListView(APIView):
    """List user feedback by type."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, feedback_type) -> Response:
        """List user feedback by type."""
        if feedback_type == 'grading':
            feedback = GradingFeedback.objects.filter(
                session__user=request.user
            ).select_related('session')
            serializer = GradingFeedbackSerializer(feedback, many=True)
        elif feedback_type == 'pricing':
            feedback = PricingFeedback.objects.filter(
                session__user=request.user
            ).select_related('session')
            serializer = PricingFeedbackSerializer(feedback, many=True)
        else:
            return Response({
                'error': 'Invalid feedback type. Use: grading or pricing'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.data)


class UserDetailView(APIView):
    """Get user details for marketplace display."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk) -> Response:
        """Get user details by ID."""
        try:
            user = User.objects.get(pk=pk)
            try:
                profile = user.profile
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'role': profile.role,
                    'county': profile.county,
                    'location': profile.location,
                    'phone': profile.phone,
                    'date_joined': user.date_joined,
                })
            except UserProfile.DoesNotExist:
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'role': 'farmer',  # Default
                    'county': '',
                    'location': '',
                    'phone': '',
                    'date_joined': user.date_joined,
                })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, 
                           status=status.HTTP_404_NOT_FOUND)


class CountyListView(APIView):
    """List all active counties."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active counties."""
        counties = County.objects.filter(is_active=True)
        serializer = CountySerializer(counties, many=True)
        return Response(serializer.data)


class ProductCategoryListView(APIView):
    """List all active product categories."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of all active product categories."""
        categories = ProductCategory.objects.filter(is_active=True)
        serializer = ProductCategorySerializer(categories, many=True)
        return Response(serializer.data)


class FarmerDirectoryView(APIView):
    """Farmer directory with search and filtering."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get list of farmers with optional filtering."""
        queryset = FarmerProfile.objects.select_related('user', 'county').all()
        
        # Filter by county
        county_id = request.query_params.get('county')
        if county_id:
            queryset = queryset.filter(county_id=county_id)
        
        # Filter by crops
        crops = request.query_params.get('crops')
        if crops:
            crop_list = [c.strip() for c in crops.split(',')]
            queryset = queryset.filter(crops__overlap=crop_list)
        
        # Filter by verification status
        verified_only = request.query_params.get('verified', 'false').lower() == 'true'
        if verified_only:
            queryset = queryset.filter(is_verified=True)
        
        # Search by name or location
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(business_name__icontains=search) |
                models.Q(location__icontains=search) |
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search)
            )
        
        # Order by rating by default
        ordering = request.query_params.get('ordering', '-rating')
        queryset = queryset.order_by(ordering)
        
        # Pagination
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = queryset.count()
        farmers = queryset[start:end]
        
        serializer = FarmerProfileListSerializer(farmers, many=True)
        
        return Response({
            'count': total_count,
            'next': page * page_size < total_count,
            'previous': page > 1,
            'results': serializer.data
        })


class FarmerDetailView(APIView):
    """Get detailed farmer profile."""
    permission_classes = [AllowAny]
    
    def get(self, request, pk) -> Response:
        """Get detailed farmer profile by ID."""
        try:
            farmer = FarmerProfile.objects.select_related('user', 'county').get(pk=pk)
            serializer = FarmerProfileSerializer(farmer)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MyFarmerProfileView(APIView):
    """Get or update current user's farmer profile."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request) -> Response:
        """Get current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(profile)
            return Response(serializer.data)
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def patch(self, request) -> Response:
        """Update current user's farmer profile."""
        try:
            profile = request.user.farmer_profile
            serializer = FarmerProfileSerializer(
                profile, data=request.data, partial=True
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(
                serializer.errors, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except FarmerProfile.DoesNotExist:
            return Response(
                {'error': 'Farmer profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class MarketPriceListView(APIView):
    """List current market prices for tomatoes."""
    permission_classes = [AllowAny]
    
    def get(self, request) -> Response:
        """Get current market prices with optional filtering."""
        # For now, return mock data structure
        # In production, this would fetch from real market data sources
        mock_prices = [
            {
                'id': 'mp1',
                'crop': 'Tomatoes (Grade A)',
                'category': 'Vegetables',
                'price': 1.8,
                'unit': 'kg',
                'change': 5,
                'change_percent': 6.5,
                'market': 'Mbare Musika (Harare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp2',
                'crop': 'Tomatoes (Grade B)',
                'category': 'Vegetables',
                'price': 1.4,
                'unit': 'kg',
                'change': -3,
                'change_percent': -5.9,
                'market': 'Sakubva Market (Mutare)',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            },
            {
                'id': 'mp3',
                'crop': 'Tomatoes (Grade C)',
                'category': 'Vegetables',
                'price': 1.1,
                'unit': 'kg',
                'change': 2,
                'change_percent': 4.8,
                'market': 'Sakubva & Gweru Markets',
                'date': '2026-03-23',
                'updated_at': '2026-03-23T10:00:00Z'
            }
        ]
        
        # Filter by crop if specified
        crop_filter = request.query_params.get('crop')
        if crop_filter:
            mock_prices = [p for p in mock_prices if crop_filter.lower() in p['crop'].lower()]
        
        # Filter by market if specified
        market_filter = request.query_params.get('market')
        if market_filter:
            mock_prices = [p for p in mock_prices if market_filter.lower() in p['market'].lower()]
        
        return Response(mock_prices)
