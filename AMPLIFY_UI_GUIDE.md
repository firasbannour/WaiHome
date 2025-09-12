# AWS Amplify UI React Native Integration Guide

## Overview

This guide explains how to use AWS Amplify UI React Native components in your WaiHome project. The Amplify UI components provide pre-built, accessible, and customizable UI components that integrate seamlessly with AWS Amplify services.

## Installation

The AWS Amplify UI React Native package has been installed:

```bash
npm install @aws-amplify/ui-react-native
```

## Updated Screens

### 1. Login Screen (`app/login.tsx`)

The login screen now uses the `Authenticator` component with custom styling:

```tsx
import { 
  Authenticator, 
  useAuthenticator,
  ThemeProvider,
  createTheme,
} from '@aws-amplify/ui-react-native';

// Custom theme
const customTheme = createTheme({
  tokens: {
    colors: {
      brand: {
        primary: {
          10: '#007AFF',
          20: '#007AFF',
          // ... other shades
        },
      },
    },
  },
});

// Custom components for different authentication states
const CustomSignIn = () => {
  const { signIn, submitForm } = useAuthenticator();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion WaiHome</Text>
      <View style={styles.form}>
        {/* Authenticator handles form rendering */}
      </View>
    </View>
  );
};

export default function LoginScreen() {
  return (
    <ThemeProvider theme={customTheme}>
      <Authenticator
        components={{
          SignIn: CustomSignIn,
          SignUp: CustomSignUp,
          ConfirmSignUp: CustomConfirmSignUp,
          ForgotPassword: CustomForgotPassword,
          ConfirmResetPassword: CustomConfirmResetPassword,
        }}
        services={{
          async handleSignIn(formData) {
            const { username, password } = formData;
            const result = await AuthService.signIn(username, password);
            if (!result.success) {
              throw new Error(result.error);
            }
            return result.data;
          },
          // ... other service handlers
        }}
      />
    </ThemeProvider>
  );
}
```

### 2. Signup Screen (`app/signup.tsx`)

The signup screen uses the same `Authenticator` component but starts in signup mode:

```tsx
<Authenticator
  initialState="signUp"
  components={{
    SignUp: CustomSignUp,
    SignIn: CustomSignIn,
    ConfirmSignUp: CustomConfirmSignUp,
  }}
  // ... services configuration
/>
```

### 3. Forgot Password Screen (`app/forgotPassword.tsx`)

The forgot password screen starts in the forgot password state:

```tsx
<Authenticator
  initialState="forgotPassword"
  components={{
    ForgotPassword: CustomForgotPassword,
    ConfirmResetPassword: CustomConfirmResetPassword,
    SignIn: CustomSignIn,
  }}
  // ... services configuration
/>
```

## Available Components

### Core Components

1. **Authenticator**: Main authentication component that handles all auth flows
2. **Button**: Styled button component with various variations
3. **TextField**: Input field with validation and styling
4. **Card**: Container component for grouping content
5. **Heading**: Typography component for titles
6. **ThemeProvider**: Context provider for theming

### Authentication Components

- `SignIn`: Login form
- `SignUp`: Registration form
- `ConfirmSignUp`: Email verification form
- `ForgotPassword`: Password reset request form
- `ConfirmResetPassword`: Password reset confirmation form

## Theming

### Custom Theme Creation

```tsx
import { createTheme } from '@aws-amplify/ui-react-native';

const customTheme = createTheme({
  tokens: {
    colors: {
      brand: {
        primary: {
          10: '#0c7a7e',
          20: '#0c7a7e',
          40: '#0c7a7e',
          60: '#0c7a7e',
          80: '#0c7a7e',
          90: '#0c7a7e',
          100: '#0c7a7e',
        },
      },
    },
    fontSizes: {
      small: '14px',
      medium: '16px',
      large: '18px',
    },
    space: {
      small: '8px',
      medium: '16px',
      large: '24px',
    },
  },
});
```

