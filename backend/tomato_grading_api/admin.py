"""
tomato_grading_api/admin.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Django Admin Configuration — Grading + Pricing Pipeline
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provides a powerful admin interface for:

• Monitoring grading and pricing sessions
• Reviewing user feedback
• Inspecting model predictions and performance
• Managing batch uploads
• Tracking deployed model versions
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django import forms
from django.utils.html import format_html

from .models import (
    GradingSession,
    PricingSession,
    BatchSession,
    GradingFeedback,
    PricingFeedback,
    ModelVersion,
    EmailVerification,
    TwoFactorAuth,
    LoginAttempt,
    UserProfile,
    Product,
    ProductImage,
)


# ─────────────────────────────────────────────────────────────
# INLINE ADMIN (RELATIONSHIPS)
# ─────────────────────────────────────────────────────────────

class UserProfileInline(admin.StackedInline):
    """Inline UserProfile for User admin integration with role selection."""
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profile & Role"
    fields = ("role", "phone", "county", "location")
    extra = 0  # Don't show extra empty forms
    
    def formfield_for_dbfield(self, db_field, request, **kwargs):
        """Customize inline form fields."""
        if db_field.name == 'role':
            kwargs['widget'] = forms.Select(
                choices=[
                    ('farmer', '🌾 Farmer - Sell produce'),
                    ('buyer', '🛒 Buyer - Purchase produce'),
                ]
            )
        return super().formfield_for_dbfield(db_field, request, **kwargs)
    
class PricingSessionInline(admin.StackedInline):
    """Show pricing session inside grading session."""
    model = PricingSession
    extra = 0
    readonly_fields = (
        "predicted_price",
        "price_range_low",
        "price_range_high",
        "currency",
        "pricing_model_version",
        "created_at",
    )


class GradingFeedbackInline(admin.StackedInline):
    model = GradingFeedback
    extra = 0
    readonly_fields = ("model_was_wrong", "created_at")


class PricingFeedbackInline(admin.StackedInline):
    model = PricingFeedback
    extra = 0
    readonly_fields = ("price_was_wrong", "created_at")


# ─────────────────────────────────────────────────────────────
# GRADING SESSION ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(GradingSession)
class GradingSessionAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "user",
        "grade_code",
        "confidence",
        "confidence_level",
        "marketable",
        "manual_review",
        "created_at",
        "image_preview",
    )

    list_filter = (
        "grade_code",
        "confidence_level",
        "marketable",
        "manual_review",
        "model_version",
        "created_at",
    )

    search_fields = (
        "id",
        "user__username",
        "grade_code",
    )

    readonly_fields = (
        "created_at",
        "image_preview",
        "all_probabilities",
        "ip_address",
        "user_agent",
    )

    ordering = ("-created_at",)

    inlines = [
        PricingSessionInline,
        GradingFeedbackInline,
    ]

    fieldsets = (
        ("User Information", {
            "fields": ("user", "batch")
        }),

        ("Input Image", {
            "fields": ("image", "image_preview")
        }),

        ("Prediction Output", {
            "fields": (
                "predicted_grade",
                "grade_code",
                "confidence",
                "confidence_level",
                "all_probabilities",
                "model_version",
                "inference_time_ms",
            )
        }),

        ("Quality Flags", {
            "fields": (
                "marketable",
                "manual_review",
            )
        }),

        ("Metadata", {
            "fields": (
                "ip_address",
                "user_agent",
                "created_at",
            )
        }),
    )

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="80" style="border-radius:6px;" />',
                obj.image.url
            )
        return "-"
    image_preview.short_description = "Image"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Enhanced user profile admin with role management capabilities."""
    
    list_display = (
    "user",
    "role",                # 👈 add this
    "role_with_badge",     # optional visual
    "county",
    "location",
    "phone",
    "user_email",
    "created_at"
)
    search_fields = ("user__username", "user__email", "phone", "county", "location")
    list_filter = ("role", "county", "created_at")
    
    # Make role editable directly in list view with dropdown
    list_editable = ("role",)
    
    # Add ordering and better organization
    ordering = ("user__username",)
    date_hierarchy = "created_at"
    
    # Custom actions for bulk role changes
    actions = ["make_farmers", "make_buyers", "bulk_role_change_with_prompt"]
    
    # Enhanced fieldsets with role selection
    fieldsets = (
        ("User Information", {
            "fields": ("user", "role")
        }),
        ("Contact Information", {
            "fields": ("phone",)
        }),
        ("Location", {
            "fields": ("county", "location")
        }),
        ("Metadata", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
    
    readonly_fields = ("created_at", "updated_at")
    
    # Add formfield_overrides for better role selection
    def formfield_for_dbfield(self, db_field, request, **kwargs):
        """Customize form fields for better UX."""
        if db_field.name == 'role':
            kwargs['widget'] = forms.Select(
                choices=[
                    ('farmer', '🌾 Farmer - Sell produce'),
                    ('buyer', '🛒 Buyer - Purchase produce'),
                ]
            )
        return super().formfield_for_dbfield(db_field, request, **kwargs)
    
    def role_with_badge(self, obj):
        """Display role with color-coded badge."""
        colors = {
            "farmer": "#28a745",  # Green
            "buyer": "#007bff",   # Blue
            "admin": "#dc3545",   # Red (if added later)
        }
        color = colors.get(obj.role, "#6c757d")  # Default gray
        
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color, obj.role.upper()
        )
    role_with_badge.short_description = "Role"
    role_with_badge.admin_order_field = "role"
    
    def user_email(self, obj):
        """Display user's email for quick reference."""
        return obj.user.email if obj.user else "-"
    user_email.short_description = "Email"
    user_email.admin_order_field = "user__email"
    
    # Custom admin actions
    def make_farmers(self, request, queryset):
        """Bulk change selected users to farmers."""
        updated = queryset.update(role="farmer")
        self.message_user(request, f"{updated} users successfully changed to farmers.")
    make_farmers.short_description = "Convert selected users to Farmers"
    
    def make_buyers(self, request, queryset):
        """Bulk change selected users to buyers."""
        updated = queryset.update(role="buyer")
        self.message_user(request, f"{updated} users successfully changed to buyers.")
    make_buyers.short_description = "Convert selected users to Buyers"
    
    def bulk_role_change_with_prompt(self, request, queryset):
        """Enhanced bulk role change with proper prompt."""
        from django.contrib import messages
        from django.shortcuts import redirect, render
        
        if 'apply_role' in request.POST:
            new_role = request.POST.get('new_role')
            if new_role in ['farmer', 'buyer']:
                updated_count = 0
                for user in queryset:
                    profile, created = UserProfile.objects.get_or_create(
                        user=user,
                        defaults={'role': 'farmer', 'phone': '', 'county': '', 'location': ''}
                    )
                    if profile.role != new_role:
                        profile.role = new_role
                        profile.save()
                        updated_count += 1
                    elif created:
                        updated_count += 1
                
                self.message_user(request, f"Successfully changed {updated_count} users to {new_role}s.")
            return redirect(request.get_full_path())
        
        # Show confirmation page with role selection
        return render(request, 'admin/bulk_role_change.html', {
            'queryset': queryset,
            'opts': self.model._meta,
            'action': 'bulk_role_change_with_prompt',
            'role_choices': [
                ('farmer', '🌾 Farmer - Sell produce'),
                ('buyer', '🛒 Buyer - Purchase produce'),
            ]
        })
    bulk_role_change_with_prompt.short_description = "Change role with selection"


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "farmer", "price", "unit", "quantity", "county", "is_active", "listed_at")
    list_filter = ("is_active", "category", "county", "is_organic")
    search_fields = ("name", "farmer__username", "farmer__email", "county")
    readonly_fields = ("listed_at",)
    inlines = [ProductImageInline]


