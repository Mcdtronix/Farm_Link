"""
tomato_grading_api/serializers.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRF Serializers — Grading + Pricing Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Serializers map between HTTP request/response payloads and the
Django model layer.  This file covers:

  Request serializers (input validation):
    • ImageUploadSerializer       — image file + 4 user context inputs
    • GradingFeedbackSerializer   — grade correction
    • PricingFeedbackSerializer   — actual price correction
    • UserRegistrationSerializer  — account creation

  Response serializers (output shaping):
    • PipelineResponseSerializer  — the unified grade+price response
    • GradingSessionSerializer    — history list item
    • PricingSessionSerializer    — history list item
    • AnalyticsSerializer         — aggregate stats

Design note on the 5-input approach:
  The ImageUploadSerializer only asks the user for 4 fields beyond the
  image itself (market_location, month, market_type, farm coordinates).
  The grade is supplied by the grading model, and the remaining 13
  features are resolved by FeatureImputer.  This keeps the mobile
  form to an absolute minimum.
"""

import magic
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import (
    GradingSession, PricingSession,
    GradingFeedback, PricingFeedback, BatchSession,
    County, ProductCategory, FarmerProfile,
    EmailVerification, TwoFactorAuth, LoginAttempt, UserProfile, Product, ProductImage,
    PasswordReset,
)
from ml_engine.feature_imputer import FeatureImputer


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

MONTH_CHOICES = [
    "January", "February", "March",    "April",
    "May",     "June",     "July",     "August",
    "September", "October", "November", "December",
]

MARKET_TYPE_CHOICES = ["Retail", "Wholesale", "Farm Gate"]


class ImageUploadSerializer(serializers.Serializer):
    """
    The single entry-point request for the full Grade → Price pipeline.

    The user submits 5 pieces of information:
      1. image          — the tomato photograph (file upload or camera)
      2. market_location— which of the 59 Zimbabwe markets they're selling at
      3. month          — the calendar month of the sale
      4. market_type    — Retail / Wholesale / Farm Gate
      5. farm_lat/lon   — optional GPS coordinates (auto-populated by React Native)

    Everything else is resolved automatically in the backend.
    """

    # ── Required fields ───────────────────────────────────────────────────────
    image = serializers.ImageField(
        help_text="JPEG/PNG/WebP image of the tomato(es). Max 10 MB.",
    )
    market_location = serializers.ChoiceField(
        choices=FeatureImputer.get_market_list(),
        help_text="Which Zimbabwe market are you selling at?",
    )
    month = serializers.ChoiceField(
        choices=MONTH_CHOICES,
        help_text="Which month will the sale take place?",
    )
    market_type = serializers.ChoiceField(
        choices=MARKET_TYPE_CHOICES,
        help_text="Are you selling Retail, Wholesale, or Farm Gate?",
    )

    # ── Optional GPS (auto-populated by React Native location API) ────────────
    farm_lat = serializers.FloatField(
        required=False, allow_null=True, default=None,
        min_value=-90.0, max_value=90.0,
        help_text="Farm GPS latitude (auto-populated by the app if location permission granted).",
    )
    farm_lon = serializers.FloatField(
        required=False, allow_null=True, default=None,
        min_value=-180.0, max_value=180.0,
        help_text="Farm GPS longitude.",
    )

    def validate_image(self, image):
        """Validate MIME type, extension, and file size."""
        # Size check
        max_bytes = getattr(settings, "MAX_UPLOAD_SIZE", 10 * 1024 * 1024)
        if image.size > max_bytes:
            raise serializers.ValidationError(
                f"Image exceeds maximum size of {max_bytes // (1024*1024)} MB. "
                f"Received: {image.size / (1024*1024):.1f} MB."
            )

        # MIME type check via python-magic (reads file header bytes)
        try:
            mime = magic.from_buffer(image.read(2048), mime=True)
            image.seek(0)  # reset after reading
        except Exception:
            mime = image.content_type  # fallback to declared type

        allowed_mime = getattr(
            settings, "ALLOWED_IMAGE_TYPES",
            ["image/jpeg", "image/png", "image/webp", "image/bmp"]
        )
        if mime not in allowed_mime:
            raise serializers.ValidationError(
                f"Unsupported image format '{mime}'. "
                f"Accepted formats: JPEG, PNG, WebP, BMP."
            )

        # Extension check
        name  = image.name.lower()
        valid_ext = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
        if not any(name.endswith(ext) for ext in valid_ext):
            raise serializers.ValidationError(
                f"File extension not recognised. Accepted: {', '.join(valid_ext)}"
            )

        return image

    def validate(self, data):
        """Cross-field validation."""
        lat = data.get("farm_lat")
        lon = data.get("farm_lon")
        if (lat is None) != (lon is None):
            raise serializers.ValidationError(
                "Both farm_lat and farm_lon must be provided together, or both omitted."
            )
        return data


