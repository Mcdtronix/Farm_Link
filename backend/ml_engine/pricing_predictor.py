"""
ml_engine/pricing_predictor.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tomato Pricing Predictor — Thread-Safe Singleton
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Loads tomato_pricing_model.pkl (trained XGBoost/LightGBM model)
at Django startup and serves predictions through a thread-safe
singleton identical in design to the existing TomatoGrader.

The pricing model expects the 22 engineered features produced by
pricing_features.engineer_features().  This predictor bridges the
imputed raw feature dict from FeatureImputer to that engineered
representation.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("ml_engine")


class TomatoPricingPredictor:
    """
    Thread-safe singleton for the tomato pricing model.

    Load once at startup via AppConfig.ready(), then serve predictions
    across all concurrent requests without reloading the model.
    """

    _instance: "TomatoPricingPredictor | None" = None
    _lock = threading.Lock()

    def __init__(self, model_path: Path, metadata_path: Path) -> None:
        import joblib

        logger.info("Loading pricing model from %s …", model_path)
        t0 = time.perf_counter()

        bundle = joblib.load(model_path)

        # Bundle can be a dict (sklearn Pipeline + encoders) or a raw estimator
        if isinstance(bundle, dict):
            self._model    = bundle["model"]
            self._encoders = bundle["encoders"]
            self._features = bundle.get("feature_names", [])
        else:
            # Raw sklearn Pipeline — encoders are embedded
            self._model    = bundle
            self._encoders = {}
            self._features = []

        # Load metadata
        with open(metadata_path) as f:
            self._meta = json.load(f)

        elapsed = (time.perf_counter() - t0) * 1000
        logger.info(
            "Pricing model loaded in %.1f ms — version=%s test_r2=%.4f",
            elapsed,
            self._meta.get("version", "unknown"),
            self._meta.get("test_r2", 0.0),
        )

    @classmethod
    def get_instance(cls) -> "TomatoPricingPredictor":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    from django.conf import settings
                    cfg = settings.ML_CONFIG
                    cls._instance = cls(
                        model_path    = cfg["pricing_model_path"],
                        metadata_path = cfg["pricing_meta_path"],
                    )
        return cls._instance

    def predict(self, raw_features: dict[str, Any]) -> dict[str, Any]:
        """
        Run a price prediction from the imputed raw feature dict.

        Parameters
        ----------
        raw_features : dict produced by FeatureImputer.impute().features

        Returns
        -------
        dict:
            predicted_price_usd_per_kg : float (2 decimal places)
            price_range_low            : float
            price_range_high           : float
            currency                   : "USD"
            model_version              : str
            grade_label                : str (human readable)
        """
        import numpy as np

        t0 = time.perf_counter()

        # Build the engineered feature vector
        X = self._engineer(raw_features)

        # Predict
        price = float(self._model.predict(X)[0])

        # Clip to the observed training range with a small margin
        price = max(0.10, min(5.00, price))

        # Confidence interval: ±MAPE from test set
        mape_dec = self._meta.get("test_mape_pct", 8.0) / 100.0
        low  = round(price * (1 - mape_dec), 2)
        high = round(price * (1 + mape_dec), 2)

        elapsed = (time.perf_counter() - t0) * 1000

        grade_labels = {"A": "Premium", "B": "Good", "C": "Fair"}
        grade        = raw_features.get("tomato_grade", "")

        logger.info(
            "Price prediction: grade=%s price=%.2f [%.2f–%.2f] ms=%.1f",
            grade, price, low, high, elapsed
        )

        return {
            "predicted_price_usd_per_kg": round(price, 2),
            "price_range_low":   low,
            "price_range_high":  high,
            "currency":          "USD",
            "model_version":     self._meta.get("version", "1.0.0"),
            "grade_label":       grade_labels.get(grade, ""),
            "inference_time_ms": round(elapsed, 2),
        }

    def health_check(self) -> dict[str, Any]:
        return {
            "healthy":        True,
            "model_version":  self._meta.get("version", "unknown"),
            "test_r2":        self._meta.get("test_r2", None),
            "test_rmse":      self._meta.get("test_rmse_usd", None),
            "test_mape_pct":  self._meta.get("test_mape_pct", None),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # PRIVATE: feature engineering  (mirrors Colab Cell 5 exactly)
    # ─────────────────────────────────────────────────────────────────────────

    def _engineer(self, d: dict[str, Any]):
        """
        Convert the raw feature dict (18 keys) into the 22-element
        engineered feature array expected by the trained model.

        This method MUST stay byte-for-byte identical to the
        engineer_features() function in the Colab notebook.
        If you retrain with different features, update both.
        """
        import math
        import numpy as np

        # ── Ordinal maps ─────────────────────────────────────────────────────
        grade_ord     = {"C": 1, "B": 2, "A": 3}
        size_ord      = {"Small": 1, "Medium": 2, "Large": 3}
        condition_ord = {"Overripe": 1, "Slightly Bruised": 2, "Fresh": 3}
        supply_ord    = {"Low": 1, "Medium": 2, "High": 3}
        demand_ord    = {"Low": 1, "Medium": 2, "High": 3}
        season_ord    = {"Rainy": 1, "Winter": 2, "Dry": 3}
        market_ord    = {"Farm Gate": 1, "Wholesale": 2, "Retail": 3}

        # ── Month cyclical encoding ───────────────────────────────────────────
        month_num_map = {
            "January": 1, "February": 2, "March": 3,  "April": 4,
            "May": 5,     "June": 6,     "July": 7,   "August": 8,
            "September": 9, "October": 10, "November": 11, "December": 12,
        }

        go   = grade_ord.get(d.get("tomato_grade", "B"), 2)
        so   = size_ord.get(d.get("tomato_size", "Medium"), 2)
        co   = condition_ord.get(d.get("tomato_condition", "Fresh"), 3)
        sup  = supply_ord.get(d.get("supply_level", "Medium"), 2)
        dem  = demand_ord.get(d.get("demand_level", "Medium"), 2)
        seo  = season_ord.get(d.get("season", "Dry"), 3)
        mo   = market_ord.get(d.get("market_type", "Retail"), 3)

        m_num = month_num_map.get(d.get("month", "July"), 7)
        m_sin = math.sin(2 * math.pi * m_num / 12)
        m_cos = math.cos(2 * math.pi * m_num / 12)

        # Interaction features
        sd_ratio    = sup / max(dem, 1)
        dem_minus   = dem - sup
        grade_cond  = go * co
        grade_mkt   = go * mo

        # Label encoding (must match the LabelEncoders saved in the bundle)
        def le_transform(col: str, val: str, fallback: int = 0) -> int:
            le = self._encoders.get(col)
            if le is None:
                return fallback
            try:
                return int(le.transform([val])[0])
            except Exception:
                return fallback

        mkt_enc  = le_transform("market_type",       d.get("market_type", "Retail"))
        pkg_enc  = le_transform("packaging_type",    d.get("packaging_type", "Crate"))
        wth_enc  = le_transform("weather_condition", d.get("weather_condition", "Normal"))
        prd_enc  = le_transform("production_method", d.get("production_method", "Open Field"))

        # Target encoding  (province / district → mean price from training)
        def target_enc(col_key: str, val: str) -> float:
            enc = self._encoders.get(col_key)
            if enc is None:
                return 1.44   # global mean fallback
            return float(enc.get(val, enc.mean() if hasattr(enc, "mean") else 1.44))

        prov_enc = target_enc("province_target", d.get("province", "Harare"))
        dist_enc = target_enc("district_target", d.get("district",  "Harare"))

        transport = float(d.get("transport_distance_km", 100))
        fuel      = float(d.get("fuel_price_usd_per_litre", 1.72))

        # ── Build feature vector (22 features, same order as training) ────────
        x = np.array([[
            go, so, co, sup, dem, seo, mo,          # 7 ordinal
            m_num, m_sin, m_cos,                     # 3 cyclical month
            sd_ratio, dem_minus, grade_cond, grade_mkt,  # 4 interactions
            mkt_enc, pkg_enc, wth_enc, prd_enc,      # 4 label-encoded
            prov_enc, dist_enc,                      # 2 target-encoded
            transport, fuel,                         # 2 numeric
        ]], dtype=np.float64)

        return x
