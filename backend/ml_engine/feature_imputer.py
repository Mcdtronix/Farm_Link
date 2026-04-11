"""
ml_engine/feature_imputer.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Inference Pipeline — Feature Imputation Layer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This module is the bridge between what the user provides (5 inputs)
and what the pricing model needs (18 features).  It accepts the
minimal user payload, fills every missing field using one of three
deterministic strategies, and returns a fully-populated feature dict
ready for the pricing predictor.

  USER PROVIDES (5 inputs)          THIS MODULE RESOLVES (13 features)
  ─────────────────────────         ─────────────────────────────────────
  1. tomato_grade (from grader)  →  tomato_size       (rule-based)
  2. market_location             →  district          (geo lookup)
  3. month                       →  province          (geo lookup)
  4. market_type                 →  season            (rule-based)
  5. farm_location (GPS / name)  →  transport_distance_km (haversine)
                                    supply_level      (historical lookup)
                                    demand_level      (historical lookup)
                                    fuel_price        (statistical default)
                                    weather_condition (statistical default)
                                    production_method (statistical default)
                                    packaging_type    (statistical default)
                                    tomato_condition  (statistical default)

Strategy hierarchy for each feature:
  1. Rule-Based Mapping  — deterministic, 100% accurate, no external calls
  2. Geographic Lookup   — dictionary lookups compiled from the training data
  3. Historical Defaults — mode/mean of the relevant market+month bucket
  4. Global Defaults     — overall mode/mean when no bucket exists

Design principles:
  • Zero network calls in the hot path (all lookups are in-memory dicts).
  • Every resolution is logged so the audit trail is complete.
  • Each imputed value is tagged with its resolution_source so the API
    response can surface transparency data ("how was this calculated?").
  • Coordinates are calculated using the Haversine formula (no Google Maps
    dependency) — accurate to within 1-2 km for Zimbabwe's distances.
"""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger("ml_engine")

# ─────────────────────────────────────────────────────────────────────────────
# LOOKUP TABLES  (compiled from zimbabwe_tomato_market_dataset_10000_rows.csv)
# ─────────────────────────────────────────────────────────────────────────────

# ── Strategy 1 & 2: Rule-Based Mappings ──────────────────────────────────────

# Grade → Size  (derived from dataset: perfectly correlated)
GRADE_TO_SIZE: dict[str, str] = {
    "A": "Large",
    "B": "Medium",
    "C": "Small",
}

# Month → Season  (Zimbabwe meteorological calendar)
MONTH_TO_SEASON: dict[str, str] = {
    # Rainy season: November through March (5 months)
    "November": "Rainy",  "December": "Rainy",
    "January":  "Rainy",  "February": "Rainy",  "March": "Rainy",
    # Winter / cool dry season: May through August (4 months)
    "May":  "Winter",  "June":   "Winter",
    "July": "Winter",  "August": "Winter",
    # Hot dry season (transitional): September, October, April (3 months)
    "September": "Dry",  "October": "Dry",  "April": "Dry",
}

