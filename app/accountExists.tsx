// app/accountExists.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { AuthService } from '../services/authService';

export default function AccountExistsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  /* ---------- States ---------- */
  const [loading, setLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'checking' | 'unconfirmed' | 'confirmed' | 'error'>('checking');
  
  // Get email from navigation parameters
  const email = (route.params as { email?: string })?.email || '';

  /* ---------- Check account status on mount ---------- */
  React.useEffect(() => {
    checkAccountStatus();
  }, []);

  /* ---------- Check account status ---------- */
  const checkAccountStatus = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      const result = await AuthService.isUserConfirmed(email);
      
      if (result.success) {
        if (result.confirmed) {
          setAccountStatus('confirmed');
        } else {
          setAccountStatus('unconfirmed');
        }
      } else {
        setAccountStatus('error');
      }
    } catch (error) {
      setAccountStatus('error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Resend confirmation code ---------- */
  const handleResendCode = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      const result = await AuthService.resendSignUp(email);
      
      if (result.success) {
        Alert.alert(
          'Code Resent Successfully!',
          'A new confirmation code has been sent to your email. Please check your inbox and spam folder.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('pendingConfirmation' as never, { email })
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to resend code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Navigate to confirmation ---------- */
  const handleGoToConfirmation = () => {
    navigation.navigate('confirmSignup' as never, { email });
  };

  /* ---------- Navigate to login ---------- */
  const handleGoToLogin = () => {
    navigation.navigate('login' as never);
  };

  /* ---------- Navigate to pending confirmation ---------- */
  const handleGoToPending = () => {
    navigation.navigate('pendingConfirmation' as never, { email });
  };

  /* ---------- Render content based on account status ---------- */
  const renderContent = () => {
    if (loading || accountStatus === 'checking') {
      return (
        <View style={styles.loadingContainer}>
          <MaterialIcons name="hourglass-empty" size={60} color="#0c7a7e" />
          <Text style={styles.loadingText}>Checking account status...</Text>
        </View>
      );
    }

    if (accountStatus === 'unconfirmed') {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="email" size={40} color="#E67E22" />
            </View>
          </View>

          <Text style={styles.title}>Account Needs Confirmation</Text>
          <Text style={styles.subtitle}>
            An account with this email already exists but needs to be verified.
          </Text>
          
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleGoToPending}
              activeOpacity={0.85}
            >
              <MaterialIcons name="email" size={22} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.primaryButtonText}>Check Email & Verify</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={handleResendCode}
              disabled={loading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="refresh" size={20} color="#0c7a7e" style={{marginRight: 8}} />
              <Text style={styles.secondaryButtonText}>
                {loading ? "Sending..." : "Resend Confirmation Code"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={handleGoToConfirmation}
              activeOpacity={0.85}
            >
              <MaterialIcons name="key" size={20} color="#0c7a7e" style={{marginRight: 8}} />
              <Text style={styles.secondaryButtonText}>Enter Code Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (accountStatus === 'confirmed') {
      return (
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="check-circle" size={40} color="#27AE60" />
            </View>
          </View>

          <Text style={styles.title}>Account Already Exists</Text>
          <Text style={styles.subtitle}>
            An account with this email already exists and is confirmed.
          </Text>
          
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleGoToLogin}
              activeOpacity={0.85}
            >
              <MaterialIcons name="login" size={22} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.primaryButtonText}>Sign In Now</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => navigation.navigate('forgotPassword' as never)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="lock-reset" size={20} color="#0c7a7e" style={{marginRight: 8}} />
              <Text style={styles.secondaryButtonText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Error state
    return (
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="error" size={40} color="#E74C3C" />
          </View>
        </View>

        <Text style={styles.title}>Unable to Verify Account</Text>
        <Text style={styles.subtitle}>
          We couldn't determine the status of your account. Please try again.
        </Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={checkAccountStatus}
            activeOpacity={0.85}
          >
            <MaterialIcons name="refresh" size={22} color="#FFF" style={{marginRight: 8}} />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleGoToLogin}
            activeOpacity={0.85}
          >
            <MaterialIcons name="login" size={20} color="#0c7a7e" style={{marginRight: 8}} />
            <Text style={styles.secondaryButtonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
          
          {renderContent()}

          {/* Back to signup button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.navigate('signup' as never)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="arrow-back" size={20} color="#666" style={{marginRight: 8}} />
            <Text style={styles.backButtonText}>Back to Sign Up</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 18,
    color: "#666",
    marginTop: 20,
    textAlign: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    width: "100%",
    maxWidth: 400,
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
    fontSize: 24,
    fontWeight: "700",
    color: "#0c7a7e",
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0c7a7e",
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#e8f4f8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  optionsContainer: {
    width: "100%",
    marginBottom: 20,
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
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#0c7a7e",
  },
  secondaryButtonText: {
    color: "#0c7a7e",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  backButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: '500',
  },
});
