"""
tomato_grading_api/models.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database Models — Grading + Pricing Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Six models:
  1. GradingSession   — one grading event (image → grade)
  2. PricingSession   — one pricing event (features → price)
                        ALWAYS linked to a GradingSession via FK
  3. BatchSession     — groups multiple GradingSessions
  4. GradingFeedback  — user correction of a grade
  5. PricingFeedback  — user correction of a price
  6. ModelVersion     — registry of deployed model versions

Key design decisions:
  • PricingSession.grading_session is a non-null FK — you cannot price
    a tomato without first grading it.  This enforces the pipeline.
  • resolution_log (JSONField) stores exactly how every pricing feature
    was resolved, giving full auditability per prediction.
  • imputed_features (JSONField) stores all 18 features for offline
    model analysis and retraining pipelines.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.contrib.gis.db import models


# ─────────────────────────────────────────────────────────────────────────────
# GRADING SESSION
# ─────────────────────────────────────────────────────────────────────────────

class GradingSession(models.Model):
    """Records a single image → grade prediction event."""

    GRADE_CHOICES = [
        ("A",      "Grade A — Premium"),
        ("B",      "Grade B — Good"),
        ("C",      "Grade C — Fair"),
        ("Reject", "Reject"),
    ]
    CONFIDENCE_CHOICES = [
        ("high",   "High (≥85%)"),
        ("medium", "Medium (60–85%)"),
        ("low",    "Low (<60%)"),
    ]

    # ── Identity ──────────────────────────────────────────────────────────────
    id   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="grading_sessions",
    )
    batch = models.ForeignKey(
        "BatchSession", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="grading_sessions",
    )

    # ── Input ─────────────────────────────────────────────────────────────────
    image = models.ImageField(upload_to="grading/%Y/%m/%d/", max_length=500)

    # ── Prediction Output ─────────────────────────────────────────────────────
    predicted_grade    = models.CharField(max_length=10, choices=GRADE_CHOICES)
    grade_code         = models.CharField(max_length=6)   # "A", "B", "C", "Reject"
    confidence         = models.FloatField()               # 0–100 %
    confidence_level   = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES)
    all_probabilities  = models.JSONField(default=dict)
    inference_time_ms  = models.FloatField(default=0.0)
    model_version      = models.CharField(max_length=20, default="1.0.0")
    manual_review      = models.BooleanField(default=False)
    marketable         = models.BooleanField(default=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["predicted_grade"]),
        ]

    def __str__(self) -> str:
        return f"GradingSession({self.grade_code} {self.confidence:.1f}% @ {self.created_at:%Y-%m-%d %H:%M})"


# ─────────────────────────────────────────────────────────────────────────────
# PRICING SESSION  — linked to GradingSession (pipeline FK)
# ─────────────────────────────────────────────────────────────────────────────

class PricingSession(models.Model):
    """
    Records a single pricing prediction event.

    Always linked to a parent GradingSession — the pipeline requires
    a grade before pricing can occur.  The 5 user inputs and all 13
    imputed features are stored for full auditability.
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pricing_sessions",
    )
    grading_session = models.OneToOneField(
        GradingSession, on_delete=models.CASCADE,
        related_name="pricing_session",
        help_text="The grading event that supplied the grade for this pricing prediction.",
    )

    # ── 5 User-Supplied Inputs ────────────────────────────────────────────────
    market_location = models.CharField(max_length=150)
    month           = models.CharField(max_length=20)
    market_type     = models.CharField(max_length=30)
    farm_lat        = models.FloatField(null=True, blank=True)
    farm_lon        = models.FloatField(null=True, blank=True)

    # ── Imputed Features (all 13 auto-resolved) ───────────────────────────────
    imputed_features = models.JSONField(
        default=dict,
        help_text="All 18 pricing model features after imputation.",
    )
    resolution_log = models.JSONField(
        default=dict,
        help_text="Per-feature source tags (user_input | rule_based | geo_lookup | historical_mode | statistical_default | haversine_calculation).",
    )
    imputation_warnings = models.JSONField(
        default=list,
        help_text="Any warnings raised during feature imputation.",
    )

    # ── Prediction Output ─────────────────────────────────────────────────────
    predicted_price   = models.FloatField(
        help_text="Point estimate in USD/kg."
    )
    price_range_low   = models.FloatField(
        help_text="Lower bound of confidence interval in USD/kg."
    )
    price_range_high  = models.FloatField(
        help_text="Upper bound of confidence interval in USD/kg."
    )
    currency          = models.CharField(max_length=5, default="USD")
    pricing_model_version = models.CharField(max_length=20, default="1.0.0")
    inference_time_ms = models.FloatField(default=0.0)

    # ── Pipeline Metadata ─────────────────────────────────────────────────────
    total_pipeline_time_ms = models.FloatField(
        default=0.0,
        help_text="Total elapsed time for the full Grade+Impute+Price pipeline.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["market_location"]),
            models.Index(fields=["market_type"]),
        ]

    def __str__(self) -> str:
        grade = self.grading_session.grade_code if self.grading_session_id else "?"
        return (
            f"PricingSession(grade={grade} price={self.predicted_price:.2f} "
            f"USD @ {self.market_location} {self.created_at:%Y-%m-%d})"
        )

    @property
    def grade_code(self) -> str:
        return self.grading_session.grade_code if self.grading_session_id else ""

    @property
    def price_display(self) -> str:
        return f"${self.predicted_price:.2f}/kg (${self.price_range_low:.2f}–${self.price_range_high:.2f})"


