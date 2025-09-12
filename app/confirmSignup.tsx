// app/confirmSignup.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { AuthService } from '../services/authService';
import { NavigationProp, RootStackParamList } from '../types/navigation';

export default function ConfirmSignupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  
  /* ---------- Form states ---------- */
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts] = useState(5);
  const [lockoutTime, setLockoutTime] = useState(0);
  
  // Focus state for input with animation
  const [codeFocused, setCodeFocused] = useState(false);

  // Get email from navigation parameters
  const email = (route.params as { email?: string })?.email || '';

  /* ---------- Lockout timer ---------- */
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

  /* ---------- Confirm signup handling ---------- */
  const handleConfirmSignup = async () => {
    if (!code) {
      setError('Please enter the confirmation code');
      return;
    }

    if (lockoutTime > 0) {
      setError(`Too many attempts. Please wait ${lockoutTime} seconds.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔄 Starting confirmation for email:', email);
      console.log('🔄 Code entered:', code);
      
      const result = await AuthService.confirmSignUp(email, code);
      
      console.log('📋 Confirmation result:', result);
      
      if (result.success) {
        console.log('✅ Confirmation successful!');
        setAttempts(0); // Reset attempts on success
        
        Alert.alert(
          '🎉 Account Confirmed Successfully!',
          'Your account has been verified. You can now sign in with your email and password.',
          [
            {
              text: 'Sign In Now',
              onPress: () => {
                // Clear auth state before navigating to login
                AuthService.clearAuthState().then(() => {
                  navigation.navigate('login' as never);
                });
              }
            }
          ]
        );
      } else {
        console.log('❌ Confirmation failed:', result.error);
        
        // Handle specific error types
        let errorMessage = result.error || 'Confirmation failed';
        if (result.error?.includes('CodeMismatchException')) {
          errorMessage = 'Invalid confirmation code. Please check and try again.';
        } else if (result.error?.includes('ExpiredCodeException')) {
          errorMessage = 'Confirmation code has expired. Please request a new one.';
        } else if (result.error?.includes('TooManyRequestsException')) {
          errorMessage = 'Too many attempts. Please wait a moment before trying again.';
        }
        
        setError(errorMessage);
        
        // Increment attempts and check for lockout
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= maxAttempts) {
          setLockoutTime(300); // 5 minutes lockout
          setError('Too many failed attempts. Account temporarily locked for 5 minutes.');
        }
      }
    } catch (error) {
      console.error('💥 Confirmation error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Resend code handling ---------- */
  const handleResendCode = async () => {
    if (lockoutTime > 0) {
      setError(`Please wait ${lockoutTime} seconds before requesting a new code.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔄 Starting resend code for email:', email);
      
      const result = await AuthService.resendSignUp(email);
      
      console.log('📋 Resend result:', result);
      
      if (result.success) {
        console.log('✅ Resend successful!');
        setAttempts(0); // Reset attempts when resending
        Alert.alert(
          '📧 New Code Sent!', 
          'A fresh confirmation code has been sent to your email. Please check your inbox and spam folder.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('❌ Resend failed:', result.error);
        
        let errorMessage = result.error || 'Failed to send new code';
        if (result.error?.includes('TooManyRequestsException')) {
          errorMessage = 'Too many requests. Please wait before requesting another code.';
        }
        
        setError(errorMessage);
      }
    } catch (error) {
      console.error('💥 Resend error:', error);
      setError('Error sending code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Navigation to pending confirmation ---------- */
  const handleBackToPending = () => {
    navigation.navigate('pendingConfirmation', { email });
  };

  /* ---------- Navigation to login ---------- */
  const handleLoginPress = () => {
    navigation.navigate('login');
  };

  /* ---------- Render lockout message ---------- */
  const renderLockoutMessage = () => {
    if (lockoutTime > 0) {
      return (
        <View style={styles.lockoutBox}>
          <MaterialIcons name="lock-clock" size={18} color="#E67E22" style={{marginRight: 6}} />
          <Text style={styles.lockoutText}>
            Account temporarily locked. Please wait {Math.floor(lockoutTime / 60)}:{(lockoutTime % 60).toString().padStart(2, '0')}
          </Text>
        </View>
      );
    }
    return null;
  };

  /* ---------- Render attempts counter ---------- */
  const renderAttemptsCounter = () => {
    if (attempts > 0 && attempts < maxAttempts) {
      return (
        <View style={styles.attemptsBox}>
          <MaterialIcons name="warning" size={16} color="#F39C12" style={{marginRight: 6}} />
          <Text style={styles.attemptsText}>
            Attempt {attempts} of {maxAttempts}
          </Text>
        </View>
      );
    }
    return null;
  };

  /* ---------- Form rendering ---------- */
  return (
    <LinearGradient colors={["#f5fafd", "#b2d8e6"]} style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.containerModern}>
          <Image
            source={require("../assets/waihome_logo.png")}
            style={styles.logoModern}
          />
          <Text style={styles.welcomeModern}>Verify Your Account</Text>
          <Text style={styles.subtitleModern}>
            Enter the confirmation code sent to:
          </Text>
          <Text style={styles.emailDisplay}>{email}</Text>
          
          <View style={styles.cardModernConfirm}>
            {/* Confirmation Code Input */}
            <View style={[styles.inputContainerModern, codeFocused && styles.inputContainerFocus]}>
              <FontAwesome name="key" size={20} color="#0c7a7e" />
              <TextInput
                style={styles.inputModern}
                placeholder="Enter 6-digit code"
                placeholderTextColor="#9FA5AA"
                keyboardType="number-pad"
                autoCapitalize="none"
                value={code}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onChangeText={(text) => {
                  setCode(text);
                  if (error) setError("");
                }}
                selectionColor="#2196f3"
                maxLength={6}
                editable={lockoutTime === 0}
              />
            </View>

            {/* Attempts counter */}
            {renderAttemptsCounter()}

            {/* Lockout message */}
            {renderLockoutMessage()}

            {/* Error display */}
            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={18} color="#E74C3C" style={{marginRight: 6}} />
                <Text style={styles.errorModern}>{error}</Text>
              </View>
            ) : null}

            {/* Confirm Button */}
            <TouchableOpacity 
              style={[
                styles.buttonModernConfirm, 
                (loading || lockoutTime > 0) && styles.buttonDisabled
              ]} 
              onPress={handleConfirmSignup} 
              activeOpacity={0.85}
              disabled={loading || lockoutTime > 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" style={{marginRight: 8}} />
              ) : (
                <MaterialIcons name="check-circle" size={22} color="#FFF" style={{marginRight: 8}} />
              )}
              <Text style={styles.buttonTextModernConfirm}>
                {loading ? "Verifying..." : "Verify Account"}
              </Text>
            </TouchableOpacity>

            {/* Resend Code Button */}
            <TouchableOpacity
              style={[
                styles.resendButtonModern, 
                (loading || lockoutTime > 0) && styles.buttonDisabled
              ]}
              onPress={handleResendCode}
              disabled={loading || lockoutTime > 0}
              activeOpacity={0.85}
            >
              <MaterialIcons name="refresh" size={20} color="#0c7a7e" style={{marginRight: 8}} />
              <Text style={styles.resendButtonTextModern}>
                {loading ? "Sending..." : "Send New Code"}
              </Text>
            </TouchableOpacity>

            {/* Help links */}
            <View style={styles.linkRowModern}>
              <TouchableOpacity 
                style={styles.linkBtnModernConfirm} 
                onPress={handleBackToPending}
              >
                <Text style={styles.linkTextModernConfirm}>Back to Email Check</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.linkBtnModernConfirm} 
                onPress={handleLoginPress}
              >
                <Text style={styles.linkTextModernConfirm}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/* ---------- Modern styles ---------- */
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1 
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  containerModern: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  logoModern: {
    width: 320,
    height: 60,
    resizeMode: "contain",
    marginTop: 60,
    marginBottom: 18,
    alignSelf: 'center',
  },
  welcomeModern: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0c7a7e",
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
    alignSelf: 'center',
  },
  subtitleModern: {
    fontSize: 16,
    color: "#666",
    marginBottom: 4,
    textAlign: 'center',
    alignSelf: 'center',
  },
  emailDisplay: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0c7a7e",
    marginBottom: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cardModernConfirm: {
    width: "90%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    alignSelf: 'center',
    alignItems: 'center',
  },
  inputContainerModern: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#B2EBF2",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
    height: 52,
    backgroundColor: '#f7fafb',
    width: '100%',
  },
  inputModern: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  inputContainerFocus: {
    borderColor: "#0c7a7e",
    borderWidth: 2,
    backgroundColor: '#eaf6fd',
  },
  attemptsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  attemptsText: {
    color: "#F39C12",
    fontWeight: '600',
    fontSize: 14,
  },
  lockoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef5e7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
  },
  lockoutText: {
    color: "#E67E22",
    fontWeight: '600',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorModern: {
    color: "#E74C3C",
    fontWeight: '600',
    fontSize: 15,
  },
  buttonModernConfirm: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c7a7e",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 12,
    shadowColor: '#0c7a7e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
    width: '85%',
    alignSelf: 'center',
  },
  buttonTextModernConfirm: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 2,
  },
  resendButtonModern: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#0c7a7e",
    width: '85%',
    alignSelf: 'center',
  },
  resendButtonTextModern: {
    color: "#0c7a7e",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkRowModern: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
    marginBottom: 2,
    width: '100%',
  },
  linkBtnModernConfirm: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  linkTextModernConfirm: {
    color: "#0c7a7e",
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginHorizontal: 6,
  },
});
