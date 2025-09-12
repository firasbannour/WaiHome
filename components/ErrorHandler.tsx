// components/ErrorHandler.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface ErrorHandlerProps {
  error: string;
  email?: string;
  onRetry?: () => void;
  onClear?: () => void;
}

export default function ErrorHandler({ error, email, onRetry, onClear }: ErrorHandlerProps) {
  const navigation = useNavigation();

  // Analyze error and suggest solutions
  const getErrorAnalysis = () => {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('not confirmed') || errorLower.includes('pas encore confirmé')) {
      return {
        type: 'unconfirmed',
        title: 'Account Not Confirmed',
        message: 'Your account exists but needs email verification.',
        actions: [
          {
            label: 'Check Email & Verify',
            action: () => navigation.navigate('pendingConfirmation' as never, { email }),
            primary: true,
          },
          {
            label: 'Resend Code',
            action: () => navigation.navigate('confirmSignup' as never, { email }),
            primary: false,
          }
        ]
      };
    }
    
    if (errorLower.includes('invalid') || errorLower.includes('incorrect')) {
      return {
        type: 'credentials',
        title: 'Invalid Credentials',
        message: 'Please check your email and password.',
        actions: [
          {
            label: 'Try Again',
            action: onRetry,
            primary: true,
          },
          {
            label: 'Forgot Password?',
            action: () => navigation.navigate('forgotPassword' as never),
            primary: false,
          }
        ]
      };
    }
    
    if (errorLower.includes('too many') || errorLower.includes('rate limit')) {
      return {
        type: 'rateLimit',
        title: 'Too Many Attempts',
        message: 'Please wait before trying again.',
        actions: [
          {
            label: 'Wait & Retry',
            action: onRetry,
            primary: true,
          },
          {
            label: 'Contact Support',
            action: () => Alert.alert('Support', 'Please contact our support team for assistance.'),
            primary: false,
          }
        ]
      };
    }
    
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return {
        type: 'network',
        title: 'Connection Error',
        message: 'Please check your internet connection.',
        actions: [
          {
            label: 'Retry',
            action: onRetry,
            primary: true,
          },
          {
            label: 'Check Connection',
            action: () => Alert.alert('Connection', 'Please ensure you have a stable internet connection.'),
            primary: false,
          }
        ]
      };
    }
    
    // Default error handling
    return {
      type: 'general',
      title: 'Error Occurred',
      message: error,
      actions: [
        {
          label: 'Try Again',
          action: onRetry,
          primary: true,
        },
        {
          label: 'Clear',
          action: onClear,
          primary: false,
        }
      ]
    };
  };

  const errorAnalysis = getErrorAnalysis();

  const handleAction = (action: (() => void) | undefined) => {
    if (action) {
      action();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.errorHeader}>
        <MaterialIcons 
          name={errorAnalysis.type === 'unconfirmed' ? 'email' : 'error-outline'} 
          size={24} 
          color="#E74C3C" 
        />
        <Text style={styles.errorTitle}>{errorAnalysis.title}</Text>
      </View>
      
      <Text style={styles.errorMessage}>{errorAnalysis.message}</Text>
      
      <View style={styles.actionsContainer}>
        {errorAnalysis.actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.actionButton,
              action.primary ? styles.primaryAction : styles.secondaryAction
            ]}
            onPress={() => handleAction(action.action)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.actionText,
              action.primary ? styles.primaryActionText : styles.secondaryActionText
            ]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {onClear && (
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <MaterialIcons name="close" size={16} color="#999" />
          <Text style={styles.clearText}>Clear Error</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fdf2f2',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E74C3C',
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  primaryAction: {
    backgroundColor: '#0c7a7e',
  },
  secondaryAction: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0c7a7e',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryActionText: {
    color: '#FFF',
  },
  secondaryActionText: {
    color: '#0c7a7e',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    alignSelf: 'center',
  },
  clearText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
});
