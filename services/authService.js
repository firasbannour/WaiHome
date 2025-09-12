// Import AWS Amplify Auth directly
import { Auth } from 'aws-amplify';

export class AuthService {
  static _pendingSignIn = false;
  static _retryCount = 0;
  static _maxRetries = 1;

  // Check that Auth functions are available
  static checkAuth() {
    console.log('🔍 Checking Auth availability...');
    console.log('Auth object:', Auth);
    
    // Check crypto environment before using Auth
    console.log('🔍 Crypto environment check:');
    console.log('- global.crypto:', !!global.crypto);
    console.log('- global.crypto.getRandomValues:', !!global.crypto?.getRandomValues);
    console.log('- global.getRandomBase64:', !!global.getRandomBase64);
    console.log('- Buffer:', !!global.Buffer);
    
    // Test crypto functionality
    try {
      const testArray = new Uint8Array(4);
      global.crypto.getRandomValues(testArray);
      console.log('✅ crypto.getRandomValues test passed:', Array.from(testArray));
    } catch (error) {
      console.error('❌ crypto.getRandomValues test failed:', error);
      throw new Error('Crypto polyfills not working: ' + error.message);
    }
    
    if (!Auth) {
      console.error('❌ Auth is undefined. AWS Amplify may not be properly configured.');
      throw new Error('AWS Amplify Auth is not available');
    }
    
    console.log('✅ Auth and crypto checks passed');
    return Auth;
  }

  // Clear pending sign-in state
  static async clearPendingSignIn() {
    try {
      const auth = this.checkAuth();
      // Force reset of sign-in state
      await auth.signOut();
      this._pendingSignIn = false;
      this._retryCount = 0;
    } catch (error) {
      console.log('Clear pending sign-in error:', error);
      this._pendingSignIn = false;
      this._retryCount = 0;
    }
  }