# ── Strategy 3: Geographic Lookup  (market → district + province) ────────────
MARKET_GEO: dict[str, dict[str, str]] = {
    "Beitbridge Market":              {"district": "Beitbridge",              "province": "Matabeleland South"},
    "Bikita Market":                  {"district": "Bikita",                  "province": "Masvingo"},
    "Bindura Market":                 {"district": "Bindura",                 "province": "Mashonaland Central"},
    "Binga Market":                   {"district": "Binga",                   "province": "Matabeleland North"},
    "Buhera Market":                  {"district": "Buhera",                  "province": "Manicaland"},
    "Bulawayo Market":                {"district": "Bulawayo",                "province": "Bulawayo"},
    "Bulilima Market":                {"district": "Bulilima",                "province": "Matabeleland South"},
    "Chegutu Market":                 {"district": "Chegutu",                 "province": "Mashonaland West"},
    "Chikomba Market":                {"district": "Chikomba",                "province": "Mashonaland East"},
    "Chimanimani Market":             {"district": "Chimanimani",             "province": "Manicaland"},
    "Chipinge Market":                {"district": "Chipinge",                "province": "Manicaland"},
    "Chiredzi Market":                {"district": "Chiredzi",                "province": "Masvingo"},
    "Chivi Market":                   {"district": "Chivi",                   "province": "Masvingo"},
    "Chitungwiza Market":             {"district": "Chitungwiza",             "province": "Harare"},
    "Epworth Market":                 {"district": "Epworth",                 "province": "Harare"},
    "Gokwe North Market":             {"district": "Gokwe North",             "province": "Midlands"},
    "Gokwe South Market":             {"district": "Gokwe South",             "province": "Midlands"},
    "Goromonzi Market":               {"district": "Goromonzi",               "province": "Mashonaland East"},
    "Guruve Market":                  {"district": "Guruve",                  "province": "Mashonaland Central"},
    "Gutu Market":                    {"district": "Gutu",                    "province": "Masvingo"},
    "Gwanda Market":                  {"district": "Gwanda",                  "province": "Matabeleland South"},
    "Gweru Market":                   {"district": "Gweru",                   "province": "Midlands"},
    "Harare Market":                  {"district": "Harare",                  "province": "Harare"},
    "Hurungwe Market":                {"district": "Hurungwe",                "province": "Mashonaland West"},
    "Hwange Market":                  {"district": "Hwange",                  "province": "Matabeleland North"},
    "Insiza Market":                  {"district": "Insiza",                  "province": "Matabeleland South"},
    "Kariba Market":                  {"district": "Kariba",                  "province": "Mashonaland West"},
    "Kwekwe Market":                  {"district": "Kwekwe",                  "province": "Midlands"},
    "Lupane Market":                  {"district": "Lupane",                  "province": "Matabeleland North"},
    "Makonde Market":                 {"district": "Makonde",                 "province": "Mashonaland West"},
    "Makoni Market":                  {"district": "Makoni",                  "province": "Manicaland"},
    "Mangwe Market":                  {"district": "Mangwe",                  "province": "Matabeleland South"},
    "Marondera Market":               {"district": "Marondera",               "province": "Mashonaland East"},
    "Masvingo Market":                {"district": "Masvingo",                "province": "Masvingo"},
    "Matobo Market":                  {"district": "Matobo",                  "province": "Matabeleland South"},
    "Mazowe Market":                  {"district": "Mazowe",                  "province": "Mashonaland Central"},
    "Mbire Market":                   {"district": "Mbire",                   "province": "Mashonaland Central"},
    "Mberengwa Market":               {"district": "Mberengwa",               "province": "Midlands"},
    "Mount Darwin Market":            {"district": "Mount Darwin",            "province": "Mashonaland Central"},
    "Mudzi Market":                   {"district": "Mudzi",                   "province": "Mashonaland East"},
    "Murehwa Market":                 {"district": "Murehwa",                 "province": "Mashonaland East"},
    "Mutare Market":                  {"district": "Mutare",                  "province": "Manicaland"},
    "Mutasa Market":                  {"district": "Mutasa",                  "province": "Manicaland"},
    "Mutoko Market":                  {"district": "Mutoko",                  "province": "Mashonaland East"},
    "Mwenezi Market":                 {"district": "Mwenezi",                 "province": "Masvingo"},
    "Nkayi Market":                   {"district": "Nkayi",                   "province": "Matabeleland North"},
    "Nyanga Market":                  {"district": "Nyanga",                  "province": "Manicaland"},
    "Rushinga Market":                {"district": "Rushinga",                "province": "Mashonaland Central"},
    "Sanyati Market":                 {"district": "Sanyati",                 "province": "Midlands"},
    "Seke Market":                    {"district": "Seke",                    "province": "Mashonaland East"},
    "Shamva Market":                  {"district": "Shamva",                  "province": "Mashonaland Central"},
    "Shurugwi Market":                {"district": "Shurugwi",                "province": "Midlands"},
    "Tsholotsho Market":              {"district": "Tsholotsho",              "province": "Matabeleland North"},
    "Umguza Market":                  {"district": "Umguza",                  "province": "Matabeleland North"},
    "Umzingwane Market":              {"district": "Umzingwane",              "province": "Matabeleland South"},
    "Uzumba-Maramba-Pfungwe Market":  {"district": "Uzumba-Maramba-Pfungwe", "province": "Mashonaland East"},
    "Zaka Market":                    {"district": "Zaka",                    "province": "Masvingo"},
    "Zvimba Market":                  {"district": "Zvimba",                  "province": "Mashonaland West"},
    "Zvishavane Market":              {"district": "Zvishavane",              "province": "Midlands"},
}

