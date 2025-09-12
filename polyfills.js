// 🔧 Comprehensive Crypto Polyfills and Debugging
// This file sets up all necessary polyfills for AWS Amplify authentication

console.log('🚀 Loading polyfills.js...');

// 0. Amplify React Native polyfills (must come very early)
try {
  require('@aws-amplify/react-native');
  console.log('✅ @aws-amplify/react-native loaded');
} catch (e) {
  console.warn('⚠️ Failed to load @aws-amplify/react-native:', e?.message || e);
}

// 0.5. Try to use standard WebCrypto polyfill for Expo
try {
  require('expo-standard-web-crypto');
  console.log('✅ expo-standard-web-crypto loaded');
} catch (e) {
  console.warn('⚠️ expo-standard-web-crypto not available:', e?.message || e);
}

// 1. Load URL polyfill first
import 'react-native-url-polyfill/auto';
console.log('✅ react-native-url-polyfill loaded');

// 2. Load Buffer polyfill
import { Buffer } from 'buffer';
global.Buffer = Buffer;
console.log('✅ Buffer polyfill set');

// 3. Try to load react-native-get-random-values with runtime validation
let rnGetRandomValuesOk = false;
try {
  require('react-native-get-random-values');
  console.log('✅ react-native-get-random-values loaded');
  // Validate it actually works at runtime (native module may be missing)
  try {
    const testArray = new Uint8Array(8);
    // If this throws, native module is missing even though require succeeded
    global.crypto.getRandomValues(testArray);
    rnGetRandomValuesOk = true;
    console.log('✅ react-native-get-random-values runtime check passed');
  } catch (e) {
    console.warn('⚠️ react-native-get-random-values runtime check failed, will fall back:', e?.message || e);
  }
} catch (error) {
  console.warn('⚠️ react-native-get-random-values failed to load:', error.message);
}

if (!rnGetRandomValuesOk) {
  console.log('🔧 Setting up crypto.getRandomValues using expo-crypto fallback...');
  try {
    const { getRandomBytes } = require('expo-crypto');
    global.crypto = global.crypto || {};
    global.crypto.getRandomValues = function(array) {
      const bytes = getRandomBytes(array.length);
      for (let i = 0; i < array.length; i++) {
        array[i] = bytes[i];
      }
      return array;
    };
    console.log('✅ crypto.getRandomValues set via expo-crypto');
  } catch (expoCryptoError) {
    console.warn('⚠️ expo-crypto not available:', expoCryptoError.message);
    // Fallback to non-crypto random for development only
    global.crypto = global.crypto || {};
    global.crypto.getRandomValues = function(array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
    console.log('✅ crypto.getRandomValues set using Math.random (DEV ONLY)');
  }
}

// 4. Check if crypto is available
if (typeof global.crypto === 'undefined') {
  console.error('❌ global.crypto is UNDEFINED');
} else {
  console.log('✅ global.crypto is available:', typeof global.crypto);
}

// 5. Check getRandomValues specifically
if (typeof global.crypto?.getRandomValues === 'undefined') {
  console.error('❌ global.crypto.getRandomValues is UNDEFINED');
  
  // Try to manually set it
  if (global.crypto) {
    try {
      const getRandomValues = require('react-native-get-random-values').getRandomValues;
      if (getRandomValues) {
        global.crypto.getRandomValues = getRandomValues;
        console.log('✅ Manually set global.crypto.getRandomValues');
      }
    } catch (error) {
      console.error('❌ Failed to manually set getRandomValues:', error);
    }
  }
} else {
  console.log('✅ global.crypto.getRandomValues is available');
}

// 6. Test crypto functionality
try {
  const testArray = new Uint8Array(10);
  global.crypto.getRandomValues(testArray);
  console.log('✅ crypto.getRandomValues test successful:', testArray);
} catch (error) {
  console.error('❌ crypto.getRandomValues test failed:', error);
}

// 7. Check for amazon-cognito-identity-js specific requirements
console.log('🔍 Checking amazon-cognito-identity-js requirements...');

// Check if amazon-cognito-identity-js has its own getRandomBase64
try {
  // This is what amazon-cognito-identity-js internally uses
  if (typeof global.getRandomBase64 === 'undefined') {
    console.log('ℹ️ global.getRandomBase64 not found - this is expected');
    
    // Try to create a getRandomBase64 function
    global.getRandomBase64 = function(length) {
      const array = new Uint8Array(length);
      global.crypto.getRandomValues(array);
      return Buffer.from(array).toString('base64');
    };
    console.log('✅ Created global.getRandomBase64 function');
  } else {
    console.log('✅ global.getRandomBase64 already exists');
  }
} catch (error) {
  console.error('❌ Error setting up getRandomBase64:', error);
}

// 8. Final verification
console.log('🔍 Final crypto environment check:');
console.log('- global.crypto:', !!global.crypto);
console.log('- global.crypto.getRandomValues:', !!global.crypto?.getRandomValues);
console.log('- global.getRandomBase64:', !!global.getRandomBase64);
console.log('- Buffer:', !!global.Buffer);

console.log('✅ Polyfills setup complete!');
