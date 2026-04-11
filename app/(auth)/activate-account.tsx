import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";

const API_BASE_URL = `${getApiUrl().replace(/\/$/, "")}/api/v1`;

export default function ActivateAccountScreen() {
  const insets = useSafeAreaInsets();
  const { resendVerification } = useAuth();
  const params = useLocalSearchParams();
  const codeRef = useRef<TextInput>(null);

  const initialEmail = useMemo(() => {
    const raw = params.email;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && raw.length > 0) return raw[0];
    return "";
  }, [params.email]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  // Auto-redirect to login after successful activation
  useEffect(() => {
    if (activationSuccess) {
      const timer = setTimeout(() => {
        router.replace("/(auth)/login");
      }, 3000); // 3 seconds to show success message

      return () => clearTimeout(timer);
    }
  }, [activationSuccess, router]);

  const handleVerify = async () => {
    const errs: { email?: string; code?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Enter a valid email address";
    if (!code.trim()) errs.code = "Verification code is required";
    else if (code.trim().length !== 6) errs.code = "Code must be 6 digits";
    else if (!/^\d{6}$/.test(code.trim())) errs.code = "Code must contain only numbers";

    setErrors(errs);
    setApiError("");

    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email-code/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setActivationSuccess(true);
      } else {
        const data = await response.json();
        setApiError(data.message || "Verification failed. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setApiError(error.message || "Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address first");
      return;
    }

    setShowResend(true);
    try {
      await resendVerification(email.trim());
      Alert.alert(
        "Code Resent",
        `We've sent a new verification code to ${email}`,
        [{ text: "OK", onPress: () => setShowResend(false) }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to resend verification code");
      setShowResend(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={16}
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Activate Your Account</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to your email to activate your account
            </Text>
          </View>

          <View style={styles.form}>
            {apiError ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>{apiError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email Address</Text>
              <View
                style={[
                  styles.inputWrap,
                  errors.email ? styles.inputError : null,
                ]}
              >
                <Feather
                  name="mail"
                  size={18}
                  color={errors.email ? Colors.error : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                  }}
                  placeholder="Your email address"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => codeRef.current?.focus()}
                />
              </View>
              {errors.email ? (
                <Text style={styles.fieldError}>{errors.email}</Text>
              ) : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Verification Code</Text>
              <View
                style={[
                  styles.inputWrap,
                  errors.code ? styles.inputError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={errors.code ? Colors.error : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={codeRef}
                  style={styles.input}
                  value={code}
                  onChangeText={(v) => {
                    // Only allow numbers
                    const cleaned = v.replace(/[^0-9]/g, "").slice(0, 6);
                    setCode(cleaned);
                    if (errors.code)
                      setErrors((e) => ({ ...e, code: undefined }));
                  }}
                  placeholder="000000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={6}
                  onSubmitEditing={handleVerify}
                />
              </View>
              {errors.code ? (
                <Text style={styles.fieldError}>{errors.code}</Text>
              ) : null}
            </View>

            <View style={styles.infoBox}>
              <Feather name="info" size={16} color={Colors.info} />
              <Text style={styles.infoBoxText}>
                Enter the 6-digit code from your email. It expires in 24 hours.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                (loading || !code.trim() || !email.trim()) && styles.btnDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading || !code.trim() || !email.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Activate Account</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.resendBtn,
                pressed && styles.resendBtnPressed,
                showResend && styles.resendBtnDisabled,
              ]}
              onPress={handleResend}
              disabled={showResend}
            >
              <Text style={styles.resendText}>Didn't receive the code? Resend</Text>
            </Pressable>
          </View>

          {activationSuccess && (
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <Feather name="check-circle" size={64} color={Colors.success} />
              </View>
              <Text style={styles.successTitle}>Account Activated!</Text>
              <Text style={styles.successMessage}>
                Your account has been successfully activated. You can now log in with your credentials.
              </Text>
              <Text style={styles.redirectMessage}>
                Redirecting to login page in a few seconds...
              </Text>
              <Pressable
                style={styles.loginNowButton}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.loginNowText}>Go to Login Now</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Changed your mind? </Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerLink}>Back to Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { marginBottom: 36 },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  form: { gap: 20 },
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
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  infoBoxText: {
    flex: 1,
    color: Colors.info,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnPressed: {
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  resendBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  resendBtnPressed: {
    opacity: 0.7,
  },
  resendBtnDisabled: {
    opacity: 0.5,
  },
  resendText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.success,
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 16,
  },
  redirectMessage: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 24,
  },
  loginNowButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginNowText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});