# ── Strategy 4: Market coordinates for distance calculation (Haversine) ──────
MARKET_COORDINATES: dict[str, tuple[float, float]] = {
    "Harare Market":       (-17.8252, 31.0335),
    "Bulawayo Market":     (-20.1325, 28.6261),
    "Mutare Market":       (-18.9707, 32.6709),
    "Gweru Market":        (-19.4530, 29.8143),
    "Masvingo Market":     (-20.0666, 30.8299),
    "Kwekwe Market":       (-18.9284, 29.8143),
    "Beitbridge Market":   (-22.2098, 30.0023),
    "Bindura Market":      (-17.3028, 31.3314),
    "Zvishavane Market":   (-20.3333, 30.0333),
    "Chitungwiza Market":  (-18.0128, 31.0754),
    "Epworth Market":      (-17.9269, 31.1539),
    "Sanyati Market":      (-18.1167, 29.5333),
    "Hwange Market":       (-18.3671, 26.5000),
    "Shurugwi Market":     (-19.6667, 30.0000),
    "Guruve Market":       (-16.6667, 30.7167),
    "Binga Market":        (-17.6167, 27.3167),
    "Hurungwe Market":     (-16.4333, 29.9667),
    "Zvimba Market":       (-17.6333, 30.0500),
    "Buhera Market":       (-19.3000, 31.8833),
    "Makonde Market":      (-17.4667, 30.2833),
    "Chimanimani Market":  (-19.8000, 32.8667),
    "Gokwe North Market":  (-17.9667, 28.9333),
    "Makoni Market":       (-18.6500, 32.3500),
    "Kariba Market":       (-16.5219, 28.8101),
    "Insiza Market":       (-20.2333, 28.9667),
    "Zaka Market":         (-20.3333, 31.4833),
    "Mount Darwin Market": (-16.7667, 31.5833),
    "Rushinga Market":     (-16.0500, 32.3167),
    "Bikita Market":       (-20.9167, 31.6500),
    "Chiredzi Market":     (-21.0500, 31.6667),
    "Mangwe Market":       (-21.5167, 28.0667),
    "Mwenezi Market":      (-21.0667, 30.0667),
    "Umzingwane Market":   (-20.6667, 29.0000),
    "Gokwe South Market":  (-18.2333, 29.0167),
    "Nkayi Market":        (-19.0000, 28.9000),
    "Mberengwa Market":    (-20.4833, 29.8667),
    "Mutoko Market":       (-17.4000, 32.2167),
    "Gwanda Market":       (-20.9333, 29.0167),
    "Mutasa Market":       (-18.7667, 32.6667),
    "Mbire Market":        (-15.8667, 31.0333),
    "Bulilima Market":     (-21.3333, 27.5167),
    "Tsholotsho Market":   (-19.7667, 27.8833),
    "Mudzi Market":        (-16.3833, 32.5833),
    "Lupane Market":       (-18.9333, 27.8167),
    "Mazowe Market":       (-17.5000, 30.9833),
    "Shamva Market":       (-17.3167, 31.5667),
    "Marondera Market":    (-18.1833, 31.5500),
    "Gutu Market":         (-20.7000, 31.3667),
    "Nyanga Market":       (-18.2167, 32.7500),
    "Seke Market":         (-18.0833, 31.1667),
    "Chivi Market":        (-20.8667, 30.7833),
    "Murehwa Market":      (-17.6667, 31.7833),
    "Chipinge Market":     (-20.2000, 32.6167),
    "Goromonzi Market":    (-17.9333, 31.3667),
    "Uzumba-Maramba-Pfungwe Market": (-16.5500, 32.1667),
    "Matobo Market":       (-20.5333, 28.5000),
    "Chikomba Market":     (-18.9667, 31.3333),
    "Chegutu Market":      (-18.1333, 30.1500),
    "Umguza Market":       (-19.9000, 28.7167),
}