# ─────────────────────────────────────────────────────────────
# PRICING SESSION ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(PricingSession)
class PricingSessionAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "user",
        "grade_code",
        "market_location",
        "predicted_price",
        "price_range_low",
        "price_range_high",
        "currency",
        "created_at",
    )

    list_filter = (
        "market_location",
        "market_type",
        "currency",
        "pricing_model_version",
        "created_at",
    )

    search_fields = (
        "id",
        "user__username",
        "market_location",
    )

    readonly_fields = (
        "created_at",
        "imputed_features",
        "resolution_log",
        "imputation_warnings",
    )

    ordering = ("-created_at",)

    inlines = [PricingFeedbackInline]

    fieldsets = (
        ("User & Session", {
            "fields": (
                "user",
                "grading_session",
            )
        }),

        ("Market Inputs", {
            "fields": (
                "market_location",
                "month",
                "market_type",
                "farm_lat",
                "farm_lon",
            )
        }),

        ("Prediction Output", {
            "fields": (
                "predicted_price",
                "price_range_low",
                "price_range_high",
                "currency",
                "pricing_model_version",
                "inference_time_ms",
                "total_pipeline_time_ms",
            )
        }),

        ("Feature Imputation", {
            "fields": (
                "imputed_features",
                "resolution_log",
                "imputation_warnings",
            )
        }),

        ("Metadata", {
            "fields": (
                "ip_address",
                "created_at",
            )
        }),
    )