class GradeOnlySerializer(serializers.Serializer):
    """Image-only serializer for grading without pricing."""

    image = serializers.ImageField(
        help_text="JPEG/PNG/WebP image of the tomato(es). Max 10 MB.",
    )

    def validate_image(self, image):
        # Reuse the same image validation rules as the full pipeline.
        return ImageUploadSerializer().validate_image(image)


class PriceFromGradeSerializer(serializers.Serializer):
    """Pricing request that uses an existing grading_session_id + market context."""

    grading_session_id = serializers.UUIDField()
    market_location = serializers.ChoiceField(
        choices=FeatureImputer.get_market_list(),
        help_text="Which Zimbabwe market are you selling at?",
    )
    month = serializers.ChoiceField(
        choices=MONTH_CHOICES,
        help_text="Which month will the sale take place?",
    )
    market_type = serializers.ChoiceField(
        choices=MARKET_TYPE_CHOICES,
        help_text="Are you selling Retail, Wholesale, or Farm Gate?",
    )
    farm_lat = serializers.FloatField(
        required=False, allow_null=True, default=None,
        min_value=-90.0, max_value=90.0,
    )
    farm_lon = serializers.FloatField(
        required=False, allow_null=True, default=None,
        min_value=-180.0, max_value=180.0,
    )

    def validate(self, data):
        lat = data.get("farm_lat")
        lon = data.get("farm_lon")
        if (lat is None) != (lon is None):
            raise serializers.ValidationError(
                "Both farm_lat and farm_lon must be provided together, or both omitted."
            )
        return data


# ─────────────────────────────────────────────────────────────────────────────
# RESPONSE SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

class GradingResultSerializer(serializers.Serializer):
    """Serialises the grading model output section of the pipeline response."""
    grade              = serializers.CharField()
    grade_code         = serializers.CharField()
    confidence         = serializers.FloatField()
    confidence_level   = serializers.CharField()
    description        = serializers.CharField()
    marketable         = serializers.BooleanField()
    color_hint         = serializers.CharField()
    all_probabilities  = serializers.DictField(child=serializers.FloatField())
    inference_time_ms  = serializers.FloatField()
    model_version      = serializers.CharField()
    manual_review      = serializers.BooleanField()


class PricingResultSerializer(serializers.Serializer):
    """Serialises the pricing model output section of the pipeline response."""
    predicted_price_usd_per_kg = serializers.FloatField()
    price_range_low            = serializers.FloatField()
    price_range_high           = serializers.FloatField()
    currency                   = serializers.CharField()
    model_version              = serializers.CharField()
    grade_label                = serializers.CharField()
    inference_time_ms          = serializers.FloatField()


class PipelineResponseSerializer(serializers.Serializer):
    """
    The unified response returned by POST /api/v1/grade-and-price/.

    Contains every piece of information the React Native app needs:
      - The grade result (with confidence)
      - The price estimate (with confidence interval)
      - All imputed features (so the app can display them transparently)
      - The resolution log (for audit / user transparency UI)
      - Both session UUIDs (for history and feedback endpoints)
    """
    # Session identifiers
    grading_session_id = serializers.UUIDField()
    pricing_session_id = serializers.UUIDField()

    # Model outputs
    grading = GradingResultSerializer()
    pricing = PricingResultSerializer()

    # What the user provided
    user_inputs = serializers.DictField()

    # What the system resolved automatically
    imputed_features = serializers.DictField()
    resolution_log   = serializers.DictField()
    warnings         = serializers.ListField(child=serializers.CharField())

    # Timing
    total_pipeline_time_ms = serializers.FloatField()
    created_at             = serializers.DateTimeField()


# ─────────────────────────────────────────────────────────────────────────────
# HISTORY SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

class GradingSessionSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    has_pricing = serializers.SerializerMethodField()

    class Meta:
        model = GradingSession
        fields = [
            "id", "predicted_grade", "grade_code", "confidence",
            "confidence_level", "marketable", "manual_review",
            "model_version", "inference_time_ms", "created_at", "image_url",
            "has_pricing",
        ]

    def get_image_url(self, obj) -> str | None:
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_has_pricing(self, obj) -> bool:
        return hasattr(obj, "pricing_session")


class PricingSessionSerializer(serializers.ModelSerializer):
    grade_code    = serializers.CharField(source="grading_session.grade_code", read_only=True)
    grade         = serializers.CharField(source="grading_session.predicted_grade", read_only=True)
    confidence    = serializers.FloatField(source="grading_session.confidence", read_only=True)
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model = PricingSession
        fields = [
            "id", "grading_session_id",
            "grade_code", "grade", "confidence",
            "market_location", "month", "market_type",
            "predicted_price", "price_range_low", "price_range_high", "currency",
            "pricing_model_version", "total_pipeline_time_ms",
            "created_at", "image_url",
        ]

    def get_image_url(self, obj) -> str | None:
        request = self.context.get("request")
        gs = obj.grading_session
        if gs and gs.image and request:
            return request.build_absolute_uri(gs.image.url)
        return None


class PricingSessionDetailSerializer(PricingSessionSerializer):
    """Adds imputed_features and resolution_log for detail endpoint."""
    class Meta(PricingSessionSerializer.Meta):
        fields = PricingSessionSerializer.Meta.fields + [
            "imputed_features", "resolution_log", "imputation_warnings",
            "farm_lat", "farm_lon",
        ]


# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

class GradingFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradingFeedback
        fields = ["session", "correct_grade", "notes"]

    def validate_session(self, value):
        if hasattr(value, "feedback"):
            raise serializers.ValidationError(
                "Feedback has already been submitted for this grading session."
            )
        return value


class PricingFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingFeedback
        fields = ["session", "actual_price", "notes"]

    def validate_session(self, value):
        if hasattr(value, "feedback"):
            raise serializers.ValidationError(
                "Feedback has already been submitted for this pricing session."
            )
        return value

    def validate_actual_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Actual price must be greater than 0.")
        if value > 20:
            raise serializers.ValidationError(
                "Actual price seems unrealistically high. Maximum accepted: $20/kg."
            )
        return value


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS & MARKET DATA SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

class AnalyticsSerializer(serializers.Serializer):
    period = serializers.CharField()
    total_grading_sessions = serializers.IntegerField()
    total_pricing_sessions = serializers.IntegerField()
    grade_distribution     = serializers.DictField(child=serializers.IntegerField())
    average_confidence     = serializers.FloatField()
    marketable_rate        = serializers.FloatField()
    average_price_by_grade = serializers.DictField(child=serializers.FloatField())
    top_markets            = serializers.ListField(child=serializers.DictField())
    price_trend_monthly    = serializers.ListField(child=serializers.DictField())


class MarketDataSerializer(serializers.Serializer):
    """Returns available markets + months for frontend dropdowns."""
    markets      = serializers.ListField(child=serializers.CharField())
    months       = serializers.ListField(child=serializers.CharField())
    market_types = serializers.ListField(child=serializers.CharField())


class HealthCheckSerializer(serializers.Serializer):
    status           = serializers.CharField()
    pipeline_healthy = serializers.BooleanField()
    grading_model    = serializers.DictField()
    pricing_model    = serializers.DictField()
    timestamp        = serializers.DateTimeField()
    version          = serializers.CharField()


# ─────────────────────────────────────────────────────────────────────────────
# AUTH SERIALIZERS
# ─────────────────────────────────────────────────────────────────────────────

