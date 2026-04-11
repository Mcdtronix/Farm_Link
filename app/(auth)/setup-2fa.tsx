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

export default function SetupTwoFactorScreen() {
  const insets = useSafeAreaInsets();
  const { setupTwoFactor, verifyTwoFactorSetup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");

  const handleSetupTwoFactor = async () => {
    setLoading(true);
    setError("");
    
    try {
      const codes = await setupTwoFactor('email');
      setBackupCodes(codes);
      setStep('verify');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setError(error.message || "Failed to setup 2FA");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationCode) {
      setError("Please enter the verification code");
      return;
    }

    setVerifying(true);
    setError("");
    
    try {
      const success = await verifyTwoFactorSetup(verificationCode);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "2FA Setup Complete",
          "Two-factor authentication has been successfully enabled for your account. Save your backup codes in a secure location.",
          [
            { text: "OK", onPress: () => router.back() }
          ]
        );
      }
    } catch (error: any) {
      setError(error.message || "Verification failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel 2FA Setup",
      "Are you sure you want to cancel? Your account will not be protected by 2FA.",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: () => router.back() }
      ]
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
            <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <Feather name="shield" size={50} color={Colors.primary} />
            <Text style={styles.title}>
              {step === 'setup' ? 'Setup Two-Factor Authentication' : 'Verify 2FA Setup'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'setup' 
                ? 'Add an extra layer of security to your account'
                : 'Enter the verification code sent to your email'
              }
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 'setup' ? (
            <View style={styles.setupContent}>
              <View style={styles.featureBox}>
                <Feather name="mail" size={24} color={Colors.primary} />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Email-based 2FA</Text>
                  <Text style={styles.featureDescription}>
                    Receive a 6-digit code via email when signing in
                  </Text>
                </View>
              </View>

              <View style={styles.featureBox}>
                <Feather name="key" size={24} color={Colors.primary} />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Backup Codes</Text>
                  <Text style={styles.featureDescription}>
                    Get 10 one-time backup codes for emergency access
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSetupTwoFactor}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.buttonText}>Enable 2FA</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.verifyContent}>
              <View style={styles.backupCodesSection}>
                <Text style={styles.backupCodesTitle}>Backup Codes</Text>
                <Text style={styles.backupCodesWarning}>
                  Save these codes in a secure location. Each code can only be used once.
                </Text>
                <View style={styles.codesGrid}>
                  {backupCodes.map((code, index) => (
                    <View key={index} style={styles.codeItem}>
                      <Text style={styles.codeText}>{code}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.verificationSection}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={Colors.textLight}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                />
              </View>

              <Pressable
                style={[styles.button, verifying && styles.buttonDisabled]}
                onPress={handleVerifySetup}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.buttonText}>Verify Setup</Text>
                )}
              </Pressable>
            </View>
          )}

          <Pressable style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel Setup</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 24 },
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
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginTop: 16,
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
  setupContent: {
    gap: 24,
  },
  featureBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  verifyContent: {
    gap: 24,
  },
  backupCodesSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backupCodesTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  backupCodesWarning: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.warning,
    marginBottom: 16,
    lineHeight: 20,
  },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codeItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  verificationSection: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  codeInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    textAlign: "center",
    letterSpacing: 2,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
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
  cancelButton: {
    alignItems: "center",
    marginTop: 16,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