### Applying Themes

```tsx
import { ThemeProvider } from '@aws-amplify/ui-react-native';

export default function MyComponent() {
  return (
    <ThemeProvider theme={customTheme}>
      {/* Your components here */}
    </ThemeProvider>
  );
}
```

## Service Integration

### AuthService Methods

The `AuthService` class has been updated with additional methods:

```javascript
// Existing methods
static async signIn(username, password)
static async signUp(username, password, email)
static async signOut()
static async getCurrentUser()
static async getCurrentUserId()

// New methods
static async forgotPassword(username)
static async confirmForgotPassword(username, code, newPassword)
```

### Service Handlers in Authenticator

```tsx
services={{
  async handleSignIn(formData) {
    const { username, password } = formData;
    const result = await AuthService.signIn(username, password);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
  async handleSignUp(formData) {
    const { username, password, attributes } = formData;
    const result = await AuthService.signUp(username, password, attributes.email);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
  async handleForgotPassword(formData) {
    const { username } = formData;
    return await AuthService.forgotPassword(username);
  },
  async handleConfirmResetPassword(formData) {
    const { username, confirmation_code, password } = formData;
    return await AuthService.confirmForgotPassword(username, confirmation_code, password);
  },
}}
```

## Usage Examples

### Basic Button Usage

```tsx
import { Button } from '@aws-amplify/ui-react-native';

<Button
  variation="primary"
  onPress={() => console.log('Button pressed')}
>
  Click Me
</Button>
```

### TextField with Validation

```tsx
import { TextField } from '@aws-amplify/ui-react-native';

<TextField
  label="Email"
  placeholder="Enter your email"
  type="email"
  required
/>
```

### Card Container

```tsx
import { Card, Heading } from '@aws-amplify/ui-react-native';

<Card>
  <Heading level={2}>Card Title</Heading>
  <Text>Card content goes here</Text>
</Card>
```

## Benefits

1. **Consistent Styling**: All components follow the same design system
2. **Accessibility**: Built-in accessibility features
3. **Type Safety**: Full TypeScript support
4. **Customization**: Easy theming and styling
5. **Integration**: Seamless integration with AWS Amplify services
6. **Validation**: Built-in form validation
7. **Error Handling**: Consistent error handling across components

## Configuration

### Amplify Configuration

Make sure your `app/amplifyConfig.js` is properly configured:

```javascript
export default {
  Auth: {
    region: 'YOUR_REGION',
    userPoolId: 'YOUR_USER_POOL_ID',
    userPoolWebClientId: 'YOUR_APP_CLIENT_ID',
  },
};
```

### Package.json Dependencies

The following dependencies are required:

```json
{
  "dependencies": {
    "@aws-amplify/ui-react-native": "^1.2.29",
    "aws-amplify": "^5.3.26",
    "aws-amplify-react-native": "^7.0.8"
  }
}
```

## Troubleshooting

### Common Issues

1. **Theme not applying**: Make sure `ThemeProvider` wraps your components
2. **Authentication errors**: Check your Amplify configuration
3. **Styling issues**: Verify theme tokens are correctly defined
4. **Navigation issues**: Ensure proper routing setup

### Debug Tips

1. Check console logs for authentication errors
2. Verify AWS Amplify configuration
3. Test with different authentication flows
4. Use the test component (`TestImagePicker.tsx`) to verify component functionality

## Next Steps

1. Configure your AWS Amplify backend
2. Update the `amplifyConfig.js` with your actual AWS credentials
3. Test all authentication flows
4. Customize themes to match your brand
5. Add additional Amplify UI components as needed

## Resources

- [AWS Amplify UI React Native Documentation](https://ui.docs.amplify.aws/react-native)
- [AWS Amplify Authentication Guide](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [Amplify UI Component Library](https://ui.docs.amplify.aws/react-native/components)