import re
from django.core.validators import RegexValidator
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import EmailVerification, TwoFactorAuth, LoginAttempt, UserProfile, Product, ProductImage


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Enhanced user registration with comprehensive validation."""
    
    password = serializers.CharField(
        write_only=True, 
        min_length=8,
        validators=[validate_password],
        help_text="Password must be at least 8 characters long and contain letters, numbers, and special characters."
    )
    password2 = serializers.CharField(write_only=True, label="Confirm password")
    
    # Phone number validation for Zimbabwe
    phone = serializers.CharField(
        required=True,
        validators=[
            RegexValidator(
                regex=r'^(\+263|0)[67]\d{8}$',
                message="Enter a valid Zimbabwean phone number (e.g., +263712345678 or 0712345678)"
            )
        ],
        help_text="Enter your Zimbabwean phone number"
    )
    
    # Role selection
    ROLE_CHOICES = [
        ('farmer', 'Farmer'),
        ('buyer', 'Buyer'),
    ]
    role = serializers.ChoiceField(choices=ROLE_CHOICES, required=True)
    
    # Location information
    county = serializers.CharField(max_length=100, required=True)
    location = serializers.CharField(max_length=200, required=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password2', 
            'first_name', 'last_name', 'phone', 'role', 'county', 'location'
        ]

    def validate_email(self, value):
        """Validate email format and uniqueness."""
        # Basic email format validation
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Enter a valid email address.")
        
        # Check uniqueness
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email address is already registered.")
        return value.lower()  # Store emails in lowercase

    def validate_name(self, value):
        """Backward compatibility: some clients may send a single 'name' field."""
        if value is None:
            return value
        if not str(value).strip():
            raise serializers.ValidationError("Name cannot be empty.")
        return str(value).strip()

    def validate_username(self, value):
        """Validate username format and uniqueness."""
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        
        # Allow alphanumeric, underscores, and hyphens
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            raise serializers.ValidationError("Username can only contain letters, numbers, underscores, and hyphens.")
        
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value.lower()

    def validate_phone(self, value):
        """Normalize phone number to international format."""
        # Remove any non-digit characters
        digits = re.sub(r'\D', '', value)
        
        # Convert to Zimbabwe international format (+263)
        if digits.startswith('263'):
            return f"+{digits}"
        if digits.startswith('0'):
            return f"+263{digits[1:]}"
        return f"+263{digits}"

    def validate(self, data):
        """Cross-field validation."""
        # Password confirmation
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({
                "password2": "Passwords do not match."
            })

        # Ensure first_name is provided; last_name is optional
        if not data.get('first_name'):
            raise serializers.ValidationError({
                "first_name": "First name is required."
            })
        
        return data

    def create(self, validated_data):
        """Create user with enhanced security."""
        validated_data.pop("password2")
        phone = validated_data.pop("phone", "")
        role = validated_data.pop("role")
        county = validated_data.pop("county")
        location = validated_data.pop("location")
        
        # Create user
        user = User.objects.create_user(**validated_data)

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "phone": phone,
                "role": role,
                "county": county,
                "location": location,
            },
        )
        
        # Set up email verification
        EmailVerification.generate_verification(user)
        
        # Set up 2FA
        TwoFactorAuth.setup_for_user(user)
        
        return user


class LoginSerializer(serializers.Serializer):
    """Enhanced login with comprehensive validation."""
    
    email = serializers.EmailField(
        help_text="Enter your registered email address"
    )
    password = serializers.CharField(
        write_only=True,
        help_text="Enter your password"
    )
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower()


class TwoFactorSetupSerializer(serializers.Serializer):
    """Serializer for enabling 2FA."""
    
    method = serializers.ChoiceField(
        choices=['email'],
        help_text="Choose 2FA method (currently email only)"
    )
    
    def validate_method(self, value):
        """Validate 2FA method is supported."""
        if value not in ['email']:
            raise serializers.ValidationError("Only email-based 2FA is currently supported.")
        return value


class TwoFactorVerifySerializer(serializers.Serializer):
    """Serializer for 2FA token verification."""
    
    token = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="Enter the 6-digit code sent to your email"
    )
    backup_code = serializers.CharField(
        required=False,
        max_length=8,
        min_length=8,
        help_text="Use backup code if you can't access email"
    )
    
    def validate(self, data):
        """Ensure either token or backup code is provided."""
        if not data.get('token') and not data.get('backup_code'):
            raise serializers.ValidationError(
                "Either 2FA token or backup code must be provided."
            )
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset requests."""
    
    email = serializers.EmailField(
        help_text="Enter your registered email address"
    )
    
    def validate_email(self, value):
        """Check if email exists in system."""
        if not User.objects.filter(email__iexact=value).exists():
            # Don't reveal if email exists or not for security
            return value.lower()
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""
    
    token = serializers.UUIDField(help_text="Password reset token")
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password],
        help_text="Enter your new password"
    )
    new_password2 = serializers.CharField(
        write_only=True,
        help_text="Confirm your new password"
    )
    
    def validate(self, data):
        """Validate password confirmation."""
        if data["new_password"] != data["new_password2"]:
            raise serializers.ValidationError({
                "new_password2": "Passwords do not match."
            })
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Enhanced user profile serializer."""
    
    phone = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    county = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    is_email_verified = serializers.SerializerMethodField()
    two_factor_enabled = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'role', 'county', 'location', 'date_joined',
            'is_email_verified', 'two_factor_enabled'
        ]
        read_only_fields = ['id', 'username', 'email', 'date_joined']
    
    def get_phone(self, obj):
        """Get user phone number from profile."""
        prof = getattr(obj, "profile", None)
        return getattr(prof, "phone", None)
    
    def get_role(self, obj):
        """Get user role."""
        prof = getattr(obj, "profile", None)
        return getattr(prof, "role", None)
    
    def get_county(self, obj):
        """Get user county."""
        prof = getattr(obj, "profile", None)
        return getattr(prof, "county", None)
    
    def get_location(self, obj):
        """Get user location."""
        prof = getattr(obj, "profile", None)
        return getattr(prof, "location", None)

    def get_is_email_verified(self, obj):
        """Check if email is verified."""
        try:
            return obj.email_verification.is_verified
        except EmailVerification.DoesNotExist:
            return False

    def get_two_factor_enabled(self, obj):
        """Check if 2FA is enabled."""
        try:
            return obj.two_factor.is_enabled
        except TwoFactorAuth.DoesNotExist:
            return False


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField()

    class Meta:
        model = ProductImage
        fields = ["id", "image", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    farmerId = serializers.CharField(source="farmer.id", read_only=True)
    farmerName = serializers.CharField(source="farmer.get_full_name", read_only=True)
    farmerLocation = serializers.CharField(source="farmer_location", read_only=True)
    farmerAvatar = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    isOrganic = serializers.BooleanField(source="is_organic")
    harvestDate = serializers.DateField(source="harvest_date")
    listedDate = serializers.SerializerMethodField()
    coordinates = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "farmerId",
            "farmerName",
            "farmerLocation",
            "farmerAvatar",
            "name",
            "category",
            "description",
            "price",
            "unit",
            "quantity",
            "images",
            "rating",
            "reviews",
            "isOrganic",
            "harvestDate",
            "listedDate",
            "county",
            "coordinates",
        ]

    def get_farmerAvatar(self, obj):
        name = obj.farmer.get_full_name() or obj.farmer.username
        safe = "".join(str(name).split())
        return f"https://api.dicebear.com/7.x/avataaars/png?seed={safe}"

    def get_images(self, obj):
        request = self.context.get("request")
        urls = []
        for img in obj.images.all():
            if not img.image:
                continue
            url = img.image.url
            if request is not None:
                url = request.build_absolute_uri(url)
            urls.append(url)
        return urls

    def get_listedDate(self, obj):
        if not obj.listed_at:
            return None
        return obj.listed_at.date().isoformat()

    def get_coordinates(self, obj):
        if obj.lat is None or obj.lng is None:
            return {"lat": -17.865, "lng": 31.0506}
        return {"lat": obj.lat, "lng": obj.lng}


class ProductCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    category = serializers.CharField(max_length=100)
    description = serializers.CharField()
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    unit = serializers.CharField(max_length=30)
    quantity = serializers.IntegerField(min_value=1)
    isOrganic = serializers.BooleanField(required=False, default=False)
    county = serializers.CharField(max_length=100)
    harvestDate = serializers.DateField(required=False)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
    )


class LoginAttemptSerializer(serializers.ModelSerializer):
    """Serializer for login attempt tracking."""
    
    class Meta:
        model = LoginAttempt
        fields = ['email', 'ip_address', 'was_successful', 'failure_reason', 'created_at']
        read_only_fields = ['email', 'ip_address', 'was_successful', 'failure_reason', 'created_at']


class CountySerializer(serializers.ModelSerializer):
    """Serializer for County model."""
    
    class Meta:
        model = County
        fields = ['id', 'name', 'code', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductCategorySerializer(serializers.ModelSerializer):
    """Serializer for ProductCategory model."""
    
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class FarmerProfileSerializer(serializers.ModelSerializer):
    """Serializer for FarmerProfile model."""
    farmer_name = serializers.CharField(read_only=True)
    avatar_url = serializers.CharField(read_only=True)
    county_name = serializers.CharField(source='county.name', read_only=True)
    
    class Meta:
        model = FarmerProfile
        fields = [
            'id', 'user', 'business_name', 'location', 'county', 'county_name',
            'crops', 'rating', 'total_reviews', 'is_verified', 'coordinates',
            'farm_size', 'years_experience', 'business_phone', 'business_email',
            'website', 'social_media', 'certifications', 'active_listings',
            'total_sales', 'response_rate', 'avg_response_time',
            'farmer_name', 'avatar_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'rating', 'total_reviews', 'active_listings', 
                           'total_sales', 'response_rate', 'avg_response_time',
                           'farmer_name', 'avatar_url', 'created_at', 'updated_at']


class FarmerProfileListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for farmer directory listings."""
    farmer_name = serializers.CharField(read_only=True)
    name = serializers.CharField(source='farmer_name', read_only=True)
    avatar_url = serializers.CharField(read_only=True)
    county_name = serializers.CharField(source='county.name', read_only=True)
    phone = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    
    class Meta:
        model = FarmerProfile
        fields = [
            'id', 'name', 'farmer_name', 'avatar_url', 'location', 'county', 'county_name',
            'crops', 'rating', 'total_reviews', 'is_verified', 'coordinates',
            'active_listings', 'phone', 'email', 'created_at'
        ]
        read_only_fields = ['id', 'name', 'farmer_name', 'avatar_url', 'county_name',
                           'rating', 'total_reviews', 'active_listings', 'phone', 'email', 'created_at']

    def get_phone(self, obj):
        """Get farmer's contact phone (business phone or user phone)"""
        return obj.business_phone or (obj.user.profile.phone if hasattr(obj.user, 'profile') and obj.user.profile.phone else '')

    def get_email(self, obj):
        """Get farmer's contact email (business email or user email)"""
        return obj.business_email or obj.user.email


