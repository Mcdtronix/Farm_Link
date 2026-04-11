"""
ml_engine/predictor.py
──────────────────────
Loads the Random Forest pipeline and exposes TomatoGrader.

Design
  • Singleton — model loads once, reused for every request
  • Thread-safe — model is read-only after load
  • Stateless  — predict_* methods have no mutable side effects
  • Graceful   — always returns a structured dict, never crashes the server
"""

import cv2
import json
import logging
import threading
import time
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from skimage.feature import graycomatrix, graycoprops, local_binary_pattern

logger = logging.getLogger("ml_engine")


# ══════════════════════════════════════════════════════════════
#  FEATURE EXTRACTION
#  These functions MUST be byte-for-byte identical to what was
#  used during training. Any change = wrong predictions.
# ══════════════════════════════════════════════════════════════

def _color_features(img_rgb: np.ndarray) -> dict:
    f = {}
    for i, ch in enumerate(["r", "g", "b"]):
        f[f"rgb_{ch}_mean"] = float(img_rgb[:, :, i].mean())
        f[f"rgb_{ch}_std"]  = float(img_rgb[:, :, i].std())
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    for i, ch in enumerate(["h", "s", "v"]):
        f[f"hsv_{ch}_mean"] = float(hsv[:, :, i].mean())
        f[f"hsv_{ch}_std"]  = float(hsv[:, :, i].std())
    lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
    for i, ch in enumerate(["l", "a", "b"]):
        f[f"lab_{ch}_mean"] = float(lab[:, :, i].mean())
        f[f"lab_{ch}_std"]  = float(lab[:, :, i].std())
    r, g, b = (img_rgb[:, :, i].astype(float) for i in range(3))
    total = r + g + b + 1e-6
    f["red_ratio"]   = float((r / total).mean())
    f["green_ratio"] = float((g / total).mean())
    return f


def _texture_features(img_gray: np.ndarray) -> dict:
    f   = {}
    u8  = cv2.resize(img_gray, (128, 128))
    u8  = u8 if u8.dtype == np.uint8 else (u8 * 255).astype(np.uint8)
    glcm = graycomatrix(
        u8, distances=[1, 3],
        angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4],
        levels=256, symmetric=True, normed=True,
    )
    for prop in ["contrast", "dissimilarity", "homogeneity", "energy", "correlation"]:
        vals = graycoprops(glcm, prop).flatten()
        f[f"glcm_{prop}_mean"] = float(vals.mean())
        f[f"glcm_{prop}_std"]  = float(vals.std())
    lbp = local_binary_pattern(u8, P=8, R=1, method="uniform")
    hist, _ = np.histogram(lbp.ravel(), bins=10, range=(0, 10), density=True)
    for i, v in enumerate(hist):
        f[f"lbp_{i}"] = float(v)
    return f


def _shape_features(img_rgb: np.ndarray) -> dict:
    f    = {}
    hsv  = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    m1   = cv2.inRange(hsv, np.array([0,   50, 50]), np.array([10,  255, 255]))
    m2   = cv2.inRange(hsv, np.array([160, 50, 50]), np.array([180, 255, 255]))
    mask = cv2.morphologyEx(m1 | m2, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c    = max(cnts, key=cv2.contourArea)
        area = cv2.contourArea(c)
        peri = cv2.arcLength(c, True) + 1e-6
        f["circularity"]  = float((4 * np.pi * area) / (peri ** 2))
        x, y, w, h = cv2.boundingRect(c)
        f["aspect_ratio"] = float(w / (h + 1e-6))
        f["extent"]       = float(area / (w * h + 1e-6))
        hull = cv2.convexHull(c)
        f["solidity"]     = float(area / (cv2.contourArea(hull) + 1e-6))
        f["tomato_area"]  = float(area / (img_rgb.shape[0] * img_rgb.shape[1]))
    else:
        f.update({"circularity": 0.0, "aspect_ratio": 0.0,
                  "extent": 0.0, "solidity": 0.0, "tomato_area": 0.0})
    return f


def extract_all_features(img_rgb: np.ndarray) -> np.ndarray:
    img_rgb  = cv2.resize(img_rgb, (224, 224))
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    feats = {}
    feats.update(_color_features(img_rgb))
    feats.update(_texture_features(img_gray))
    feats.update(_shape_features(img_rgb))
    arr = np.array(list(feats.values()), dtype=np.float32)
    return np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)


# ══════════════════════════════════════════════════════════════
#  GRADER  —  Singleton
# ══════════════════════════════════════════════════════════════

