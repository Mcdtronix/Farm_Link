"""
tomato_grading_api/apps.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Django App Config — Startup Model Loading
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loads both the grading model AND the pricing model at Django
startup (in AppConfig.ready()).  This ensures:

  • The first API request is not delayed by model loading
    (both .pkl files can be 10–50 MB — loading takes 1–3 s)
  • Thread safety: models are loaded once before any worker
    thread processes a request
  • Graceful degradation: if a model fails to load, a warning
    is logged rather than crashing the entire server

Loading is intentionally skipped during management commands
(migrate, collectstatic, test) where ML models are not needed.
"""

import logging
import sys

from django.apps import AppConfig

logger = logging.getLogger("ml_engine")

# Management commands that must NOT trigger model loading
_SKIP_COMMANDS = {
    "migrate", "makemigrations", "collectstatic",
    "test", "check", "shell", "dbshell",
    "createsuperuser", "changepassword",
}


def _is_management_command() -> bool:
    """Return True when running manage.py <command> that doesn't need ML models."""
    if len(sys.argv) < 2:
        return False
    return sys.argv[1] in _SKIP_COMMANDS


class TomatoGradingApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "tomato_grading_api"
    label = "tomato_grading_api"

    def ready(self) -> None:
        if _is_management_command():
            logger.info(
                "AppConfig.ready(): skipping model loading (management command: %s)",
                sys.argv[1] if len(sys.argv) > 1 else "unknown",
            )
            return

        self._load_grading_model()
        self._load_pricing_model()

    @staticmethod
    def _load_grading_model() -> None:
        try:
            from ml_engine.predictor import TomatoGrader
            TomatoGrader.get_instance()
            logger.info("✅ Grading model loaded successfully at startup")
        except Exception as exc:
            logger.warning(
                "⚠️  Grading model failed to load at startup: %s. "
                "The /api/v1/grade-and-price/ endpoint will return 503 "
                "until the model file is present.",
                exc,
            )

    @staticmethod
    def _load_pricing_model() -> None:
        try:
            from ml_engine.pricing_predictor import TomatoPricingPredictor
            TomatoPricingPredictor.get_instance()
            logger.info("✅ Pricing model loaded successfully at startup")
        except Exception as exc:
            logger.warning(
                "⚠️  Pricing model failed to load at startup: %s. "
                "Pricing predictions will be unavailable until "
                "tomato_pricing_model.pkl is placed in the models/ directory.",
                exc,
            )