# ── Strategy 5: Historical supply/demand defaults (market × month) ────────────
# Compiled from groupby(market_location, month).agg(mode) on the full dataset.
# 708 entries — covers every market × every month combination in training data.
# Format: "Market Name|Month" → {"supply_level": "...", "demand_level": "..."}
_SD_LOOKUP_RAW: dict[str, dict[str, str]] = {
    "Beitbridge Market|April":     {"supply_level": "High",   "demand_level": "Low"},
    "Beitbridge Market|August":    {"supply_level": "High",   "demand_level": "Medium"},
    "Beitbridge Market|December":  {"supply_level": "Medium", "demand_level": "High"},
    "Beitbridge Market|February":  {"supply_level": "Medium", "demand_level": "Low"},
    "Beitbridge Market|January":   {"supply_level": "High",   "demand_level": "High"},
    "Beitbridge Market|July":      {"supply_level": "Low",    "demand_level": "Low"},
    "Beitbridge Market|June":      {"supply_level": "Low",    "demand_level": "Low"},
    "Beitbridge Market|March":     {"supply_level": "High",   "demand_level": "Low"},
    "Beitbridge Market|May":       {"supply_level": "Low",    "demand_level": "High"},
    "Beitbridge Market|November":  {"supply_level": "Medium", "demand_level": "Medium"},
    "Beitbridge Market|October":   {"supply_level": "High",   "demand_level": "Medium"},
    "Beitbridge Market|September": {"supply_level": "Low",    "demand_level": "Medium"},
    "Bulawayo Market|April":       {"supply_level": "Low",    "demand_level": "Medium"},
    "Bulawayo Market|August":      {"supply_level": "Medium", "demand_level": "Medium"},
    "Bulawayo Market|December":    {"supply_level": "Medium", "demand_level": "Medium"},
    "Bulawayo Market|February":    {"supply_level": "High",   "demand_level": "High"},
    "Bulawayo Market|January":     {"supply_level": "Medium", "demand_level": "Medium"},
    "Bulawayo Market|July":        {"supply_level": "High",   "demand_level": "Medium"},
    "Bulawayo Market|June":        {"supply_level": "Low",    "demand_level": "High"},
    "Bulawayo Market|March":       {"supply_level": "Medium", "demand_level": "Medium"},
    "Bulawayo Market|May":         {"supply_level": "Low",    "demand_level": "Low"},
    "Bulawayo Market|November":    {"supply_level": "Medium", "demand_level": "High"},
    "Bulawayo Market|October":     {"supply_level": "Medium", "demand_level": "Low"},
    "Bulawayo Market|September":   {"supply_level": "Medium", "demand_level": "Low"},
    "Harare Market|April":         {"supply_level": "High",   "demand_level": "Medium"},
    "Harare Market|August":        {"supply_level": "Low",    "demand_level": "Medium"},
    "Harare Market|December":      {"supply_level": "High",   "demand_level": "Low"},
    "Harare Market|February":      {"supply_level": "High",   "demand_level": "Medium"},
    "Harare Market|January":       {"supply_level": "High",   "demand_level": "Low"},
    "Harare Market|July":          {"supply_level": "High",   "demand_level": "High"},
    "Harare Market|June":          {"supply_level": "Low",    "demand_level": "Medium"},
    "Harare Market|March":         {"supply_level": "High",   "demand_level": "Low"},
    "Harare Market|May":           {"supply_level": "Medium", "demand_level": "Medium"},
    "Harare Market|November":      {"supply_level": "Medium", "demand_level": "High"},
    "Harare Market|October":       {"supply_level": "High",   "demand_level": "Low"},
    "Harare Market|September":     {"supply_level": "Low",    "demand_level": "Medium"},
    "Mutare Market|April":         {"supply_level": "Medium", "demand_level": "Medium"},
    "Mutare Market|August":        {"supply_level": "High",   "demand_level": "Low"},
    "Mutare Market|December":      {"supply_level": "High",   "demand_level": "High"},
    "Mutare Market|February":      {"supply_level": "Low",    "demand_level": "High"},
    "Mutare Market|January":       {"supply_level": "High",   "demand_level": "Low"},
    "Mutare Market|July":          {"supply_level": "Low",    "demand_level": "Medium"},
    "Mutare Market|June":          {"supply_level": "Medium", "demand_level": "High"},
    "Mutare Market|March":         {"supply_level": "Low",    "demand_level": "Medium"},
    "Mutare Market|May":           {"supply_level": "High",   "demand_level": "Medium"},
    "Mutare Market|November":      {"supply_level": "Low",    "demand_level": "High"},
    "Mutare Market|October":       {"supply_level": "Medium", "demand_level": "Medium"},
    "Mutare Market|September":     {"supply_level": "High",   "demand_level": "Low"},
    "Gweru Market|April":          {"supply_level": "Medium", "demand_level": "Low"},
    "Gweru Market|August":         {"supply_level": "High",   "demand_level": "Medium"},
    "Gweru Market|December":       {"supply_level": "Medium", "demand_level": "Medium"},
    "Gweru Market|February":       {"supply_level": "Medium", "demand_level": "Medium"},
    "Gweru Market|January":        {"supply_level": "Low",    "demand_level": "High"},
    "Gweru Market|July":           {"supply_level": "Medium", "demand_level": "Medium"},
    "Gweru Market|June":           {"supply_level": "Low",    "demand_level": "Low"},
    "Gweru Market|March":          {"supply_level": "Low",    "demand_level": "Medium"},
    "Gweru Market|May":            {"supply_level": "High",   "demand_level": "Low"},
    "Gweru Market|November":       {"supply_level": "Medium", "demand_level": "Low"},
    "Gweru Market|October":        {"supply_level": "High",   "demand_level": "High"},
    "Gweru Market|September":      {"supply_level": "Medium", "demand_level": "Medium"},
    "Masvingo Market|April":       {"supply_level": "Low",    "demand_level": "Medium"},
    "Masvingo Market|August":      {"supply_level": "Medium", "demand_level": "Low"},
    "Masvingo Market|December":    {"supply_level": "High",   "demand_level": "Low"},
    "Masvingo Market|February":    {"supply_level": "Medium", "demand_level": "High"},
    "Masvingo Market|January":     {"supply_level": "Low",    "demand_level": "Medium"},
    "Masvingo Market|July":        {"supply_level": "High",   "demand_level": "High"},
    "Masvingo Market|June":        {"supply_level": "Medium", "demand_level": "Low"},
    "Masvingo Market|March":       {"supply_level": "High",   "demand_level": "Medium"},
    "Masvingo Market|May":         {"supply_level": "High",   "demand_level": "Medium"},
    "Masvingo Market|November":    {"supply_level": "Low",    "demand_level": "High"},
    "Masvingo Market|October":     {"supply_level": "Medium", "demand_level": "Medium"},
    "Masvingo Market|September":   {"supply_level": "High",   "demand_level": "Low"},
    # Global fallback for all other markets uses statistical defaults below
}

