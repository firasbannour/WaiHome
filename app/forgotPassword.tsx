// app/forgotPassword.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { AuthService } from '../services/authService';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  
  /* ---------- Form states ---------- */
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  
  // Focus states for inputs with animation
  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  /* ---------- Forgot password handling ---------- */
  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await AuthService.forgotPassword(email);
      setSuccess(true);
    } catch (error) {
      setError('Error sending reset code');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Confirm password reset handling ---------- */
  const handleConfirmReset = async () => {
    if (!email || !code || !newPassword) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AuthService.confirmForgotPassword(email, code, newPassword);
      if (res?.success) {
        setSuccess(false);
        Alert.alert(
          'Password Reset Successfully',
          'Your password has been reset. You can now sign in.',
          [
            {
              text: 'OK',
              onPress: () => (navigation as any).navigate('login')
            }
          ]
        );
      } else {
        setError(res?.error || 'Error during password reset');
      }
    } catch (e) {
      setError('Error during password reset');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Navigation to login ---------- */
  const handleLoginPress = () => {
    navigation.navigate('login' as never);
  };

  /* ---------- Form rendering ---------- */
  return (
    <LinearGradient colors={["#f5fafd", "#b2d8e6"]} style={styles.safeArea}>
      <View style={styles.containerModern}>
        <Image
          source={require("../assets/waihome_logo.png")}
          style={styles.logoModern}
        />
        <Text style={styles.welcomeModern}>Forgot Password</Text>
        <Text style={styles.subtitleModern}>Reset your account password</Text>
        
        <View style={styles.cardModernForgot}>
          {/* Email Input */}
          <View style={[styles.inputContainerModern, emailFocused && styles.inputContainerFocus]}>
            <FontAwesome name="envelope" size={20} color="#0c7a7e" />
            <TextInput
              style={styles.inputModern}
              placeholder="User Email"
              placeholderTextColor="#9FA5AA"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError("");
              }}
              selectionColor="#2196f3"
            />
          </View>

          {/* Error display */}
          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color="#E74C3C" style={{marginRight: 6}} />
              <Text style={styles.errorModern}>{error}</Text>
            </View>
          ) : null}

          {/* Success message */}
          {success ? (
            <View style={styles.successBox}>
              <MaterialIcons name="check-circle-outline" size={18} color="#4CAF50" style={{marginRight: 6}} />
              <Text style={styles.successModern}>Reset code sent to your email</Text>
            </View>
          ) : null}

          {/* Code and New Password Inputs (shown after success) */}
          {success ? (
            <>
              {/* Code Input */}
              <View style={[styles.inputContainerModern, codeFocused && styles.inputContainerFocus]}>
                <FontAwesome name="key" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.inputModern}
                  placeholder="Reset Code"
                  placeholderTextColor="#9FA5AA"
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  value={code}
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                  onChangeText={(text) => {
                    setCode(text);
                    if (error) setError("");
                  }}
                  selectionColor="#2196f3"
                />
              </View>

              {/* New Password Input */}
              <View style={[styles.inputContainerModern, passwordFocused && styles.inputContainerFocus]}>
                <FontAwesome name="lock" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.inputModern}
                  placeholder="New Password"
                  placeholderTextColor="#9FA5AA"
                  autoCapitalize="none"
                  secureTextEntry={hidePassword}
                  value={newPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (error) setError("");
                  }}
                  selectionColor="#2196f3"
                />
                <TouchableOpacity
                  onPress={() => setHidePassword(!hidePassword)}
                  style={styles.eyeIcon}
                >
                  <FontAwesome
                    name={hidePassword ? "eye-slash" : "eye"}
                    size={20}
                    color="#0c7a7e"
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* Action Button */}
          <TouchableOpacity 
            style={[styles.buttonModernForgot, loading && styles.buttonDisabled]} 
            onPress={!success ? handleForgotPassword : handleConfirmReset} 
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" style={{marginRight: 8}} />
            ) : (
              <MaterialIcons 
                name={!success ? "send" : "lock-reset"} 
                size={22} 
                color="#FFF" 
                style={{marginRight: 8}} 
              />
            )}
            <Text style={styles.buttonTextModernForgot}>
              {loading 
                ? (!success ? "Sending..." : "Resetting...") 
                : (!success ? "Send Reset Code" : "Reset Password")
              }
            </Text>
          </TouchableOpacity>

          {/* Help links */}
          <View style={styles.linkRowModern}>
            <TouchableOpacity 
              style={styles.linkBtnModernForgot} 
              onPress={handleLoginPress}
            >
              <Text style={styles.linkTextModernForgot}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ---------- Modern styles ---------- */
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1 
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
    marginBottom: 18,
    textAlign: 'center',
    alignSelf: 'center',
  },
  cardModernForgot: {
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
  eyeIcon: {
    padding: 4,
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
  },
  errorModern: {
    color: "#E74C3C",
    fontWeight: '600',
    fontSize: 15,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'center',
  },
  successModern: {
    color: "#4CAF50",
    fontWeight: '600',
    fontSize: 15,
  },
  buttonModernForgot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0c7a7e",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 4,
    shadowColor: '#0c7a7e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
    width: '85%',
    alignSelf: 'center',
  },
  buttonTextModernForgot: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkRowModern: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    marginBottom: 2,
    width: '100%',
  },
  linkBtnModernForgot: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  linkTextModernForgot: {
    color: "#0c7a7e",
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginHorizontal: 6,
  },
});
