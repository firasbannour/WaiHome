// app/layout.tsx
// Load polyfills FIRST in _layout since expo-router might not load index.js polyfills in time
import '../polyfills';

import { Stack } from "expo-router";
import { NotificationProvider } from "../context/NotificationContext";
import { Amplify } from 'aws-amplify';

// Configuration AWS directement dans le code
const awsconfig = {
  aws_project_region: "eu-north-1",
  aws_cognito_region: "eu-north-1", 
  aws_user_pools_id: "eu-north-1_chaDSrhRD",
  aws_user_pools_web_client_id: "2vungs3t077sf2kcet0r7unphk",
  aws_cognito_identity_pool_id: "eu-north-1:545647ff-957a-4116-b2b9-afec5b7b81b2",
  oauth: {},
  aws_cognito_username_attributes: ["EMAIL"],
  aws_cognito_social_providers: [],
  aws_cognito_signup_attributes: ["EMAIL"],
  aws_cognito_mfa_configuration: "OFF",
  aws_cognito_mfa_types: ["SMS"],
  aws_cognito_password_protection_settings: {
    passwordPolicyMinLength: 8,
    passwordPolicyCharacters: []
  },
  aws_cognito_verification_mechanisms: ["EMAIL"]
};

// Configure Amplify for expo-router
console.log('🔧 _layout.tsx: Configuring Amplify...');
console.log('🔍 _layout.tsx: Crypto check before Amplify config:');
console.log('- global.crypto:', !!global.crypto);
console.log('- global.crypto.getRandomValues:', !!global.crypto?.getRandomValues);
console.log('- global.getRandomBase64:', !!global.getRandomBase64);

console.log('📋 Amplify config:', awsconfig);
try {
  Amplify.configure(awsconfig);
  console.log('✅ Amplify configured successfully in _layout');
} catch (error) {
  console.error('❌ Amplify configuration failed:', error);
}

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="MainPage" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="confirmSignup" options={{ headerShown: false }} />
        <Stack.Screen name="forgotPassword" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="SiteDetails" options={{ headerShown: false }} />
        <Stack.Screen name="AlertHistory" options={{ headerShown: false }} />
        <Stack.Screen name="NotificationHistory" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsAuger" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsHeater" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsHighWater" options={{ headerShown: false }} />
        <Stack.Screen name="DetailsPump" options={{ headerShown: false }} />
      </Stack>
    </NotificationProvider>
  );
}
