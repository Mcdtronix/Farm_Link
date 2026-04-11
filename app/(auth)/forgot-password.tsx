import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
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

function validate(email: string) {
  const errors: { email?: string } = {};
  if (!email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = "Enter a valid email address";
  return errors;
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const errs = validate(email);
    setErrors(errs);
    setApiError("");
    
    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      // Navigate to verification code screen after 2 seconds
      setTimeout(() => {
        router.replace("/(auth)/verify-reset-code");
      }, 2000);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Never reveal if email exists or not
      setApiError("If an account exists with this email, you will receive a password reset code shortly");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
              onPress={() => {
                setSubmitted(false);
                setEmail("");
              }}
              style={styles.backBtn}
              hitSlop={16}
            >
              <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
            </Pressable>

            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={56} color={Colors.success} />
              </View>

              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successText}>
                We've sent a password reset code to {"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              <View style={styles.instructionBox}>
                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Check your email for the verification code
                  </Text>
                </View>

                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Enter the code on the next screen
                  </Text>
                </View>

                <View style={styles.instructionStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Create your new password
                  </Text>
                </View>
              </View>

              <Text style={styles.codeExpiry}>
                ⏱️  Code expires in 10 minutes
              </Text>

              <View style={styles.securityNote}>
                <Feather name="alert-circle" size={16} color={Colors.warning} />
                <Text style={styles.securityNoteText}>
                  Never share this code with anyone
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => router.replace("/(auth)/verify-reset-code")}
              >
                <Text style={styles.submitText}>Continue →</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.textBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSubmitted(false)}
              >
                <Text style={styles.textBtnText}>Use Different Email</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              We'll help you reset your password using a verification code
            </Text>
          </View>

          <View style={styles.form}>
            {apiError ? (
              <View style={styles.infoBanner}>
                <Feather name="info" size={16} color={Colors.info} />
                <Text style={styles.infoBannerText}>{apiError}</Text>
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
                  placeholder="Enter your registered email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
              {errors.email ? (
                <Text style={styles.fieldError}>{errors.email}</Text>
              ) : null}
            </View>

            <View style={styles.infoBox}>
              <Feather name="lock" size={16} color={Colors.primary} />
              <Text style={styles.infoBoxText}>
                We'll send you a 6-digit code via email. Keep it safe and never share it.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Send Reset Code</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign In</Text>
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
  form: { gap: 20, marginBottom: 20 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F4FF",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  infoBannerText: {
    flex: 1,
    color: Colors.info,
    fontSize: 13,
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
    backgroundColor: "#F9F5FF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9DFFF",
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
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

  // Success screen styles
  successContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0FFF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  emailHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  instructionBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    gap: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepNumberText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
    lineHeight: 20,
    paddingTop: 6,
  },
  codeExpiry: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.warning,
    marginBottom: 12,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF9F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    width: "100%",
  },
  securityNoteText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.warning,
    flex: 1,
  },
  textBtn: {
    padding: 10,
  },
  textBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
