from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("tomato_grading_api", "0002_twofactorauth_loginattempt_emailverification"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone", models.CharField(blank=True, default="", max_length=30)),
                ("role", models.CharField(max_length=20)),
                ("county", models.CharField(max_length=100)),
                ("location", models.CharField(max_length=200)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("category", models.CharField(max_length=100)),
                ("description", models.TextField()),
                ("price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("unit", models.CharField(max_length=30)),
                ("quantity", models.IntegerField()),
                ("is_organic", models.BooleanField(default=False)),
                ("county", models.CharField(max_length=100)),
                ("farmer_location", models.CharField(max_length=200)),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lng", models.FloatField(blank=True, null=True)),
                ("rating", models.FloatField(default=0.0)),
                ("reviews", models.IntegerField(default=0)),
                ("harvest_date", models.DateField(default=django.utils.timezone.now)),
                ("listed_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "farmer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="products",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-listed_at"],
            },
        ),
        migrations.CreateModel(
            name="ProductImage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("image", models.ImageField(max_length=500, upload_to="products/%Y/%m/%d/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="tomato_grading_api.product",
                    ),
                ),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["is_active", "-listed_at"], name="tomato_grad_is_acti_7e2d6a_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["county"], name="tomato_grad_county_4d98c1_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["category"], name="tomato_grad_category_3c1c89_idx"),
        ),
    ]
