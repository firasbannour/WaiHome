// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { AuthService } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const navigation = useNavigation();

  /* ---------- Form states ---------- */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  // Focus states for inputs with animation
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  /* ---------- Login handling ---------- */
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      console.log("🔄 Starting login for email:", email);
      
      // Use signInFresh for better compatibility
      const result = await AuthService.signInFresh(email, password);
      
              console.log('📋 Login result:', result);
        
        if (result.success) {
          console.log('✅ Login successful!');
        
        // Save user email locally
        try {
          await AsyncStorage.setItem('userEmail', email);
          console.log('✅ Login - Email saved successfully:', email);
        } catch (error) {
          console.error("❌ Login - Error saving email:", error);
        }
        
        // Navigate to main page
        navigation.navigate('MainPage' as never);
              } else {
          console.log('❌ Login failed:', result.error);
        
        // Handle specific errors
        if (result.error && result.error.includes('Session bloquée')) {
          Alert.alert(
            'Session Blocked',
            "Please completely restart the application and try again.",
            [
              {
                text: 'OK',
                onPress: () => {
                  setEmail('');
                  setPassword('');
                  setError('');
                }
              }
            ]
          );
        } else if (result.error && result.error.includes('n\'est pas encore confirmé')) {
          Alert.alert(
            'Account Not Confirmed',
            "Your account is not yet confirmed. Please check your email and enter the confirmation code.",
            [
              {
                text: 'Go to Confirmation',
                onPress: () => (navigation as any).navigate('pendingConfirmation', { email })
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        } else {
          setError(result.error || 'Incorrect email or password');
        }
      }
    } catch (error) {
      console.error('💥 Login error:', error);
      setError('Login error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------- Navigation to signup ---------- */
  const handleSignupPress = () => {
    navigation.navigate('signup' as never);
  };

  /* ---------- Navigation to forgot password ---------- */
  const handleForgotPasswordPress = () => {
    navigation.navigate('forgotPassword' as never);
  };

  /* ---------- Form rendering ---------- */
  return (
    <LinearGradient colors={["#f5fafd", "#b2d8e6"]} style={styles.safeArea}>
      <View style={styles.containerModern}>
        <Image
          source={require("../assets/waihome_logo.png")}
          style={styles.logoModern}
        />
        <Text style={styles.welcomeModern}>WaiHome Login</Text>
        <Text style={styles.subtitleModern}>Sign in to your account</Text>
        
        <View style={styles.cardModernLogin}>
          {/* Email Input */}
          <View style={[styles.inputContainerModern, emailFocused && styles.inputContainerFocus]}>
            <FontAwesome name="envelope" size={20} color="#0c7a7e" />
            <TextInput
              style={styles.inputModern}
              placeholder="Email"
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

          {/* Password Input */}
          <View style={[styles.inputContainerModern, passwordFocused && styles.inputContainerFocus]}>
            <FontAwesome name="lock" size={20} color="#0c7a7e" />
            <TextInput
              style={styles.inputModern}
              placeholder="Password"
              placeholderTextColor="#9FA5AA"
              secureTextEntry={hidePassword}
              value={password}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onChangeText={(text) => {
                setPassword(text);
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

          {/* Error display */}
          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color="#E74C3C" style={{marginRight: 6}} />
              <Text style={styles.errorModern}>{error}</Text>
            </View>
          ) : null}

          {/* Login button */}
          <TouchableOpacity 
            style={[styles.buttonModernLogin, isLoading && styles.buttonDisabled]} 
            onPress={handleLogin} 
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFF" style={{marginRight: 8}} />
            ) : (
              <MaterialIcons name="login" size={22} color="#FFF" style={{marginRight: 8}} />
            )}
            <Text style={styles.buttonTextModernLogin}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          {/* Help links */}
          <View style={styles.linkRowModern}>
            <TouchableOpacity 
              style={styles.linkBtnModernLogin} 
              onPress={handleForgotPasswordPress}
            >
              <Text style={styles.linkTextModernLogin}>Forgot Password?</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.linkBtnModernLogin} 
              onPress={handleSignupPress}
            >
              <Text style={styles.linkTextModernLogin}>Create Account</Text>
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
  cardModernLogin: {
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
  buttonModernLogin: {
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
  buttonTextModernLogin: {
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
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 2,
    width: '100%',
  },
  linkBtnModernLogin: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  linkTextModernLogin: {
    color: "#0c7a7e",
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginHorizontal: 6,
  },
});
