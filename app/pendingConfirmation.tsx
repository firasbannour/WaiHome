// app/pendingConfirmation.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthService } from '../services/authService';
import { NavigationProp } from '../types/navigation';

export default function PendingConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  
  /* ---------- States ---------- */
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  
  // Get email from navigation parameters
  const email = (route.params as { email?: string })?.email || '';

  /* ---------- Countdown timer for resend ---------- */
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  /* ---------- Resend confirmation code ---------- */
  const handleResendCode = async () => {
    if (!canResend) return;
    
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await AuthService.resendSignUp(email);
      
      if (result.success) {
        setSuccess('New confirmation code sent! Check your email.');
        setCanResend(false);
        setResendCountdown(60); // 60 seconds cooldown
        Alert.alert(
          'Code Resent Successfully!',
          'A new confirmation code has been sent to your email. Please check your inbox and spam folder.',
          [{ text: 'OK' }]
        );
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (error) {
      setError('Error sending code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  /* ---------- Navigate to confirmation ---------- */
  const handleConfirmAccount = () => {
    navigation.navigate('confirmSignup', { email });
  };

  /* ---------- Navigate to login ---------- */
  const handleGoToLogin = () => {
    navigation.navigate('login');
  };

  /* ---------- Open email app ---------- */
  const handleOpenEmail = () => {
    // Try to open default email app
    Linking.openURL('mailto:');
  };

  /* ---------- Cancel and start over ---------- */
  const handleCancelSignup = () => {
    Alert.alert(
      'Cancel Signup?',
      'Are you sure you want to cancel? You can always sign up again later.',
      [
        { text: 'No, Keep Trying', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: () => navigation.navigate('signup')
        }
      ]
    );
  };

  /* ---------- Render countdown timer ---------- */
  const renderCountdown = () => {
    if (resendCountdown > 0) {
      return (
        <View style={styles.countdownContainer}>
          <MaterialIcons name="timer" size={16} color="#666" />
          <Text style={styles.countdownText}>
            Resend available in {resendCountdown}s
          </Text>
        </View>
      );
    }
    return null;
  };

  /* ---------- Render success message ---------- */
  const renderSuccessMessage = () => {
    if (success) {
      return (
        <View style={styles.successBox}>
          <MaterialIcons name="check-circle" size={18} color="#27AE60" style={{marginRight: 6}} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      );
    }
    return null;
  };

  /* ---------- Render error message ---------- */
  const renderErrorMessage = () => {
    if (error) {
      return (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#E74C3C" style={{marginRight: 6}} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }
    return null;
  };

  /* ---------- Main render ---------- */
  return (
    <LinearGradient colors={["#f5fafd", "#b2d8e6"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Image
            source={require("../assets/waihome_logo.png")}
            style={styles.logo}
          />
          
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="email" size={40} color="#0c7a7e" />
            </View>
          </View>

          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a confirmation code to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          
          <View style={styles.card}>
            <Text style={styles.instructionText}>
              To complete your account setup, please:
            </Text>
            
            <View style={styles.stepsContainer}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Check your email inbox</Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>Find the confirmation code</Text>
              </View>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Enter the code to verify</Text>
              </View>
            </View>

            {renderSuccessMessage()}
            {renderErrorMessage()}

            {/* Primary Action Button */}
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleConfirmAccount}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check-circle" size={22} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.primaryButtonText}>I Have the Code - Verify Now</Text>
            </TouchableOpacity>

            {/* Resend Code Button */}
            <TouchableOpacity
              style={[
                styles.secondaryButton, 
                (!canResend || resendLoading) && styles.buttonDisabled
              ]}
              onPress={handleResendCode}
              disabled={!canResend || resendLoading}
              activeOpacity={0.85}
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#0c7a7e" style={{marginRight: 8}} />
              ) : (
                <MaterialIcons name="refresh" size={20} color="#0c7a7e" style={{marginRight: 8}} />
              )}
              <Text style={styles.secondaryButtonText}>
                {resendLoading ? "Sending..." : "Resend Code"}
              </Text>
            </TouchableOpacity>

            {renderCountdown()}

            {/* Help Actions */}
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              
              <TouchableOpacity style={styles.helpButton} onPress={handleOpenEmail}>
                <FontAwesome name="envelope" size={16} color="#0c7a7e" />
                <Text style={styles.helpButtonText}>Open Email App</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpButton} onPress={handleGoToLogin}>
                <MaterialIcons name="login" size={16} color="#0c7a7e" />
                <Text style={styles.helpButtonText}>Back to Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpButton} onPress={handleCancelSignup}>
                <MaterialIcons name="cancel" size={16} color="#E74C3C" />
                <Text style={[styles.helpButtonText, { color: '#E74C3C' }]}>
                  Cancel Signup
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tips Section */}
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>💡 Tips:</Text>
              <Text style={styles.tipText}>• Check your spam/junk folder</Text>
              <Text style={styles.tipText}>• Wait a few minutes for delivery</Text>
              <Text style={styles.tipText}>• Make sure the email address is correct</Text>
              <Text style={styles.tipText}>• The code expires in 24 hours</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  logo: {
    width: 280,
    height: 52,
    resizeMode: "contain",
    marginBottom: 20,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e8f4f8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0c7a7e",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0c7a7e",
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 4,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0c7a7e",
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  instructionText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  stepsContainer: {
    marginBottom: 24,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0c7a7e",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  stepNumberText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  stepText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  successText: {
    color: "#27AE60",
    fontWeight: '600',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorText: {
    color: "#E74C3C",
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c7a7e",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#0c7a7e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#0c7a7e",
  },
  secondaryButtonText: {
    color: "#0c7a7e",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  countdownText: {
    color: "#666",
    fontSize: 14,
    marginLeft: 6,
  },
  helpSection: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 20,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    textAlign: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  helpButtonText: {
    color: "#0c7a7e",
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  tipsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
});