# ─────────────────────────────────────────────────────────────
# BATCH SESSION ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(BatchSession)
class BatchSessionAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "user",
        "status",
        "total_images",
        "created_at",
        "completed_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "name",
        "user__username",
    )

    readonly_fields = (
        "created_at",
        "completed_at",
    )

    ordering = ("-created_at",)


# ─────────────────────────────────────────────────────────────
# GRADING FEEDBACK ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(GradingFeedback)
class GradingFeedbackAdmin(admin.ModelAdmin):

    list_display = (
        "session",
        "correct_grade",
        "model_was_wrong",
        "submitted_by",
        "created_at",
    )

    list_filter = (
        "model_was_wrong",
        "correct_grade",
        "created_at",
    )

    search_fields = (
        "session__id",
        "submitted_by__username",
    )

    readonly_fields = ("model_was_wrong", "created_at")


# ─────────────────────────────────────────────────────────────
# PRICING FEEDBACK ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(PricingFeedback)
class PricingFeedbackAdmin(admin.ModelAdmin):

    list_display = (
        "session",
        "actual_price",
        "price_was_wrong",
        "submitted_by",
        "created_at",
    )

    list_filter = (
        "price_was_wrong",
        "created_at",
    )

    search_fields = (
        "session__id",
        "submitted_by__username",
    )

    readonly_fields = ("price_was_wrong", "created_at")


# ─────────────────────────────────────────────────────────────
# MODEL VERSION ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):

    list_display = (
        "version",
        "model_type",
        "accuracy",
        "f1_score",
        "rmse",
        "mape",
        "is_active",
        "deployed_at",
    )

    list_filter = (
        "model_type",
        "is_active",
    )

    search_fields = (
        "version",
        "model_type",
    )

    readonly_fields = (
        "deployed_at",
    )

    ordering = ("-deployed_at",)


# ─────────────────────────────────────────────────────────────
# EMAIL VERIFICATION ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    
    list_display = (
        "user",
        "token",
        "is_verified",
        "created_at",
        "expires_at",
    )
    
    list_filter = (
        "is_verified",
        "created_at",
        "expires_at",
    )
    
    search_fields = (
        "user__username",
        "user__email",
        "token",
    )
    
    readonly_fields = (
        "token",
        "created_at",
        "expires_at",
    )
    
    ordering = ("-created_at",)
    
    fieldsets = (
        ("User Information", {
            "fields": ("user", "is_verified")
        }),
        ("Token Information", {
            "fields": ("token", "created_at", "expires_at")
        }),
    )


# ─────────────────────────────────────────────────────────────
# TWO FACTOR AUTH ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(admin.ModelAdmin):
    
    list_display = (
        "user",
        "is_enabled",
        "email_token_created_at",
        "failed_attempts",
        "locked_until",
    )
    
    list_filter = (
        "is_enabled",
        "failed_attempts",
        "locked_until",
    )
    
    search_fields = (
        "user__username",
        "user__email",
    )
    
    readonly_fields = (
        "backup_codes",
        "email_token_created_at",
        "locked_until",
    )
    
    ordering = ("-email_token_created_at",)
    
    fieldsets = (
        ("User Information", {
            "fields": ("user", "is_enabled")
        }),
        ("2FA Settings", {
            "fields": ("backup_codes", "failed_attempts", "locked_until")
        }),
        ("Token Information", {
            "fields": ("email_token", "email_token_created_at")
        }),
    )


# ─────────────────────────────────────────────────────────────
# LOGIN ATTEMPT ADMIN
# ─────────────────────────────────────────────────────────────