class TomatoGrader:
    """
    Thread-safe singleton grading engine.

    Usage
    ─────
        grader = TomatoGrader.get_instance()
        result = grader.predict_from_bytes(image_bytes)
    """

    _instance: Optional["TomatoGrader"] = None
    _lock = threading.Lock()

    GRADE_INFO = {
        "Grade A": {
            "code": "A", "marketable": True, "color_hint": "#27ae60",
            "description": (
                "Premium quality. Deep red, uniform round shape, "
                "diameter > 65 mm, zero blemishes. Top market price."
            ),
        },
        "Grade B": {
            "code": "B", "marketable": True, "color_hint": "#f39c12",
            "description": (
                "Good quality. Minor colour variation, small surface marks "
                "acceptable, diameter 50 – 65 mm. Mainstream market."
            ),
        },
        "Grade C": {
            "code": "C", "marketable": True, "color_hint": "#e67e22",
            "description": (
                "Fair quality. Irregular shape or colour patches, "
                "small defects, diameter < 50 mm. Processing / local markets."
            ),
        },
        "Reject": {
            "code": "R", "marketable": False, "color_hint": "#e74c3c",
            "description": (
                "Unfit for market. Severe damage, disease, rotting, "
                "or image does not contain a tomato."
            ),
        },
    }

    def __init__(self, model_path: Path, metadata_path: Path):
        self._model    = None
        self._scaler   = None
        self._classes  = []
        self._metadata = {}
        self._loaded   = False
        self._load_time = None
        self._load(Path(model_path), Path(metadata_path))

    # ── Singleton accessor ────────────────────────────────────
    @classmethod
    def get_instance(cls) -> "TomatoGrader":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    from django.conf import settings
                    cfg = settings.ML_CONFIG
                    cls._instance = cls(cfg["model_path"], cfg["metadata_path"])
        return cls._instance

    # ── Load ──────────────────────────────────────────────────
    def _load(self, model_path: Path, metadata_path: Path):
        if not model_path.exists():
            raise FileNotFoundError(
                f"Model not found: {model_path}\n"
                "Download tomato_grader_rf_pipeline.pkl from Google Drive "
                "and place it in the models/ directory."
            )
        t0     = time.time()
        bundle = joblib.load(model_path)

        if isinstance(bundle, dict):
            self._model   = bundle["model"]
            self._scaler  = bundle.get("scaler")
            self._classes = bundle.get("class_names",
                                       ["Grade A", "Grade B", "Grade C", "Reject"])
        else:
            # Raw sklearn Pipeline (scaler baked in)
            self._model   = bundle
            self._scaler  = None
            self._classes = ["Grade A", "Grade B", "Grade C", "Reject"]

        if metadata_path.exists():
            with open(metadata_path) as fp:
                self._metadata = json.load(fp)
        else:
            self._metadata = {"version": "1.0.0", "test_accuracy": "N/A"}

        self._loaded    = True
        self._load_time = time.time() - t0
        logger.info(
            f"Model loaded in {self._load_time:.2f}s | "
            f"classes={self._classes} | "
            f"accuracy={self._metadata.get('test_accuracy')}"
        )

    # ── Public predict methods ────────────────────────────────
    def predict_from_bytes(self, image_bytes: bytes) -> dict:
        """Called by Django views with request.FILES['image'].read()"""
        nparr   = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return self._err("Could not decode image. Send a valid JPEG or PNG.")
        return self._predict(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

    def predict_from_path(self, path: str) -> dict:
        """Useful for management commands and batch scripts."""
        img_bgr = cv2.imread(str(path))
        if img_bgr is None:
            return self._err(f"Cannot read image: {path}")
        return self._predict(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

    def predict_from_pil(self, pil_image) -> dict:
        """Accepts a PIL Image."""
        return self._predict(np.array(pil_image.convert("RGB")))

    # ── Core inference ────────────────────────────────────────
    def _predict(self, img_rgb: np.ndarray) -> dict:
        t0 = time.time()
        try:
            features = extract_all_features(img_rgb).reshape(1, -1)
            if self._scaler is not None:
                features = self._scaler.transform(features)
            probs      = self._model.predict_proba(features)[0]
            idx        = int(np.argmax(probs))
            grade      = self._classes[idx]
            confidence = float(probs[idx]) * 100

            from django.conf import settings
            thresholds = settings.ML_CONFIG["confidence_thresholds"]
            if confidence >= thresholds["high"]:
                level = "high"
            elif confidence >= thresholds["medium"]:
                level = "medium"
            else:
                level = "low"

            info       = self.GRADE_INFO.get(grade, {})
            elapsed_ms = (time.time() - t0) * 1000

            result = {
                "grade":             grade,
                "grade_code":        info.get("code", "?"),
                "confidence":        round(confidence, 1),
                "confidence_level":  level,
                "description":       info.get("description", ""),
                "marketable":        info.get("marketable", False),
                "color_hint":        info.get("color_hint", "#cccccc"),
                "all_probabilities": {
                    c: round(float(p) * 100, 1)
                    for c, p in zip(self._classes, probs)
                },
                "inference_time_ms": round(elapsed_ms, 1),
                "model_version":     self._metadata.get("version", "1.0.0"),
                "manual_review":     level == "low",
            }
            logger.info(
                f"grade={grade} conf={confidence:.1f}% "
                f"level={level} ms={elapsed_ms:.1f}"
            )
            return result

        except Exception as exc:
            logger.exception(f"Prediction failed: {exc}")
            return self._err(f"Prediction error: {exc}")

    def health_check(self) -> dict:
        return {
            "loaded":        self._loaded,
            "load_time_s":   round(self._load_time or 0, 2),
            "model_type":    self._metadata.get("model_name", "Random Forest"),
            "model_version": self._metadata.get("version",   "1.0.0"),
            "accuracy":      self._metadata.get("test_accuracy", "N/A"),
            "classes":       self._classes,
            "n_features":    getattr(self._model, "n_features_in_", "N/A"),
        }

    @staticmethod
    def _err(msg: str) -> dict:
        return {"error": True, "message": msg, "grade": None, "confidence": 0.0}
