"""
python manage.py verify_model
python manage.py verify_model --image /path/to/tomato.jpg

Loads the ML model and runs a test prediction to confirm
the full pipeline works before you go live.
"""
import time
import numpy as np
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Verify the ML model loads and predicts correctly"

    def add_arguments(self, parser):
        parser.add_argument("--image", type=str, default=None,
                            help="Optional path to a real tomato image")

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 56)
        self.stdout.write("  🍅  TOMATO GRADER — MODEL VERIFICATION")
        self.stdout.write("=" * 56)

        cfg = settings.ML_CONFIG
        self.stdout.write(f"\n  Model path    : {cfg['model_path']}")
        self.stdout.write(f"  Metadata path : {cfg['metadata_path']}")

        if not Path(cfg["model_path"]).exists():
            self.stderr.write(self.style.ERROR(
                f"\n  ❌  Model file NOT FOUND: {cfg['model_path']}\n"
                "     Download tomato_grader_rf_pipeline.pkl from Google Drive\n"
                "     and place it in the models/ folder, then rerun."
            ))
            return

        self.stdout.write(self.style.SUCCESS("  ✅  Model file found\n"))
        self.stdout.write("  ⏳  Loading model…")

        try:
            from ml_engine.predictor import TomatoGrader
            grader = TomatoGrader.get_instance()
            h      = grader.health_check()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"\n  ❌  Load failed: {exc}"))
            return

        self.stdout.write(self.style.SUCCESS(f"  ✅  Loaded in {h['load_time_s']}s"))
        self.stdout.write(f"     Type       : {h['model_type']}")
        self.stdout.write(f"     Version    : {h['model_version']}")
        self.stdout.write(f"     Accuracy   : {h['accuracy']}")
        self.stdout.write(f"     Classes    : {h['classes']}")
        self.stdout.write(f"     n_features : {h['n_features']}")

        self.stdout.write("\n  ⏳  Running test prediction…")
        image_path = options.get("image")
        try:
            if image_path:
                self.stdout.write(f"     Using: {image_path}")
                result = grader.predict_from_path(image_path)
            else:
                self.stdout.write("     Using: synthetic 224×224 red image")
                dummy = np.zeros((224, 224, 3), dtype=np.uint8)
                dummy[:, :, 0] = 190  # red dominant
                dummy[:, :, 1] = 40
                dummy[:, :, 2] = 40
                result = grader._predict(dummy)

            if result.get("error"):
                self.stderr.write(self.style.ERROR(
                    f"\n  ❌  Prediction error: {result['message']}"))
                return

            self.stdout.write(self.style.SUCCESS("\n  ✅  Prediction successful!\n"))
            self.stdout.write(f"  Grade            : {result['grade']}")
            self.stdout.write(f"  Confidence       : {result['confidence']} %")
            self.stdout.write(f"  Confidence level : {result['confidence_level']}")
            self.stdout.write(f"  Marketable       : {result['marketable']}")
            self.stdout.write(f"  Inference time   : {result['inference_time_ms']} ms")
            self.stdout.write("\n  Probabilities:")
            for grade, prob in result["all_probabilities"].items():
                bar = "█" * int(prob / 4)
                self.stdout.write(f"    {grade:<12}  {prob:>5.1f}%  {bar}")

        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"\n  ❌  Prediction exception: {exc}"))
            return

        self.stdout.write("\n" + "=" * 56)
        self.stdout.write(self.style.SUCCESS(
            "  ✅  ALL CHECKS PASSED — server is ready to grade tomatoes"))
        self.stdout.write("=" * 56 + "\n")