# ─────────────────────────────────────────────────────────────────────────────
# BATCH SESSION
# ─────────────────────────────────────────────────────────────────────────────

class BatchSession(models.Model):
    """Groups multiple GradingSessions submitted together."""

    STATUS_CHOICES = [
        ("pending",    "Pending"),
        ("processing", "Processing"),
        ("completed",  "Completed"),
        ("failed",     "Failed"),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="batch_sessions",
    )
    name         = models.CharField(max_length=200, blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)
    total_images = models.IntegerField(default=0)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"BatchSession({self.name or self.id} {self.status} {self.total_images} imgs)"

    @property
    def grade_summary(self) -> dict:
        from django.db.models import Count
        return dict(
            self.grading_sessions
            .values("predicted_grade")
            .annotate(count=Count("id"))
            .values_list("predicted_grade", "count")
        )

    @property
    def marketable_count(self) -> int:
        return self.grading_sessions.filter(marketable=True).count()

    @property
    def reject_count(self) -> int:
        return self.grading_sessions.filter(marketable=False).count()


# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK MODELS
# ─────────────────────────────────────────────────────────────────────────────

class GradingFeedback(models.Model):
    """Captures a user correction to a grading prediction."""

    GRADE_CHOICES = GradingSession.GRADE_CHOICES

    session      = models.OneToOneField(GradingSession, on_delete=models.CASCADE, related_name="feedback")
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    correct_grade = models.CharField(max_length=10, choices=GRADE_CHOICES)
    model_was_wrong = models.BooleanField(default=False)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs) -> None:
        self.model_was_wrong = (
            self.correct_grade != self.session.grade_code
        )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        flag = "✗ WRONG" if self.model_was_wrong else "✓ correct"
        return f"GradingFeedback({flag}: predicted={self.session.grade_code} actual={self.correct_grade})"


class PricingFeedback(models.Model):
    """Captures a user correction to a pricing prediction (actual market price)."""

    session         = models.OneToOneField(PricingSession, on_delete=models.CASCADE, related_name="feedback")
    submitted_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    actual_price    = models.FloatField(help_text="Actual price the tomatoes sold for (USD/kg)")
    price_was_wrong = models.BooleanField(default=False)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs) -> None:
        # Flag if actual price was >20% away from predicted
        predicted = self.session.predicted_price
        if predicted > 0:
            error_pct = abs(self.actual_price - predicted) / predicted * 100
            self.price_was_wrong = error_pct > 20.0
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"PricingFeedback(predicted=${self.session.predicted_price:.2f} "
            f"actual=${self.actual_price:.2f})"
        )


# ─────────────────────────────────────────────────────────────────────────────
# MODEL VERSION REGISTRY
# ─────────────────────────────────────────────────────────────────────────────

