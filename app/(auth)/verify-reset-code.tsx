import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
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

export default function VerifyResetCodeScreen() {
  const insets = useSafeAreaInsets();
  const { verifyPasswordResetCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const codeRef = useRef<TextInput>(null);

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
      // Get reset token from storage (from forgot-password flow)
      const resetToken = await AsyncStorage.getItem("@agrilink_auth_user_reset_token");
      if (!resetToken) {
        setApiError("Session expired. Please request a new reset code.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await verifyPasswordResetCode(email.trim(), resetToken, code.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Store email and token for next screen
      await AsyncStorage.setItem("@agrilink_reset_email", email.trim());
      await AsyncStorage.setItem("@agrilink_reset_token", resetToken);
      
      router.replace("/(auth)/reset-password");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error.message || "Verification failed. Please try again.";
      setApiError(message);
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
    // In production, you'd call the forgotPassword function again
    // For now, just show a confirmation
    Alert.alert(
      "Code Resent",
      `We've sent a new verification code to ${email}`,
      [{ text: "OK", onPress: () => setShowResend(false) }]
    );
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
            <Text style={styles.title}>Verify Your Code</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to your email
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
                Enter the 6-digit code from your email. It expires in 10 minutes.
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
                <Text style={styles.submitText}>Verify Code</Text>
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
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputIcon: {},
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.error },
  fieldError: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F0F4FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DFEBFF",
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.info,
    lineHeight: 20,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.5 },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  resendBtn: {
    paddingVertical: 10,
    borderRadius: 8,
  },
  resendBtnPressed: { opacity: 0.7 },
  resendBtnDisabled: { opacity: 0.5 },
  resendText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: 20,
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
});
