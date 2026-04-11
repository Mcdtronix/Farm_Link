"""
ml_engine/inference_pipeline.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unified Inference Pipeline — Grade → Impute → Price
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This module orchestrates the full two-model inference chain in a
single, thread-safe singleton.  A single call to
  InferencePipeline.get_instance().run(image_bytes, user_inputs)
returns both a grade result AND a price estimate, with every
intermediate step logged for auditability.

Architecture:

  ┌─────────────────────────────────────────────────────┐
  │              InferencePipeline.run()                │
  │                                                     │
  │  ① TomatoGrader.predict_from_bytes(image_bytes)    │
  │     → grade: "A" | "B" | "C" | "Reject"            │
  │     → confidence: float                             │
  │                                                     │
  │  ② FeatureImputer.impute(grade, market, month, ...) │
  │     → 18 fully-resolved pricing features           │
  │     → resolution_log (transparency data)           │
  │                                                     │
  │  ③ TomatoPricingPredictor.predict(features)         │
  │     → predicted_price: float                       │
  │     → price_range_low, price_range_high             │
  │                                                     │
  │  ④ Merged response dict                             │
  └─────────────────────────────────────────────────────┘

Thread safety: both predictors are loaded once at startup via
AppConfig.ready() and reused across all requests.
"""

from __future__ import annotations

import logging
import time
import threading
from typing import Any

logger = logging.getLogger("ml_engine")


class InferencePipeline:
    """
    Thread-safe singleton that owns both ML models and orchestrates
    the full Grade → Impute → Price chain.
    """

    _instance: "InferencePipeline | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        # Lazy imports — models are loaded in AppConfig.ready()
        from ml_engine.predictor import TomatoGrader
        from ml_engine.pricing_predictor import TomatoPricingPredictor

        self._grader  = TomatoGrader.get_instance()
        self._pricer  = TomatoPricingPredictor.get_instance()
        self._healthy = True

    @classmethod
    def get_instance(cls) -> "InferencePipeline":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────────────

    def run(
        self,
        image_bytes:     bytes,
        market_location: str,
        month:           str,
        market_type:     str,
        farm_lat:        float | None = None,
        farm_lon:        float | None = None,
    ) -> dict[str, Any]:
        """
        Execute the full inference pipeline.

        Parameters
        ----------
        image_bytes     : Raw bytes of the uploaded tomato image.
        market_location : e.g. "Harare Market"
        month           : e.g. "July"
        market_type     : "Retail" | "Wholesale" | "Farm Gate"
        farm_lat        : Farm GPS latitude (optional, from React Native)
        farm_lon        : Farm GPS longitude (optional, from React Native)

        Returns
        -------
        dict with keys:
          grading:   { grade, grade_code, confidence, confidence_level,
                       description, marketable, color_hint, all_probabilities,
                       inference_time_ms, model_version, manual_review }
          pricing:   { predicted_price_usd_per_kg, price_range_low,
                       price_range_high, currency, model_version }
          features:  { ...18 resolved features... }
          resolution_log: { ...per-feature source tags... }
          warnings:  [ ...imputation warning strings... ]
          total_inference_time_ms: float
        """
        pipeline_start = time.perf_counter()

        # ─── Stage 1: Grading ─────────────────────────────────────────────────
        logger.info(
            "Pipeline Stage 1 — grading image (%d bytes)", len(image_bytes)
        )
        grading_result = self._grader.predict_from_bytes(image_bytes)

        grade_code = grading_result.get("grade_code", "C")
        logger.info(
            "Stage 1 complete: grade=%s confidence=%.1f%%",
            grade_code, grading_result.get("confidence", 0.0)
        )

        # ─── Stage 2: Feature Imputation ──────────────────────────────────────
        logger.info("Pipeline Stage 2 — imputing pricing features")
        from ml_engine.feature_imputer import FeatureImputer

        imputed = FeatureImputer.impute(
            tomato_grade    = grade_code,
            market_location = market_location,
            month           = month,
            market_type     = market_type,
            farm_lat        = farm_lat,
            farm_lon        = farm_lon,
        )

        logger.info(
            "Stage 2 complete: %d features resolved, %d warnings",
            len(imputed.features), len(imputed.warnings)
        )
        if imputed.warnings:
            for w in imputed.warnings:
                logger.warning("Imputer warning: %s", w)

        # ─── Stage 3: Pricing ─────────────────────────────────────────────────
        logger.info("Pipeline Stage 3 — predicting price")
        pricing_result = self._pricer.predict(imputed.features)

        logger.info(
            "Stage 3 complete: price=%.2f [%.2f–%.2f] USD/kg",
            pricing_result["predicted_price_usd_per_kg"],
            pricing_result["price_range_low"],
            pricing_result["price_range_high"],
        )

        # ─── Merge & Return ───────────────────────────────────────────────────
        total_ms = (time.perf_counter() - pipeline_start) * 1000

        return {
            "grading":          grading_result,
            "pricing":          pricing_result,
            "features":         imputed.features,
            "resolution_log":   imputed.resolution_log,
            "warnings":         imputed.warnings,
            "total_inference_time_ms": round(total_ms, 2),
        }

    def health_check(self) -> dict[str, Any]:
        """Returns health status of both models in the pipeline."""
        grader_health  = self._grader.health_check()
        pricer_health  = self._pricer.health_check()
        return {
            "pipeline_healthy":  grader_health.get("healthy") and pricer_health.get("healthy"),
            "grading_model":     grader_health,
            "pricing_model":     pricer_health,
        }
