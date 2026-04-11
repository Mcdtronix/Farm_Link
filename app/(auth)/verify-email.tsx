import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/query-client";

const API_BASE_URL = `${getApiUrl().replace(/\/$/, "")}/api/v1`;

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { resendVerification } = useAuth();
  const { token } = useLocalSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      setIsVerifying(true);
      setError("");
      
      const response = await fetch(`${API_BASE_URL}/auth/verify-email/${token}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setIsVerified(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(data.message || "Email verification failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error: any) {
      setError(error.message || "Network error. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    try {
      setError("");
      await resendVerification(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setError("");
    } catch (error: any) {
      setError(error.message || "Failed to resend verification email");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleGoToLogin = () => {
    router.replace("/(auth)/login");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Feather 
              name="mail" 
              size={60} 
              color={isVerified ? Colors.success : Colors.primary} 
            />
            <Text style={styles.title}>
              {isVerifying ? "Verifying Email..." : isVerified ? "Email Verified!" : "Verification Failed"}
            </Text>
            <Text style={styles.subtitle}>
              {isVerifying 
                ? "Please wait while we verify your email address"
                : isVerified 
                  ? "Your account has been successfully verified. You can now log in."
                  : "We couldn't verify your email. The link may have expired."
              }
            </Text>
          </View>

          {isVerifying ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Verifying your email...</Text>
            </View>
          ) : isVerified ? (
            <View style={styles.successContainer}>
              <Feather name="check-circle" size={80} color={Colors.success} />
              <Text style={styles.successText}>
                Your email has been verified successfully!
              </Text>
              <Pressable
                style={[styles.button, styles.successButton]}
                onPress={handleGoToLogin}
              >
                <Text style={styles.buttonText}>Go to Login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Feather name="x-circle" size={80} color={Colors.error} />
              <Text style={styles.errorText}>
                {error || "Email verification failed"}
              </Text>
              
              <View style={styles.resendSection}>
                <Text style={styles.resendText}>
                  Need a new verification email?
                </Text>
                <View style={styles.emailInputContainer}>
                  <Text style={styles.label}>Enter your email</Text>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Enter your email address"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
                <Pressable
                  style={[styles.button, styles.resendButton]}
                  onPress={handleResendEmail}
                >
                  <Text style={styles.buttonText}>Resend Verification</Text>
                </Pressable>
              </View>
              
              <Pressable style={styles.backButton} onPress={handleGoToLogin}>
                <Text style={styles.backButtonText}>Back to Login</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 16,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  successText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.success,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.error,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  resendSection: {
    width: "100%",
    alignItems: "center",
  },
  resendText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  emailInputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: "left",
    alignSelf: "flex-start",
  },
  emailInput: {
    width: "100%",
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
  button: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successButton: {
    backgroundColor: Colors.success,
    minWidth: 200,
  },
  resendButton: {
    backgroundColor: Colors.primary,
    width: "100%",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  backButton: {
    alignItems: "center",
    marginTop: 20,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
