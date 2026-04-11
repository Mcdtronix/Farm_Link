"""
tomato_grading_api/urls.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL Routes — v2 Pipeline API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All routes are under /api/v1/ (configured in tomato_api/urls.py).

PRIMARY ENDPOINT
────────────────
  POST  grade-and-price/            Full pipeline: image → grade + price

SUPPORTING
──────────
  GET   market-data/                Dropdown options (public)
  GET   health/                     System health check (public)
  GET   analytics/                  Aggregate stats for current user

HISTORY
───────
  GET   history/grading/            Grading sessions list
  GET   history/grading/<uuid>/     Grading session detail
  DEL   history/grading/<uuid>/     Delete grading session
  GET   history/pricing/            Pricing sessions list
  GET   history/pricing/<uuid>/     Pricing session detail (+ imputed_features)

FEEDBACK
────────
  POST  feedback/grading/           Submit grade correction
  POST  feedback/pricing/           Submit actual price correction

AUTH
────
  POST  auth/register/              Create account
  POST  auth/login/                 Obtain JWT tokens
  POST  auth/refresh/               Refresh access token
  POST  auth/logout/                Blacklist refresh token
  GET   auth/me/                    Current user profile
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    GradeAndPriceView,
    GradeOnlyView,
    PriceFromGradeView,
    MarketDataView,
    HealthCheckView,
    AnalyticsView,
    GradingHistoryListView,
    GradingHistoryDetailView,
    PricingHistoryListView,
    PricingHistoryDetailView,
    GradingFeedbackView,
    PricingFeedbackView,
    RegisterView,
    LoginView,
    TwoFactorLoginView,
    VerifyEmailView,
    VerifyEmailCodeView,
    ResendVerificationView,
    SetupTwoFactorView,
    VerifyTwoFactorSetupView,
    LogoutView,
    UserProfileView,
    ForgotPasswordView,
    PasswordResetVerifyCodeView,
    PasswordResetConfirmView,
    ProductListCreateView,
    ProductDetailView,
    UserDetailView,
    FeedbackListView,
    CountyListView,
    ProductCategoryListView,
    FarmerDirectoryView,
    FarmerDetailView,
    MyFarmerProfileView,
    MarketPriceListView,
)

app_name = "v1"

urlpatterns = [

    # ── Primary pipeline ──────────────────────────────────────────────────────
    path(
        "grade-and-price/",
        GradeAndPriceView.as_view(),
        name="grade-and-price",
    ),

    # ── ML testing (grade first → optional pricing) ──────────────────────────
    path("ml/grade/", GradeOnlyView.as_view(), name="ml-grade"),
    path("ml/price/", PriceFromGradeView.as_view(), name="ml-price"),

    # ── Supporting ────────────────────────────────────────────────────────────
    path("market-data/",   MarketDataView.as_view(),   name="market-data"),
    path("health/",        HealthCheckView.as_view(),  name="health"),
    path("analytics/",     AnalyticsView.as_view(),    name="analytics"),

    # ── Marketplace ──────────────────────────────────────────────────────────
    path("products/", ProductListCreateView.as_view(), name="products"),
    path("products/<uuid:pk>/", ProductDetailView.as_view(), name="product-detail"),
    path("users/<uuid:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("feedback/<str:feedback_type>/", FeedbackListView.as_view(), name="feedback-list"),
    
    # ── Farmer Directory ─────────────────────────────────────────────────────
    path("farmers/", FarmerDirectoryView.as_view(), name="farmer-directory"),
    path("farmers/<uuid:pk>/", FarmerDetailView.as_view(), name="farmer-detail"),
    path("my-farmer-profile/", MyFarmerProfileView.as_view(), name="my-farmer-profile"),
    
    # ── Geographic & Category Data ───────────────────────────────────────────
    path("counties/", CountyListView.as_view(), name="county-list"),
    path("categories/", ProductCategoryListView.as_view(), name="category-list"),
    path("market-prices/", MarketPriceListView.as_view(), name="market-prices"),

    # ── Grading history ───────────────────────────────────────────────────────
    path(
        "history/grading/",
        GradingHistoryListView.as_view(),
        name="grading-history-list",
    ),
    path(
        "history/grading/<uuid:pk>/",
        GradingHistoryDetailView.as_view(),
        name="grading-history-detail",
    ),

    # ── Pricing history ───────────────────────────────────────────────────────
    path(
        "history/pricing/",
        PricingHistoryListView.as_view(),
        name="pricing-history-list",
    ),
    path(
        "history/pricing/<uuid:pk>/",
        PricingHistoryDetailView.as_view(),
        name="pricing-history-detail",
    ),

    # ── Feedback ──────────────────────────────────────────────────────────────
    path(
        "feedback/grading/",
        GradingFeedbackView.as_view(),
        name="feedback-grading",
    ),
    path(
        "feedback/pricing/",
        PricingFeedbackView.as_view(),
        name="feedback-pricing",
    ),

    # ── Auth ──────────────────────────────────────────────────────────────────
    path("auth/register/",               RegisterView.as_view(),               name="auth-register"),
    path("auth/login/",                  LoginView.as_view(),                  name="auth-login"),
    path("auth/2fa/",                   TwoFactorLoginView.as_view(),         name="auth-2fa"),
    path("auth/verify-email/<uuid:token>/", VerifyEmailView.as_view(),          name="auth-verify-email"),
    path("auth/verify-email-code/",       VerifyEmailCodeView.as_view(),       name="auth-verify-email-code"),
    path("auth/resend-verification/",     ResendVerificationView.as_view(),    name="auth-resend-verification"),
    path("auth/setup-2fa/",              SetupTwoFactorView.as_view(),         name="auth-setup-2fa"),
    path("auth/verify-2fa-setup/",       VerifyTwoFactorSetupView.as_view(),    name="auth-verify-2fa-setup"),
    path("auth/refresh/",                TokenRefreshView.as_view(),            name="auth-refresh"),
    path("auth/logout/",                 LogoutView.as_view(),                  name="auth-logout"),
    path("auth/me/",                     UserProfileView.as_view(),             name="auth-me"),
    
    # ── Password Reset (2FA-based flow) ──────────────────────────────────────
    path("auth/forgot-password/",               ForgotPasswordView.as_view(),               name="auth-forgot-password"),
    path("auth/password-reset/verify-code/",   PasswordResetVerifyCodeView.as_view(),     name="auth-password-reset-verify-code"),
    path("auth/password-reset/confirm/",       PasswordResetConfirmView.as_view(),        name="auth-password-reset-confirm"),
]