class ModelVersion(models.Model):
    """Registry of deployed ML model versions."""

    MODEL_TYPE_CHOICES = [
        ("grading", "Grading Model (Random Forest)"),
        ("pricing", "Pricing Model (XGBoost/LightGBM)"),
    ]

    version     = models.CharField(max_length=20, unique=True)
    model_type  = models.CharField(max_length=20, choices=MODEL_TYPE_CHOICES)
    accuracy    = models.FloatField(null=True, blank=True, help_text="Test accuracy (grading) or R² (pricing)")
    f1_score    = models.FloatField(null=True, blank=True)
    rmse        = models.FloatField(null=True, blank=True, help_text="RMSE USD/kg (pricing only)")
    mape        = models.FloatField(null=True, blank=True, help_text="MAPE % (pricing only)")
    is_active   = models.BooleanField(default=False)
    model_file  = models.CharField(max_length=255)
    notes       = models.TextField(blank=True)
    deployed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-deployed_at"]

    def __str__(self) -> str:
        active = " [ACTIVE]" if self.is_active else ""
        return f"ModelVersion({self.model_type} v{self.version}{active})"


# ─────────────────────────────────────────────────────────────────────────────
# AUTHENTICATION MODELS
# ─────────────────────────────────────────────────────────────────────────────

class EmailVerification(models.Model):
    """Stores email verification codes for user registration."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_verification')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    verification_code = models.CharField(max_length=6, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self) -> str:
        return f"EmailVerification({self.user.username} - {'Verified' if self.is_verified else 'Pending'})"
    
    def is_expired(self) -> bool:
        if not self.expires_at:
            return True
        return timezone.now() > self.expires_at
    
    def is_code_expired(self) -> bool:
        if not self.created_at:
            return True
        expiry_hours = getattr(settings, 'EMAIL_VERIFICATION_CODE_EXPIRE_HOURS', 24)
        return timezone.now() > self.created_at + timezone.timedelta(hours=expiry_hours)

    def generate_code(self) -> str:
        import random
        code = f"{random.randint(100000, 999999)}"
        self.verification_code = code
        self.token = uuid.uuid4()
        self.is_verified = False
        self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        self.created_at = timezone.now()
        self.save(update_fields=['verification_code', 'token', 'is_verified', 'expires_at', 'created_at'])
        return code

    def verify_code(self, code: str) -> bool:
        if self.is_verified:
            return True
        if self.is_expired() or self.is_code_expired():
            return False
        if self.verification_code == code:
            self.is_verified = True
            self.verification_code = ""
            self.save(update_fields=['is_verified', 'verification_code'])
            return True
        return False

    @classmethod
    def generate_verification(cls, user):
        """Generate or regenerate email verification for user."""
        verification, created = cls.objects.update_or_create(
            user=user,
            defaults={
                'token': uuid.uuid4(),
                'verification_code': '',
                'is_verified': False,
                'expires_at': timezone.now() + timezone.timedelta(hours=24)
            }
        )
        code = verification.generate_code()
        return verification


class TwoFactorAuth(models.Model):
    """Stores two-factor authentication settings and tokens."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='two_factor')
    is_enabled = models.BooleanField(default=False)
    backup_codes = models.JSONField(default=list, blank=True)
    
    # For email-based 2FA
    email_token = models.CharField(max_length=6, blank=True)
    email_token_created_at = models.DateTimeField(null=True, blank=True)
    
    # Rate limiting
    failed_attempts = models.IntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)
    
    def __str__(self) -> str:
        return f"TwoFactorAuth({self.user.username} - {'Enabled' if self.is_enabled else 'Disabled'})"
    
    def is_locked(self) -> bool:
        """Check if 2FA is temporarily locked due to failed attempts."""
        if self.locked_until:
            return timezone.now() < self.locked_until
        return False
    
    def is_email_token_expired(self) -> bool:
        """Check if email 2FA token has expired."""
        if not self.email_token_created_at:
            return True
        expiry_minutes = getattr(settings, 'TWO_FACTOR_TOKEN_EXPIRE_MINUTES', 10)
        return timezone.now() > self.email_token_created_at + timezone.timedelta(minutes=expiry_minutes)
    
    def can_attempt_2fa(self) -> bool:
        """Check if user can attempt 2FA verification."""
        if self.is_locked():
            return False
        max_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3)
        return self.failed_attempts < max_attempts
    
    def generate_email_token(self) -> str:
        """Generate a new 6-digit email 2FA token."""
        import random
        token = f"{random.randint(100000, 999999)}"
        self.email_token = token
        self.email_token_created_at = timezone.now()
        self.save(update_fields=['email_token', 'email_token_created_at'])
        return token
    
    def verify_email_token(self, token: str) -> bool:
        """Verify the provided email 2FA token."""
        if not self.can_attempt_2fa():
            return False
        
        if self.is_email_token_expired():
            return False
        
        if self.email_token == token:
            self.failed_attempts = 0
            self.email_token = ''
            self.email_token_created_at = None
            self.save(update_fields=['failed_attempts', 'email_token', 'email_token_created_at'])
            return True
        else:
            self.failed_attempts += 1
            self.last_attempt_at = timezone.now()
            
            # Lock account if max attempts reached
            max_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3)
            if self.failed_attempts >= max_attempts:
                self.locked_until = timezone.now() + timezone.timedelta(minutes=15)
            
            self.save(update_fields=['failed_attempts', 'last_attempt_at', 'locked_until'])
            return False
    
    @classmethod
    def setup_for_user(cls, user):
        """Set up 2FA for a new user."""
        two_factor, created = cls.objects.get_or_create(
            user=user,
            defaults={
                'backup_codes': cls.generate_backup_codes()
            }
        )
        return two_factor
    
    @staticmethod
    def generate_backup_codes() -> list:
        """Generate 10 backup codes for 2FA."""
        import random
        return [f"{random.randint(10000000, 99999999)}" for _ in range(10)]


