import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
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
import { Feather } from "@expo/vector-icons";

function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = "Enter a valid email address";
  if (!password) errors.password = "Password is required";
  else if (password.length < 8)
    errors.password = "Password must be at least 8 characters";
  return errors;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, verifyTwoFactor } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [userId, setUserId] = useState("");
  const pwRef = useRef<TextInput>(null);
  const twoFactorRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    const errs = validate(email, password);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem("@agrilink_flash", "login_success");
      router.replace("/(tabs)");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.message === '2FA_REQUIRED') {
        // Get user ID from AsyncStorage for 2FA
        try {
          const storedUserId = await AsyncStorage.getItem('@agrilink_auth_user_2fa_user_id');
          if (storedUserId) {
            setUserId(storedUserId);
            setShow2FA(true);
          } else {
            setApiError("2FA required but user ID not found. Please try logging in again.");
          }
        } catch {
          setApiError("2FA setup error. Please try logging in again.");
        }
      } else if (error.message === 'EMAIL_NOT_VERIFIED') {
        Alert.alert(
          "Email Not Verified",
          "Please check your email and verify your account before logging in.",
          [
            { text: "OK", style: "default" },
            { text: "Resend", onPress: () => handleResendVerification() }
          ]
        );
      } else {
        setApiError(error.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async () => {
    if (!twoFactorCode && !backupCode) {
      setApiError("Please enter a 2FA code or backup code");
      return;
    }

    setLoading(true);
    try {
      await verifyTwoFactor({
        user_id: userId,
        token: useBackupCode ? undefined : twoFactorCode,
        backup_code: useBackupCode ? backupCode : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem("@agrilink_flash", "login_success");
      router.replace("/(tabs)");
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setApiError(error.message || "2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    // This would call the resend verification endpoint
    Alert.alert("Verification Email Sent", "Please check your email for the verification link.");
  };

  const handleBackToLogin = () => {
    setShow2FA(false);
    setTwoFactorCode("");
    setBackupCode("");
    setUseBackupCode(false);
    setApiError("");
  };

  if (show2FA) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Two-Factor Authentication</Text>
              <Text style={styles.subtitle}>
                Enter the verification code sent to your email
              </Text>
            </View>

            {apiError ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            ) : null}

            {!useBackupCode ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  ref={twoFactorRef}
                  style={[styles.input, styles.codeInput]}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={Colors.textLight}
                  value={twoFactorCode}
                  onChangeText={setTwoFactorCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Backup Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="Enter 8-digit backup code"
                  placeholderTextColor={Colors.textLight}
                  value={backupCode}
                  onChangeText={setBackupCode}
                  keyboardType="number-pad"
                  maxLength={8}
                  textAlign="center"
                  autoCapitalize="none"
                />
              </View>
            )}

            <Pressable
              style={styles.switchButton}
              onPress={() => {
                setUseBackupCode(!useBackupCode);
                setApiError("");
                setTwoFactorCode("");
                setBackupCode("");
              }}
            >
              <Text style={styles.switchButtonText}>
                {useBackupCode ? "Use verification code" : "Use backup code"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handle2FAVerification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>

            <Pressable style={styles.backButton} onPress={handleBackToLogin}>
              <Text style={styles.backButtonText}>Back to Login</Text>
            </Pressable>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    );
  }

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
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={16}
          >
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to your AgriLink account
            </Text>
          </View>

          {/* Form */}
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
                  placeholder="Enter your email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => pwRef.current?.focus()}
                />
              </View>
              {errors.email ? (
                <Text style={styles.fieldError}>{errors.email}</Text>
              ) : null}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputWrap,
                  errors.password ? styles.inputError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={errors.password ? Colors.error : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={pwRef}
                  style={styles.input}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errors.password)
                      setErrors((e) => ({ ...e, password: undefined }));
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
                  <Feather
                    name={showPw ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password ? (
                <Text style={styles.fieldError}>{errors.password}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => router.replace("/(auth)/forgot-password")}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Text style={styles.forgotPasswordLink}>Forgot your password?</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.replace("/(auth)/register")}>
              <Text style={styles.footerLink}>Create one</Text>
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
    fontFamily: "Inter_400Regular",
    marginLeft: 2,
  },
  forgotPasswordLink: {
    textAlign: "right",
    color: Colors.primary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
    marginBottom: 4,
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
    marginTop: 36,
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
  // 2FA specific styles
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
  },
  codeInput: {
    textAlign: "center",
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginLeft: 8,
    flex: 1,
  },
  switchButton: {
    alignItems: "center",
    marginBottom: 20,
  },
  switchButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  backButton: {
    alignItems: "center",
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