@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    
    list_display = (
        "email",
        "ip_address",
        "was_successful",
        "failure_reason",
        "created_at",
    )
    
    list_filter = (
        "was_successful",
        "failure_reason",
        "created_at",
    )
    
    search_fields = (
        "email",
        "ip_address",
        "user_agent",
    )
    
    readonly_fields = (
        "email",
        "ip_address",
        "user_agent",
        "was_successful",
        "failure_reason",
        "created_at",
    )
    
    ordering = ("-created_at",)
    
    date_hierarchy = "created_at"
    
    fieldsets = (
        ("Attempt Information", {
            "fields": ("email", "was_successful", "failure_reason")
        }),
        ("Technical Details", {
            "fields": ("ip_address", "user_agent")
        }),
        ("Timestamp", {
            "fields": ("created_at",)
        }),
    )


# ─────────────────────────────────────────────────────────────
# CUSTOM USER ADMIN WITH PROFILE INTEGRATION
# ─────────────────────────────────────────────────────────────

class UserAdmin(BaseUserAdmin):
    """Enhanced User admin with integrated UserProfile management."""
    
    list_display = ("username", "email", "first_name", "last_name", "user_role", "is_staff", "date_joined")
    list_filter = ("is_staff", "is_superuser", "is_active", "groups", "date_joined")
    search_fields = ("username", "first_name", "last_name", "email")
    
    # Add UserProfile inline
    inlines = [UserProfileInline]
    
    # Custom actions for profile management
    actions = ["create_missing_profiles", "make_farmers", "make_buyers"]
    
    # Custom fieldsets to include role information
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    
    # Add custom display method for role
    def user_role(self, obj):
        """Display user's role from profile."""
        try:
            profile = obj.userprofile
            colors = {
                "farmer": "#28a745",
                "buyer": "#007bff", 
                "admin": "#dc3545",
            }
            color = colors.get(profile.role, "#6c757d")
            
            return format_html(
                '<span style="background-color: {}; color: white; padding: 2px 6px; '
                'border-radius: 8px; font-size: 10px; font-weight: bold;">{}</span>',
                color, profile.role.upper()
            )
        except UserProfile.DoesNotExist:
            return format_html(
                '<span style="background-color: #ffc107; color: black; padding: 2px 6px; '
                'border-radius: 8px; font-size: 10px; font-weight: bold;">NO PROFILE</span>'
            )
        except AttributeError:
            # Handle case where userprofile relationship doesn't exist
            return format_html(
                '<span style="background-color: #ffc107; color: black; padding: 2px 6px; '
                'border-radius: 8px; font-size: 10px; font-weight: bold;">NO PROFILE</span>'
            )
    user_role.short_description = "Role"
    user_role.admin_order_field = "userprofile__role"
    
    # Custom admin actions
    def create_missing_profiles(self, request, queryset):
        """Create UserProfile for users missing one."""
        from django.contrib import messages
        created_count = 0
        
        for user in queryset:
            try:
                UserProfile.objects.get(user=user)
            except UserProfile.DoesNotExist:
                UserProfile.objects.create(
                    user=user,
                    role='farmer',  # Default role
                    phone='',
                    county='',
                    location=''
                )
                created_count += 1
        
        if created_count > 0:
            self.message_user(request, f"Created UserProfile for {created_count} users with default 'farmer' role.")
        else:
            self.message_user(request, "All selected users already have profiles.")
    create_missing_profiles.short_description = "Create missing UserProfiles (default: farmer)"
    
    def make_farmers(self, request, queryset):
        """Bulk change selected users to farmers."""
        updated = 0
        for user in queryset:
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={'role': 'farmer', 'phone': '', 'county': '', 'location': ''}
            )
            if not created and profile.role != 'farmer':
                profile.role = 'farmer'
                profile.save()
                updated += 1
            elif created:
                updated += 1
        
        self.message_user(request, f"{updated} users successfully set as farmers.")
    make_farmers.short_description = "Set selected users as Farmers"
    
    def make_buyers(self, request, queryset):
        """Bulk change selected users to buyers."""
        updated = 0
        for user in queryset:
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={'role': 'buyer', 'phone': '', 'county': '', 'location': ''}
            )
            if not created and profile.role != 'buyer':
                profile.role = 'buyer'
                profile.save()
                updated += 1
            elif created:
                updated += 1
        
        self.message_user(request, f"{updated} users successfully set as buyers.")
    make_buyers.short_description = "Set selected users as Buyers"


# Unregister the default User admin and register our custom one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)