  // User sign up
  static async signUp(username, password, email) {
    try {
      console.log('AuthService.signUp called with:', { username, email });
      const auth = this.checkAuth();
      const result = await auth.signUp({
        username,
        password,
        attributes: { email }
      });
      console.log('AuthService.signUp success:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('AuthService.signUp error:', error);
      
      // Handle specific signup errors
      let errorMessage = error.message;
      if (error.code === 'UsernameExistsException') {
        // Check if the existing user is confirmed or not
        try {
          const statusResult = await this.isUserConfirmed(username);
          if (statusResult.success && !statusResult.confirmed) {
            // User exists but is not confirmed - redirect to confirmation
            return { 
              success: false, 
              error: 'Account already exists but needs confirmation. Please check your email for the verification code.',
              code: 'USER_EXISTS_UNCONFIRMED',
              redirectTo: 'pendingConfirmation',
              email: username
            };
          } else if (statusResult.success && statusResult.confirmed) {
            // User exists and is confirmed - redirect to login
            return { 
              success: false, 
              error: 'An account with this email already exists and is confirmed. Please sign in instead.',
              code: 'USER_EXISTS_CONFIRMED',
              redirectTo: 'login'
            };
          }
        } catch (statusError) {
          console.error('Error checking user status:', statusError);
        }
        
        // Fallback message
        errorMessage = 'An account with this email already exists. Please sign in or check your email for confirmation.';
      } else if (error.code === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements. Please ensure it has at least 8 characters, uppercase, lowercase, number, and special character.';
      } else if (error.code === 'InvalidParameterException') {
        errorMessage = 'Invalid email format. Please enter a valid email address.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Confirm sign up with verification code
  static async confirmSignUp(username, code) {
    try {
      console.log('AuthService.confirmSignUp called with:', { username, code });
      const auth = this.checkAuth();
      const result = await auth.confirmSignUp(username, code);
      console.log('AuthService.confirmSignUp success:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('AuthService.confirmSignUp error:', error);
      
      // Handle specific confirmation errors
      let errorMessage = error.message;
      if (error.code === 'CodeMismatchException') {
        errorMessage = 'Invalid confirmation code. Please check the code and try again.';
      } else if (error.code === 'ExpiredCodeException') {
        errorMessage = 'Confirmation code has expired. Please request a new one.';
      } else if (error.code === 'TooManyRequestsException') {
        errorMessage = 'Too many attempts. Please wait before trying again.';
      } else if (error.code === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your email address.';
      } else if (error.code === 'NotAuthorizedException') {
        errorMessage = 'Account is already confirmed or cannot be confirmed.';
      }
      
      return { success: false, error: errorMessage, code: error.code };
    }
  }

  // Resend confirmation code
  static async resendSignUp(username) {
    try {
      console.log('AuthService.resendSignUp called with:', { username });
      const auth = this.checkAuth();
      const result = await auth.resendSignUp(username);
      console.log('AuthService.resendSignUp success:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('AuthService.resendSignUp error:', error);
      
      // Handle specific resend errors
      let errorMessage = error.message;
      if (error.code === 'UserNotFoundException') {
        errorMessage = 'User not found. Please check your email address.';
      } else if (error.code === 'TooManyRequestsException') {
        errorMessage = 'Too many requests. Please wait before requesting another code.';
      } else if (error.code === 'LimitExceededException') {
        errorMessage = 'Daily limit exceeded. Please try again tomorrow.';
      } else if (error.code === 'NotAuthorizedException') {
        errorMessage = 'Account is already confirmed. Please sign in instead.';
      }
      
      return { success: false, error: errorMessage, code: error.code };
    }
  }

  // Check if user account is confirmed
  static async isUserConfirmed(username) {
    try {
      console.log('AuthService.isUserConfirmed called with:', { username });
      const auth = this.checkAuth();
      
      // Try to get user details
      const user = await auth.currentAuthenticatedUser();
      if (user) {
        return { success: true, confirmed: true, data: user };
      }
      
      // If no current user, check if user exists and is confirmed
      try {
        const result = await auth.confirmSignUp(username, 'DUMMY_CODE');
        // This should fail, but we can check the error type
        return { success: true, confirmed: false, error: 'User not confirmed' };
      } catch (error) {
        if (error.code === 'CodeMismatchException') {
          // User exists but code is wrong (not confirmed)
          return { success: true, confirmed: false, error: 'User not confirmed' };
        } else if (error.code === 'NotAuthorizedException') {
          // User is already confirmed
          return { success: true, confirmed: true, error: 'User already confirmed' };
        } else if (error.code === 'UserNotFoundException') {
          // User doesn't exist
          return { success: true, confirmed: false, error: 'User not found' };
        }
        return { success: false, error: error.message };
      }
    } catch (error) {
      console.error('AuthService.isUserConfirmed error:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete unconfirmed user account
  static async deleteUnconfirmedUser(username) {
    try {
      console.log('AuthService.deleteUnconfirmedUser called with:', { username });
      const auth = this.checkAuth();
      
      // This requires admin privileges, so we'll just return info
      return { 
        success: false, 
        error: 'Account deletion requires admin access. Please contact support or wait for the account to expire automatically.',
        note: 'Unconfirmed accounts expire automatically after 24 hours'
      };
    } catch (error) {
      console.error('AuthService.deleteUnconfirmedUser error:', error);
      return { success: false, error: error.message };
    }
  }

  // User sign in
  static async signIn(username, password) {
    try {
      // Check if there's already a sign-in attempt in progress
      if (this._pendingSignIn) {
        console.log('⚠️ Sign-in already in progress, clearing...');
        await this.clearPendingSignIn();
      }

      console.log('🔐 AuthService.signIn called with:', { username });
      console.log('🔧 Checking Auth configuration...');
      this._pendingSignIn = true;
      
      const auth = this.checkAuth();
      console.log('✅ Auth object available, attempting sign-in...');
      
      // Additional debugging before signIn call
      console.log('🔍 Pre-signIn crypto check:');
      try {
        const testArray = new Uint8Array(8);
        global.crypto.getRandomValues(testArray);
        console.log('✅ Crypto still working before signIn:', Array.from(testArray));
      } catch (error) {
        console.error('❌ Crypto failed before signIn:', error);
        throw new Error('Crypto failure before signIn: ' + error.message);
      }
      
      console.log('🔐 Calling auth.signIn...');
      const result = await auth.signIn(username, password);
      console.log('🎉 auth.signIn completed successfully');
      
      this._pendingSignIn = false;
      this._retryCount = 0;
      console.log('✅ AuthService.signIn success:', result);
      return { success: true, data: result };
    } catch (error) {
      this._pendingSignIn = false;
      console.error('❌ AuthService.signIn error:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Handle specific error types
      let errorMessage = error.message;
      if (error.code === 'UserNotConfirmedException') {
        errorMessage = 'Votre compte n\'est pas encore confirmé. Veuillez vérifier votre email et entrer le code de confirmation.';
      } else if (error.code === 'NotAuthorizedException') {
        errorMessage = 'Email ou mot de passe incorrect.';
      } else if (error.code === 'UserNotFoundException') {
        errorMessage = 'Aucun compte trouvé avec cet email.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Sign out
  static async signOut() {
    try {
      const auth = this.checkAuth();
      this._pendingSignIn = false;
      this._retryCount = 0;
      await auth.signOut();
      return { success: true };
    } catch (error) {
      this._pendingSignIn = false;
      this._retryCount = 0;
      return { success: false, error: error.message };
    }
  }

  // Check sign-in status
  static async getCurrentUser() {
    try {
      const auth = this.checkAuth();
      const user = await auth.currentAuthenticatedUser();
      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Fetch normalized user profile (from Cognito attributes)
  static async getUserProfile() {
    try {
      const auth = this.checkAuth();
      const user = await auth.currentAuthenticatedUser();
      const attrs = user?.attributes || {};
      const id = attrs.sub || user?.username;
      const profile = {
        id,
        name: attrs.name || '',
        email: attrs.email || '',
        address: attrs.address || '',
        birthdate: attrs.birthdate || '',
        phoneNumber: attrs.phone_number || '',
        picture: attrs.picture || null,
        emailVerified: !!attrs.email_verified,
      };
      return { success: true, data: profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update Cognito user attributes. Supported: name, address, birthdate, phoneNumber, email
  static async updateUserProfile(update) {
    try {
      const auth = this.checkAuth();
      const user = await auth.currentAuthenticatedUser();
      const attributes = {};
      if (typeof update.name === 'string') attributes.name = update.name;
      if (typeof update.address === 'string') attributes.address = update.address;
      if (typeof update.birthdate === 'string') attributes.birthdate = update.birthdate;
      if (typeof update.phoneNumber === 'string' && update.phoneNumber.trim()) attributes.phone_number = update.phoneNumber.trim();
      if (typeof update.email === 'string') attributes.email = update.email;
      if (typeof update.picture === 'string') attributes.picture = update.picture;

      if (Object.keys(attributes).length === 0) {
        return { success: true, data: await this.getUserProfile().then(r => r.data) };
      }

      await auth.updateUserAttributes(user, attributes);
      // Re-fetch to return new values
      const refreshed = await this.getUserProfile();
      return refreshed;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get current user ID
  static async getCurrentUserId() {
    try {
      const auth = this.checkAuth();
      const user = await auth.currentAuthenticatedUser();
      return { success: true, data: user.username };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if user is in a specific group (optional)
  static async getUserGroups() {
    try {
      const auth = this.checkAuth();
      const user = await auth.currentAuthenticatedUser();
      const groups = user.signInUserSession?.accessToken?.payload['cognito:groups'] || [];
      return { success: true, data: groups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check Amplify configuration
  static async checkAmplifyConfig() {
    try {
      console.log('🔧 Checking Amplify configuration...');
      const auth = this.checkAuth();
      console.log('✅ Amplify configuration is valid');
      return { success: true, data: 'Amplify configured' };
    } catch (error) {
      console.error('❌ Amplify configuration error:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset code
  static async forgotPassword(username) {
    try {
      console.log('AuthService.forgotPassword called with:', { username });
      const auth = this.checkAuth();
      const result = await auth.forgotPassword(username);
      console.log('AuthService.forgotPassword success:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('AuthService.forgotPassword error:', error);
      return { success: false, error: error.message };
    }
  }

  // Confirm password reset
  static async confirmForgotPassword(username, code, newPassword) {
    try {
      console.log('AuthService.confirmForgotPassword called with:', { username, code });
      const auth = this.checkAuth();
      const result = await auth.forgotPasswordSubmit(username, code, newPassword);
      console.log('AuthService.confirmForgotPassword success:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('AuthService.confirmForgotPassword error:', error);
      return { success: false, error: error.message };
    }
  }

  // Alternative sign-in method (kept for backward compatibility)
  static async signInFresh(username, password) {
    console.log('🔄 signInFresh called - redirecting to regular signIn');
    return await this.signIn(username, password);
  }

  // Clear any auth/session state safely (used by flows after confirmation)
  static async clearAuthState() {
    try {
      const auth = this.checkAuth();
      // Best-effort signOut to ensure a clean state
      try {
        await auth.signOut();
      } catch (signOutError) {
        // Ignore sign out errors here; we just want a clean local state
        console.log('clearAuthState signOut note:', signOutError?.message || signOutError);
      }
      this._pendingSignIn = false;
      this._retryCount = 0;
      return { success: true };
    } catch (error) {
      this._pendingSignIn = false;
      this._retryCount = 0;
      return { success: false, error: error?.message || 'Failed to clear auth state' };
    }
  }
}

// Default export for compatibility with imports
export default AuthService;