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

function validate(password: string, password2: string) {
  const errors: { password?: string; password2?: string } = {};
  
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (!/[A-Z]/.test(password)) {
    errors.password = "Password must contain at least one uppercase letter";
  } else if (!/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one number";
  } else if (!/[!@#$%^&*]/.test(password)) {
    errors.password = "Password must contain at least one special character (!@#$%^&*)";
  }

  if (!password2) {
    errors.password2 = "Please confirm your password";
  } else if (password !== password2) {
    errors.password2 = "Passwords do not match";
  }

  return errors;
}

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    password2?: string;
  }>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const pwRef = useRef<TextInput>(null);
  const pw2Ref = useRef<TextInput>(null);

  const handleReset = async () => {
    const errs = validate(password, password2);
    setErrors(errs);
    setApiError("");

    if (Object.keys(errs).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);
    try {
      const email = await AsyncStorage.getItem("@agrilink_reset_email");
      const token = await AsyncStorage.getItem("@agrilink_reset_token");

      if (!email || !token) {
        setApiError("Session expired. Please request a new password reset.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await resetPassword(email, token, password, password2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Clear reset data
      await AsyncStorage.removeItem("@agrilink_reset_email");
      await AsyncStorage.removeItem("@agrilink_reset_token");

      Alert.alert(
        "Success!",
        "Your password has been reset successfully. You can now log in with your new password.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setApiError(error.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
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
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Make sure it's strong and unique
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
              <Text style={styles.label}>New Password</Text>
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
                  placeholder="Enter your new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPw}
                  returnKeyType="next"
                  onSubmitEditing={() => pw2Ref.current?.focus()}
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

            <View style={styles.passwordRequirements}>
              <View style={styles.requirement}>
                <Feather
                  name={password.length >= 8 ? "check-circle" : "circle"}
                  size={16}
                  color={password.length >= 8 ? Colors.success : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.requirementText,
                    password.length >= 8 && styles.requirementMet,
                  ]}
                >
                  At least 8 characters
                </Text>
              </View>

              <View style={styles.requirement}>
                <Feather
                  name={/[A-Z]/.test(password) ? "check-circle" : "circle"}
                  size={16}
                  color={/[A-Z]/.test(password) ? Colors.success : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.requirementText,
                    /[A-Z]/.test(password) && styles.requirementMet,
                  ]}
                >
                  One uppercase letter
                </Text>
              </View>

              <View style={styles.requirement}>
                <Feather
                  name={/[0-9]/.test(password) ? "check-circle" : "circle"}
                  size={16}
                  color={/[0-9]/.test(password) ? Colors.success : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.requirementText,
                    /[0-9]/.test(password) && styles.requirementMet,
                  ]}
                >
                  One number
                </Text>
              </View>

              <View style={styles.requirement}>
                <Feather
                  name={/[!@#$%^&*]/.test(password) ? "check-circle" : "circle"}
                  size={16}
                  color={/[!@#$%^&*]/.test(password) ? Colors.success : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.requirementText,
                    /[!@#$%^&*]/.test(password) && styles.requirementMet,
                  ]}
                >
                  One special character (!@#$%^&*)
                </Text>
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirm Password</Text>
              <View
                style={[
                  styles.inputWrap,
                  errors.password2 ? styles.inputError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={errors.password2 ? Colors.error : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={pw2Ref}
                  style={styles.input}
                  value={password2}
                  onChangeText={(v) => {
                    setPassword2(v);
                    if (errors.password2)
                      setErrors((e) => ({ ...e, password2: undefined }));
                  }}
                  placeholder="Confirm your new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPw2}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
                <Pressable onPress={() => setShowPw2((s) => !s)} hitSlop={10}>
                  <Feather
                    name={showPw2 ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password2 ? (
                <Text style={styles.fieldError}>{errors.password2}</Text>
              ) : null}
            </View>

            <View style={styles.securityNote}>
              <Feather name="shield" size={16} color={Colors.success} />
              <Text style={styles.securityNoteText}>
                We'll never ask you for your password via email
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.btnPressed,
                loading && styles.btnDisabled,
              ]}
              onPress={handleReset}
              disabled={loading || !password || !password2}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Reset Password</Text>
              )}
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
  passwordRequirements: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  requirementText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  requirementMet: {
    color: Colors.success,
    fontFamily: "Inter_500Medium",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FFF4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  securityNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.success,
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
});