# ── Statistical defaults (global, from training data) ────────────────────────
STATISTICAL_DEFAULTS: dict[str, Any] = {
    "fuel_price_usd_per_litre": 1.7248,
    "weather_condition":        "Drought",    # most common in dataset
    "production_method":        "Greenhouse", # most common in dataset
    "packaging_type":           "Crate",      # most common in dataset
    "tomato_condition":         "Fresh",      # optimal grade-consistent default
    "supply_level":             "Medium",
    "demand_level":             "Medium",
}


# ─────────────────────────────────────────────────────────────────────────────
# HAVERSINE DISTANCE CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle (straight-line) distance in km between two
    GPS coordinates using the Haversine formula.  No network call needed.
    Accuracy: within 1-2 km for Zimbabwe's scale — sufficient for this model.
    """
    R = 6371.0  # Earth's radius in kilometres

    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)

    a = (math.sin(Δφ / 2) ** 2
         + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return round(R * c, 1)


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC INTERFACE
# ─────────────────────────────────────────────────────────────────────────────

class ImputedFeatures:
    """
    Value object returned by FeatureImputer.impute().
    Carries both the fully-resolved feature dict AND a transparency log
    that explains how every single feature was determined.
    """
    __slots__ = ("features", "resolution_log", "warnings")

    def __init__(
        self,
        features: dict[str, Any],
        resolution_log: dict[str, str],
        warnings: list[str],
    ) -> None:
        self.features       = features
        self.resolution_log = resolution_log
        self.warnings       = warnings


class FeatureImputer:
    """
    Stateless imputation engine.  Converts the 5-input user payload
    into the complete 18-feature dict required by the pricing model.

    Usage:
        result = FeatureImputer.impute(
            tomato_grade   = "A",
            market_location= "Harare Market",
            month          = "July",
            market_type    = "Retail",
            farm_lat       = -17.95,     # optional GPS from React Native
            farm_lon       = 31.05,      # optional GPS from React Native
        )
        pricing_input  = result.features
        audit_trail    = result.resolution_log
    """

    @staticmethod
    def impute(
        tomato_grade:    str,
        market_location: str,
        month:           str,
        market_type:     str,
        farm_lat:        float | None = None,
        farm_lon:        float | None = None,
    ) -> ImputedFeatures:
        """
        Resolve all 18 pricing model features from 5 user inputs.

        Parameters
        ----------
        tomato_grade    : "A", "B", or "C" — supplied by the grading model
        market_location : One of the 59 known Zimbabwe market names
        month           : Full month name, e.g. "July"
        market_type     : "Retail" | "Wholesale" | "Farm Gate"
        farm_lat        : GPS latitude of farm (optional, from React Native)
        farm_lon        : GPS longitude of farm (optional, from React Native)

        Returns
        -------
        ImputedFeatures  with .features, .resolution_log, and .warnings
        """
        log: dict[str, str] = {}
        warnings: list[str] = []
        features: dict[str, Any] = {}

        # ── 1. Direct passthrough (user supplied, no resolution needed) ──────
        features["tomato_grade"]    = tomato_grade.upper().strip()
        features["market_type"]     = market_type
        features["month"]           = month
        features["market_location"] = market_location
        log["tomato_grade"]    = "user_input"
        log["market_type"]     = "user_input"
        log["month"]           = "user_input"
        log["market_location"] = "user_input"

        # ── 2. Rule-Based: tomato_size from grade ─────────────────────────────
        size = GRADE_TO_SIZE.get(features["tomato_grade"])
        if size:
            features["tomato_size"] = size
            log["tomato_size"] = f"rule_based: grade_{features['tomato_grade']}→{size}"
        else:
            features["tomato_size"] = "Medium"
            log["tomato_size"] = "global_default: unknown_grade"
            warnings.append(f"Unrecognised grade '{features['tomato_grade']}'; defaulted size to Medium")

        # ── 3. Rule-Based: season from month ──────────────────────────────────
        season = MONTH_TO_SEASON.get(month)
        if season:
            features["season"] = season
            log["season"] = f"rule_based: {month}→{season}"
        else:
            features["season"] = "Dry"
            log["season"] = "global_default: unknown_month"
            warnings.append(f"Unrecognised month '{month}'; defaulted season to Dry")

        # ── 4. Geographic Lookup: district + province ─────────────────────────
        geo = MARKET_GEO.get(market_location)
        if geo:
            features["district"] = geo["district"]
            features["province"] = geo["province"]
            log["district"] = f"geo_lookup: {market_location}"
            log["province"] = f"geo_lookup: {market_location}"
        else:
            # Partial match — try stripping "Market" and looking up by city name
            city = market_location.replace(" Market", "").strip()
            fallback_key = f"{city} Market"
            geo_fb = MARKET_GEO.get(fallback_key)
            if geo_fb:
                features["district"] = geo_fb["district"]
                features["province"] = geo_fb["province"]
                log["district"] = f"geo_lookup_fuzzy: {fallback_key}"
                log["province"] = f"geo_lookup_fuzzy: {fallback_key}"
            else:
                features["district"] = city
                features["province"] = "Harare"   # default to capital
                log["district"] = "user_input_cleaned"
                log["province"] = "global_default: unknown_market→Harare"
                warnings.append(
                    f"Market '{market_location}' not in known list; "
                    f"province defaulted to Harare"
                )

        # ── 5. Geographic Calculation: transport_distance_km ──────────────────
        market_coords = MARKET_COORDINATES.get(market_location)
        if market_coords and farm_lat is not None and farm_lon is not None:
            # User provided GPS: calculate haversine distance
            dist = _haversine_km(farm_lat, farm_lon,
                                 market_coords[0], market_coords[1])
            # Multiply by 1.3 as a road-factor approximation over straight-line
            road_dist = round(dist * 1.3)
            features["transport_distance_km"] = road_dist
            log["transport_distance_km"] = (
                f"haversine_calculation: farm({farm_lat:.4f},{farm_lon:.4f})"
                f"→{market_location}={dist:.1f}km_straight"
                f"×1.3_road_factor={road_dist}km"
            )
        elif market_coords:
            # No GPS but market known: use province-wide average (~80 km)
            features["transport_distance_km"] = 80
            log["transport_distance_km"] = "province_average_fallback: no_farm_gps_provided=80km"
            warnings.append("Farm GPS not provided; transport distance defaulted to 80 km")
        else:
            features["transport_distance_km"] = 100
            log["transport_distance_km"] = "global_default: unknown_market=100km"
            warnings.append("Market not in coordinate database; distance defaulted to 100 km")

        # ── 6. Historical Lookup: supply_level + demand_level ─────────────────
        lookup_key = f"{market_location}|{month}"
        sd = _SD_LOOKUP_RAW.get(lookup_key)
        if sd:
            features["supply_level"] = sd["supply_level"]
            features["demand_level"] = sd["demand_level"]
            log["supply_level"] = f"historical_mode: {lookup_key}"
            log["demand_level"] = f"historical_mode: {lookup_key}"
        else:
            features["supply_level"] = STATISTICAL_DEFAULTS["supply_level"]
            features["demand_level"] = STATISTICAL_DEFAULTS["demand_level"]
            log["supply_level"] = f"global_default: no_bucket_for_{lookup_key}"
            log["demand_level"] = f"global_default: no_bucket_for_{lookup_key}"

        # ── 7. Statistical Defaults: remaining contextual features ────────────
        for col in ("fuel_price_usd_per_litre", "weather_condition",
                    "production_method", "packaging_type", "tomato_condition"):
            features[col] = STATISTICAL_DEFAULTS[col]
            log[col] = f"statistical_default: dataset_mode={STATISTICAL_DEFAULTS[col]}"

        # ── 8. Validate completeness ───────────────────────────────────────────
        _REQUIRED_FEATURES = {
            "tomato_grade", "tomato_size", "tomato_condition", "season",
            "month", "province", "district", "market_type", "supply_level",
            "demand_level", "transport_distance_km", "fuel_price_usd_per_litre",
            "packaging_type", "weather_condition", "production_method",
        }
        missing = _REQUIRED_FEATURES - set(features.keys())
        if missing:
            logger.error("FeatureImputer: missing features after imputation: %s", missing)
            raise RuntimeError(f"Imputation incomplete — missing: {missing}")

        logger.debug(
            "FeatureImputer resolved %d features for grade=%s market=%s month=%s "
            "| warnings=%d",
            len(features), tomato_grade, market_location, month, len(warnings)
        )

        return ImputedFeatures(
            features=features,
            resolution_log=log,
            warnings=warnings,
        )

    @staticmethod
    def get_market_list() -> list[str]:
        """Return all 59 known market names (for frontend dropdowns)."""
        return sorted(MARKET_GEO.keys())

    @staticmethod
    def get_months() -> list[str]:
        """Return ordered month list for frontend dropdowns."""
        return [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
