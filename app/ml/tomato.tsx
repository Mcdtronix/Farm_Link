import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Image,
  Platform,
} from "react-native";

import { getApiUrl } from "@/lib/query-client";

const AUTH_USER_KEY = "@agrilink_auth_user";
const AUTH_ACCESS_KEY = "@agrilink_auth_user_access";
const AUTH_REFRESH_KEY = "@agrilink_auth_user_refresh";

const API_BASE_URL = `${getApiUrl().replace(/\/$/, "")}/api/v1`;

type Step = "image" | "grading" | "grade_result" | "pricing_form" | "pricing" | "summary";

type MarketData = {
  markets: string[];
  months: string[];
  market_types: string[];
};

type GradeResponse = {
  grading_session_id: string;
  grading: {
    grade: string;
    grade_code: string;
    confidence: number;
    confidence_level: string;
    description?: string;
    marketable?: boolean;
    color_hint?: string;
    inference_time_ms?: number;
    model_version?: string;
  };
  created_at: string;
};

type PriceResponse = {
  grading_session_id: string;
  pricing_session_id: string;
  grading: {
    grade: string;
    grade_code: string;
    confidence: number;
    confidence_level: string;
  };
  pricing: {
    predicted_price_usd_per_kg: number;
    price_range_low: number;
    price_range_high: number;
    currency: string;
    model_version?: string;
    grade_label?: string;
    inference_time_ms?: number;
  };
  user_inputs: {
    market_location: string;
    month: string;
    market_type: string;
    farm_lat?: number | null;
    farm_lon?: number | null;
  };
  created_at: string;
};

function getMimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(AUTH_ACCESS_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TomatoMlTestScreen() {
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("image");
  const [imageUri, setImageUri] = useState<string>("");

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);

  const [pricingLoading, setPricingLoading] = useState(false);
  const [priceResult, setPriceResult] = useState<PriceResponse | null>(null);

  const [marketLocation, setMarketLocation] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [marketType, setMarketType] = useState<string>("");
  const [includeGps, setIncludeGps] = useState<boolean>(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);

  const canUseMl = useMemo(() => user?.role === "farmer", [user?.role]);

  const handleUnauthorized = async () => {
    await AsyncStorage.multiRemove([AUTH_USER_KEY, AUTH_ACCESS_KEY, AUTH_REFRESH_KEY]);
    Alert.alert("Session expired", "Please login again to continue.");
    router.replace("/(auth)/login");
  };

  useEffect(() => {
    if (!canUseMl) return;
    let active = true;
    (async () => {
      try {
        setMarketLoading(true);
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/market-data/`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "Failed to load market data");
        if (!active) return;
        setMarketData(data);
        setMarketLocation(data?.markets?.[0] || "");
        setMonth(data?.months?.[0] || "");
        setMarketType(data?.market_types?.[0] || "Retail");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load market data");
      } finally {
        setMarketLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [canUseMl]);

  const resetAll = () => {
    setStep("image");
    setImageUri("");
    setGradeResult(null);
    setPriceResult(null);
    setIncludeGps(false);
    setGps(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to photos to select an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    setImageUri(uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take a photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    setImageUri(uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const runGrading = async () => {
    if (!imageUri) {
      Alert.alert("Missing photo", "Please upload or take a tomato photo first.");
      return;
    }

    setGradingLoading(true);
    setStep("grading");

    try {
      const headers = await getAuthHeaders();
      const form = new FormData();

      if (Platform.OS === "web") {
        const resp = await fetch(imageUri);
        const blob = await resp.blob();
        const mime = blob.type || getMimeFromUri(imageUri);
        const ext = mime.split("/")[1] || "jpg";
        const file = new File([blob], `tomato.${ext}`, { type: mime });
        form.append("image", file as any);
      } else {
        form.append("image", {
          uri: imageUri,
          name: `tomato.${getMimeFromUri(imageUri).split("/")[1] || "jpg"}`,
          type: getMimeFromUri(imageUri),
        } as any);
      }

      const res = await fetch(`${API_BASE_URL}/ml/grade/`, {
        method: "POST",
        headers,
        body: form,
      });

      if (res.status === 401) {
        await handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Grading failed");

      setGradeResult(data);
      setStep("grade_result");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setStep("image");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Grading failed", e?.message || "Please try again.");
    } finally {
      setGradingLoading(false);
    }
  };

  const fetchGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setIncludeGps(false);
      Alert.alert("Location permission", "Location permission was not granted.");
      return;
    }

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  const runPricing = async () => {
    if (!gradeResult?.grading_session_id) {
      Alert.alert("Missing grade", "Please grade the image first.");
      return;
    }

    const gradeLower = String(gradeResult?.grading?.grade || "").toLowerCase();
    if (gradeLower.includes("reject") || gradeLower.includes("dimmed")) {
      Alert.alert("Pricing unavailable", "This tomato is rejected/dimmed by the grading model and cannot be priced.");
      return;
    }

    if (!marketLocation || !month || !marketType) {
      Alert.alert("Missing details", "Please fill in market location, month, and market type.");
      return;
    }

    setPricingLoading(true);
    setStep("pricing");

    try {
      let farm_lat: number | null | undefined = undefined;
      let farm_lon: number | null | undefined = undefined;

      if (includeGps) {
        if (!gps) await fetchGps();
        const current = gps;
        if (current) {
          farm_lat = current.lat;
          farm_lon = current.lon;
        }
      }

      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/ml/price/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          grading_session_id: gradeResult.grading_session_id,
          market_location: marketLocation,
          month,
          market_type: marketType,
          ...(farm_lat != null && farm_lon != null ? { farm_lat, farm_lon } : {}),
        }),
      });

      if (res.status === 401) {
        await handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Pricing failed");

      setPriceResult(data);
      setStep("summary");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setStep("pricing_form");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Pricing failed", e?.message || "Please try again.");
    } finally {
      setPricingLoading(false);
    }
  };

  if (!canUseMl) {
    return (
      <View style={styles.center}>
        <Feather name="lock" size={30} color={Colors.textMuted} />
        <Text style={styles.centerTitle}>Farmer feature</Text>
        <Text style={styles.centerSub}>Tomato grading & pricing is available for farmer accounts.</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.screenTitle}>Tomato Grading & Pricing</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.h1}>1) Upload or take a tomato photo</Text>
          <Text style={styles.p}>
            Make sure the tomato is well lit, centered, and in focus.
          </Text>

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Feather name="image" size={28} color={Colors.textMuted} />
              <Text style={styles.previewText}>No image selected</Text>
            </View>
          )}

          <View style={styles.row}>
            <Pressable style={styles.secondaryBtn} onPress={pickImage}>
              <Text style={styles.secondaryBtnText}>Choose Photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={takePhoto}>
              <Text style={styles.secondaryBtnText}>Take Photo</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.primaryBtn, gradingLoading && styles.btnDisabled]}
            disabled={gradingLoading}
            onPress={runGrading}
          >
            {gradingLoading || step === "grading" ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Get Grade</Text>
            )}
          </Pressable>
        </View>

        {gradeResult ? (
          <View style={styles.card}>
            <Text style={styles.h1}>2) Grade result</Text>

            <View style={styles.resultBox}>
              <View style={styles.resultLeft}>
                <Text style={styles.resultLabel}>Grade</Text>
                <Text style={styles.resultValue}>{gradeResult.grading.grade}</Text>
              </View>
              <View style={styles.resultRight}>
                <Text style={styles.resultLabel}>Confidence</Text>
                <Text style={styles.resultValue}>{Math.round(gradeResult.grading.confidence)}%</Text>
              </View>
            </View>

            {gradeResult.grading.description ? (
              <Text style={styles.p}>{gradeResult.grading.description}</Text>
            ) : null}

            <Text style={[styles.p, { marginTop: 10 }]}>Do you want to check the possible market price?</Text>

            {(() => {
              const gradeLower = String(gradeResult.grading.grade).toLowerCase();
              const isRejected = gradeLower.includes("reject") || gradeLower.includes("dimmed");
              if (isRejected) {
                return (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      This tomato is rejected/dimmed by the grading model. Pricing is not available.
                    </Text>
                  </View>
                );
              }

              return (
                <View style={styles.row}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setStep("pricing_form");
                      setPriceResult(null);
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Yes, check price</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      Alert.alert("Done", "You can run another test anytime.");
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Not now</Text>
                  </Pressable>
                </View>
              );
            })()}
          </View>
        ) : null}

        {step === "pricing_form" ? (
          <View style={styles.card}>
            <Text style={styles.h1}>3) Pricing details</Text>
            <Text style={styles.p}>Select the market context so the pricing model can estimate a realistic range.</Text>

            {marketLoading ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null}

            <Field label="Market" value={marketLocation || "Select"} />
            <Selector
              items={marketData?.markets || []}
              value={marketLocation}
              onChange={setMarketLocation}
            />

            <Field label="Month" value={month || "Select"} />
            <Selector items={marketData?.months || []} value={month} onChange={setMonth} />

            <Field label="Market type" value={marketType || "Select"} />
            <Selector items={marketData?.market_types || []} value={marketType} onChange={setMarketType} />

            <Pressable
              style={styles.toggleRow}
              onPress={() => {
                const next = !includeGps;
                setIncludeGps(next);
                if (!next) setGps(null);
              }}
            >
              <View style={[styles.checkbox, includeGps && styles.checkboxOn]}>
                {includeGps ? <Feather name="check" size={14} color={Colors.textOnPrimary} /> : null}
              </View>
              <Text style={styles.toggleText}>Include farm GPS (optional)</Text>
            </Pressable>

            <Pressable
              style={[styles.primaryBtn, pricingLoading && styles.btnDisabled]}
              disabled={pricingLoading}
              onPress={runPricing}
            >
              {pricingLoading ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Get Price Estimate</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {priceResult && step === "summary" ? (
          <View style={styles.card}>
            <Text style={styles.h1}>Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Grade</Text>
              <Text style={styles.summaryValue}>{priceResult.grading.grade}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Confidence</Text>
              <Text style={styles.summaryValue}>{Math.round(priceResult.grading.confidence)}%</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated price</Text>
              <Text style={styles.summaryValue}>
                {priceResult.pricing.currency} {priceResult.pricing.predicted_price_usd_per_kg.toFixed(2)}/kg
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Range</Text>
              <Text style={styles.summaryValue}>
                {priceResult.pricing.currency} {priceResult.pricing.price_range_low.toFixed(2)} – {priceResult.pricing.price_range_high.toFixed(2)}/kg
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Market</Text>
              <Text style={styles.summaryValue}>{priceResult.user_inputs.market_location}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Month</Text>
              <Text style={styles.summaryValue}>{priceResult.user_inputs.month}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Market type</Text>
              <Text style={styles.summaryValue}>{priceResult.user_inputs.market_type}</Text>
            </View>

            <View style={styles.row}>
              <Pressable style={styles.secondaryBtn} onPress={resetAll}>
                <Text style={styles.secondaryBtnText}>Test another photo</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)")}>
                <Text style={styles.secondaryBtnText}>Back to Home</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 14, marginBottom: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Selector({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!items.length) {
    return (
      <View style={styles.selectorEmpty}>
        <Text style={styles.selectorEmptyText}>No options available</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
      {items.map((it) => {
        const selected = it === value;
        return (
          <Pressable
            key={it}
            onPress={() => onChange(it)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{it}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 120,
    backgroundColor: Colors.background,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  screenTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
  },
  h1: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  p: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: Colors.borderLight,
  },
  previewPlaceholder: {
    height: 220,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  previewText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  btnDisabled: {
    opacity: 0.75,
  },
  resultBox: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  resultLeft: {
    flex: 1,
    backgroundColor: "#EEF7F0",
    borderRadius: 14,
    padding: 14,
  },
  resultRight: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
  },
  resultLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  resultValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  fieldValue: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  selectorRow: {
    paddingBottom: 4,
    gap: 8,
  },
  warningBox: {
    backgroundColor: "#FEF3F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#B91C1C",
  },
  selectorEmpty: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorEmptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#EEF7F0",
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  pillTextSelected: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
  toggleRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  checkboxOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },
  centerTitle: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  centerSub: {
    marginTop: 6,
    marginBottom: 18,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