class LoginAttempt(models.Model):
    """Track login attempts for security monitoring."""
    
    email = models.EmailField()
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    was_successful = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', '-created_at']),
            models.Index(fields=['ip_address', '-created_at']),
        ]
    
    def __str__(self) -> str:
        status = "Success" if self.was_successful else f"Failed: {self.failure_reason}"
        return f"LoginAttempt({self.email} - {status} @ {self.created_at:%Y-%m-%d %H:%M})"


class PasswordReset(models.Model):
    """
    Secure password reset tokens using 2FA flow.
    
    Flow:
    1. User requests password reset with email
    2. System validates email exists (without revealing)
    3. Email is sent with 2FA code (no URL exposure)
    4. User verifies code, then sets new password
    5. Token is marked as used (one-time use)
    """
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_resets')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    reset_code = models.CharField(max_length=6, blank=True, help_text="6-digit code sent by email")
    reset_code_created_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)
    is_confirmed = models.BooleanField(default=False, help_text="Code verified, ready for password change")
    failed_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['token']),
        ]
    
    def __str__(self) -> str:
        status = "✓ CONFIRMED" if self.is_confirmed else ("✗ USED" if self.is_used else "PENDING")
        return f"PasswordReset({self.user.email} - {status} @ {self.created_at:%Y-%m-%d %H:%M})"
    
    def is_expired(self) -> bool:
        """Check if reset token has expired (24 hours)."""
        expiry_hours = getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRE_HOURS', 24)
        return timezone.now() > self.created_at + timezone.timedelta(hours=expiry_hours)
    
    def is_code_expired(self) -> bool:
        """Check if 2FA code has expired (10 minutes)."""
        if not self.reset_code_created_at:
            return True
        expiry_minutes = getattr(settings, 'TWO_FACTOR_TOKEN_EXPIRE_MINUTES', 10)
        return timezone.now() > self.reset_code_created_at + timezone.timedelta(minutes=expiry_minutes)
    
    def is_locked(self) -> bool:
        """Check if locked due to failed attempts."""
        if self.locked_until:
            return timezone.now() < self.locked_until
        return False
    
    def can_attempt_verification(self) -> bool:
        """Check if user can attempt code verification."""
        if self.is_locked():
            return False
        max_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3)
        return self.failed_attempts < max_attempts
    
    def generate_reset_code(self) -> str:
        """Generate a new 6-digit reset code."""
        import random
        code = f"{random.randint(100000, 999999)}"
        self.reset_code = code
        self.reset_code_created_at = timezone.now()
        self.save(update_fields=['reset_code', 'reset_code_created_at', 'failed_attempts'])
        return code
    
    def verify_reset_code(self, code: str) -> bool:
        """
        Verify the provided reset code.
        Returns True if code is correct, False otherwise.
        Locks account after max failed attempts.
        """
        if not self.can_attempt_verification():
            return False
        
        if self.is_code_expired():
            return False
        
        if self.reset_code == code:
            self.is_confirmed = True
            self.failed_attempts = 0
            self.reset_code = ''
            self.save(update_fields=['is_confirmed', 'failed_attempts', 'reset_code'])
            return True
        else:
            self.failed_attempts += 1
            
            # Lock if max attempts reached
            max_attempts = getattr(settings, 'TWO_FACTOR_MAX_ATTEMPTS', 3)
            if self.failed_attempts >= max_attempts:
                self.locked_until = timezone.now() + timezone.timedelta(minutes=15)
            
            self.save(update_fields=['failed_attempts', 'locked_until'])
            return False
    
    def mark_as_used(self) -> None:
        """Mark reset token as used (one-time use)."""
        self.is_used = True
        self.save(update_fields=['is_used'])
    
    @classmethod
    def create_reset_request(cls, user, ip_address, user_agent):
        """Create a new password reset request."""
        # Invalidate previous unused resets
        cls.objects.filter(user=user, is_used=False, is_confirmed=False).delete()
        
        reset = cls.objects.create(
            user=user,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return reset


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone = models.CharField(max_length=30, blank=True, default="")
    role = models.CharField(max_length=20)
    county = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"UserProfile({self.user.username} {self.role})"


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    description = models.TextField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=30)
    quantity = models.IntegerField()
    is_organic = models.BooleanField(default=False)
    county = models.CharField(max_length=100)
    farmer_location = models.CharField(max_length=200)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    rating = models.FloatField(default=0.0)
    reviews = models.IntegerField(default=0)
    harvest_date = models.DateField(default=timezone.now)
    listed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-listed_at"]
        indexes = [
            models.Index(fields=["is_active", "-listed_at"]),
            models.Index(fields=["county"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self) -> str:
        return f"Product({self.name} {self.price}/{self.unit})"


class ProductImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/%Y/%m/%d/", max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"ProductImage({self.product_id})"


# ── Geographic Data ──────────────────────────────────────────────────────────

class County(models.Model):
    """Zimbabwe counties for geographic filtering"""
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Counties"

    def __str__(self) -> str:
        return self.name


class ProductCategory(models.Model):
    """Product categories for marketplace organization"""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Product Categories"

    def __str__(self) -> str:
        return self.name


# ── Farmer Directory ──────────────────────────────────────────────────────────

class FarmerProfile(models.Model):
    """Extended farmer profile for marketplace directory"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="farmer_profile")
    business_name = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200)
    county = models.ForeignKey(County, on_delete=models.SET_NULL, null=True)
    crops = models.JSONField(default=list, help_text="List of crops farmer grows")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    total_reviews = models.IntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    coordinates = models.PointField(null=True, blank=True)
    farm_size = models.CharField(max_length=50, blank=True, help_text="Farm size in hectares")
    years_experience = models.IntegerField(default=0)
    business_phone = models.CharField(max_length=30, blank=True)
    business_email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    social_media = models.JSONField(default=dict, help_text="Social media links")
    certifications = models.JSONField(default=list, help_text="List of certifications")
    active_listings = models.IntegerField(default=0)
    total_sales = models.IntegerField(default=0)
    response_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.0, help_text="Response rate percentage")
    avg_response_time = models.IntegerField(default=0, help_text="Average response time in hours")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-rating", "-created_at"]

    def __str__(self) -> str:
        return f"FarmerProfile({self.user.get_full_name() or self.user.username})"

    @property
    def farmer_name(self) -> str:
        """Get farmer's display name"""
        if self.business_name:
            return self.business_name
        return self.user.get_full_name() or self.user.username

    @property
    def avatar_url(self) -> str:
        """Get farmer's avatar URL"""
        if hasattr(self.user, 'profile') and self.user.profile.avatar:
            return self.user.profile.avatar.url if hasattr(self.user.profile.avatar, 'url') else str(self.user.profile.avatar)
        return f"https://api.dicebear.com/7.x/avataaars/png?seed={self.user.username}"