# ─────────────────────────────────────────────────────────────────────────────
# PASSWORD RESET SERIALIZERS (2FA-based flow)
# ─────────────────────────────────────────────────────────────────────────────

class ForgotPasswordSerializer(serializers.Serializer):
    """
    Serializer for initiating password reset request.
    
    Security: This endpoint will ALWAYS return success (200) regardless of whether
    the email exists, preventing email enumeration attacks.
    """
    
    email = serializers.EmailField(
        help_text="Enter your registered email address"
    )
    
    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower()


class EmailVerificationCodeSerializer(serializers.Serializer):
    """
    Serializer for verifying account activation code (from registration email).
    """

    email = serializers.EmailField(
        help_text="Email associated with the account"
    )
    code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="6-digit verification code sent to email"
    )

    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower()


class PasswordResetVerifyCodeSerializer(serializers.Serializer):
    """
    Serializer for verifying 2FA code during password reset.
    
    After user receives email with 2FA code (no URL exposed),
    they enter the code here to confirm their identity.
    """
    
    email = serializers.EmailField(
        help_text="Email associated with the account"
    )
    token = serializers.UUIDField(
        help_text="Password reset token received from first request"
    )
    code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="6-digit verification code sent to email"
    )
    
    def validate_email(self, value):
        """Normalize email."""
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Serializer for confirming new password after 2FA verification.
    
    This endpoint is called AFTER the code has been verified.
    User provides their new password.
    """
    
    email = serializers.EmailField(
        help_text="Email associated with the account"
    )
    token = serializers.UUIDField(
        help_text="Password reset token"
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password],
        help_text="Enter your new password (minimum 8 characters)"
    )
    new_password2 = serializers.CharField(
        write_only=True,
        help_text="Confirm your new password"
    )
    
    def validate(self, data):
        """Validate password confirmation."""
        if data["new_password"] != data["new_password2"]:
            raise serializers.ValidationError({
                "new_password2": "Passwords do not match."
            })
        return data
    
    def validate_email(self, value):
        """Normalize email."""
        return value.lower()
