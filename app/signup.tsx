// app/signup.tsx
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
import { NavigationProp } from '../types/navigation';

export default function SignupScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  /* ---------- Form states ---------- */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  // Focus states for inputs with animation
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  /* ---------- Password validation according to AWS Cognito policy ---------- */
  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must contain at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  /* ---------- Signup handling ---------- */
  const handleSignup = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await AuthService.signUp(email, password, email);
      if (result.success) {
        // Show success message before navigation
        setError(''); // Clear errors
        Alert.alert(
          'Account Created Successfully!',
          'Please check your email for the confirmation code.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('pendingConfirmation', { email })
            }
          ]
        );
      } else {
        // Handle specific error types with automatic redirection
        if (result.code === 'USER_EXISTS_UNCONFIRMED') {
          // User exists but not confirmed - redirect to pending confirmation
          setError(''); // Clear errors
          navigation.navigate('pendingConfirmation', { email });
          return;
        } else if (result.code === 'USER_EXISTS_CONFIRMED') {
          // User exists and confirmed - redirect to account exists page
          setError(''); // Clear errors
          navigation.navigate('accountExists', { email });
          return;
        } else if (result.error && result.error.includes('already exists')) {
          // Generic "already exists" error - redirect to account exists page
          setError(''); // Clear errors
          navigation.navigate('accountExists', { email });
          return;
        }
        
        // Other errors
        setError(result.error || 'Signup error');
      }
    } catch (error) {
      setError('Signup error');
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
        <Text style={styles.welcomeModern}>Create WaiHome Account</Text>
        <Text style={styles.subtitleModern}>Sign up for your new user account</Text>
        
        <View style={styles.cardModernSignup}>
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

          {/* Password Input */}
          <View style={[styles.inputContainerModern, passwordFocused && styles.inputContainerFocus]}>
            <FontAwesome name="lock" size={20} color="#0c7a7e" />
            <TextInput
              style={styles.inputModern}
              placeholder="Password (min 8 chars, uppercase, lowercase, number, special)"
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

          {/* Signup button */}
          <TouchableOpacity 
            style={[styles.buttonModernSignup, loading && styles.buttonDisabled]} 
            onPress={handleSignup} 
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" style={{marginRight: 8}} />
            ) : (
              <MaterialIcons name="person-add" size={22} color="#FFF" style={{marginRight: 8}} />
            )}
            <Text style={styles.buttonTextModernSignup}>
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          {/* Help links */}
          <View style={styles.linkRowModern}>
            <TouchableOpacity 
              style={styles.linkBtnModernSignup} 
              onPress={handleLoginPress}
            >
              <Text style={styles.linkTextModernSignup}>Already have an account? Sign In</Text>
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
  cardModernSignup: {
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
  buttonModernSignup: {
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
  buttonTextModernSignup: {
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
  linkBtnModernSignup: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  linkTextModernSignup: {
    color: "#0c7a7e",
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginHorizontal: 6,
  },
});