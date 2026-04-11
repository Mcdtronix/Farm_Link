import { Colors } from "@/constants/colors";
import { COUNTIES } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/data/mock";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  location: string;
  county: string;
  farmSize: string;
  bio: string;
}

type FieldErrors = Partial<Record<keyof FormData, string>>;

function validate(data: FormData): FieldErrors {
  const e: FieldErrors = {};
  if (!data.name.trim()) e.name = "Full name is required";
  else if (data.name.trim().length < 2) e.name = "Name must be at least 2 characters";

  if (!data.email.trim()) e.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
    e.email = "Enter a valid email address";

  if (!data.phone.trim()) e.phone = "Phone number is required";
  else if (!/^(\+263|0)[67]\d{8}$/.test(data.phone.replace(/\s/g, "")))
    e.phone = "Enter a valid Zimbabwean phone number (e.g., +263712345678 or 0712345678)";

  if (!data.password) e.password = "Password is required";
  else if (data.password.length < 8) e.password = "Password must be at least 8 characters";
  else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(data.password))
    e.password = "Password must contain uppercase, lowercase, number, and special character";

  if (!data.confirmPassword) e.confirmPassword = "Please confirm your password";
  else if (data.password !== data.confirmPassword) e.confirmPassword = "Passwords do not match";

  if (!data.role) e.role = "Please select your role";

  if (!data.county.trim()) e.county = "County is required";
  if (!data.location.trim()) e.location = "Location is required";

  return e;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "farmer",
    location: "",
    county: "",
    farmSize: "",
    bio: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCountyPicker, setShowCountyPicker] = useState(false);

  const set = (key: keyof FormData) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleRegister = async () => {
    const errs = validate(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        password2: form.confirmPassword,
        role: form.role,
        location: form.location.trim(),
        county: form.county,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/(auth)/activate-account",
        params: { email: form.email.trim() },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";

      // Always redirect to activation page, even when backend indicates verification required.
      if (msg === 'EMAIL_VERIFICATION_REQUIRED') {
        router.replace({
          pathname: "/(auth)/activate-account",
          params: { email: form.email.trim() },
        });
        return;
      }

      setApiError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 60),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join thousands of farmers and buyers</Text>
          </View>

          {/* Role Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>I am a</Text>
            <View style={styles.roleRow}>
              <RoleCard
                role="farmer"
                selected={form.role === "farmer"}
                onPress={() => set("role")("farmer")}
                icon="sprout"
                label="Farmer"
                desc="Sell my produce"
              />
              <RoleCard
                role="buyer"
                selected={form.role === "buyer"}
                onPress={() => set("role")("buyer")}
                icon="shopping-bag"
                label="Buyer"
                desc="Buy fresh produce"
              />
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {apiError ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Personal Information</Text>

            <InputField
              label="Full Name"
              icon="user"
              value={form.name}
              onChangeText={set("name")}
              placeholder="e.g. James Mwangi"
              error={errors.name}
            />
            <InputField
              label="Email Address"
              icon="mail"
              value={form.email}
              onChangeText={set("email")}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <InputField
              label="Phone Number"
              icon="phone"
              value={form.phone}
              onChangeText={set("phone")}
              placeholder="+263 7X XXX XXXX"
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Location</Text>

            <InputField
              label="Town / Area"
              icon="map-pin"
              value={form.location}
              onChangeText={set("location")}
              placeholder="e.g. Mbare, Harare"
              error={errors.location}
            />

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>County</Text>
              <Pressable
                style={[
                  styles.inputWrap,
                  errors.county ? styles.inputError : null,
                ]}
                onPress={() => setShowCountyPicker(true)}
              >
                <Feather name="map" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
                <Text
                  style={[
                    styles.inputText,
                    !form.county && { color: Colors.textMuted },
                  ]}
                >
                  {form.county || "Select your county"}
                </Text>
                <Feather name="chevron-down" size={18} color={Colors.textMuted} />
              </Pressable>
              {errors.county ? (
                <Text style={styles.fieldError}>{errors.county}</Text>
              ) : null}
            </View>

            {form.role === "farmer" && (
              <InputField
                label="Farm Size (optional)"
                icon="grid"
                value={form.farmSize}
                onChangeText={set("farmSize")}
                placeholder="e.g. 5 acres"
                error={errors.farmSize}
              />
            )}

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Security</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, errors.password ? styles.inputError : null]}>
                <Feather name="lock" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  value={form.password}
                  onChangeText={set("password")}
                  placeholder="Min 6 chars, letters & numbers"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPw}
                />
                <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
                  <Feather name={showPw ? "eye-off" : "eye"} size={18} color={Colors.textMuted} />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrap, errors.confirmPassword ? styles.inputError : null]}>
                <Feather name="lock" size={18} color={Colors.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  value={form.confirmPassword}
                  onChangeText={set("confirmPassword")}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showCpw}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable onPress={() => setShowCpw((s) => !s)} hitSlop={10}>
                  <Feather name={showCpw ? "eye-off" : "eye"} size={18} color={Colors.textMuted} />
                </Pressable>
              </View>
              {errors.confirmPassword ? (
                <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
              ) : null}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* County Picker Modal */}
        {showCountyPicker && (
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowCountyPicker(false)}
          >
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.pickerTitle}>Select County</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {COUNTIES.filter((c) => c !== "All Counties").map((county) => (
                  <Pressable
                    key={county}
                    style={[
                      styles.pickerItem,
                      form.county === county && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      set("county")(county);
                      setShowCountyPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        form.county === county && styles.pickerItemTextSelected,
                      ]}
                    >
                      {county}
                    </Text>
                    {form.county === county && (
                      <Feather name="check" size={18} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

function RoleCard({
  role,
  selected,
  onPress,
  icon,
  label,
  desc,
}: {
  role: UserRole;
  selected: boolean;
  onPress: () => void;
  icon: string;
  label: string;
  desc: string;
}) {
  return (
    <Pressable
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={icon as never}
        size={28}
        color={selected ? Colors.primary : Colors.textMuted}
      />
      <Text
        style={[styles.roleLabel, selected && { color: Colors.primary }]}
      >
        {label}
      </Text>
      <Text style={styles.roleDesc}>{desc}</Text>
    </Pressable>
  );
}

function InputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <Feather name={icon} size={18} color={error ? Colors.error : Colors.textMuted} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "words"}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { marginBottom: 28 },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 6,
  },
  roleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#EEF7F0",
  },
  roleLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  roleDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  form: { gap: 16 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.error,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  fieldWrap: { gap: 6 },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.error },
  fieldError: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  footerLink: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: "center",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemSelected: { backgroundColor: "#F0F9F4", borderRadius: 8, paddingHorizontal: 8 },
  pickerItemText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  pickerItemTextSelected: { color: Colors.primary },
});
