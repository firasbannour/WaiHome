// components/AccountStatus.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '../services/authService';

interface AccountStatusProps {
  email: string;
  onStatusChange?: (status: string) => void;
}

export default function AccountStatus({ email, onStatusChange }: AccountStatusProps) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'unconfirmed' | 'notfound' | 'error'>('checking');
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Check account status
  const checkAccountStatus = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      const result = await AuthService.isUserConfirmed(email);
      
      if (result.success) {
        if (result.confirmed) {
          setStatus('confirmed');
          onStatusChange?.('confirmed');
        } else {
          setStatus('unconfirmed');
          onStatusChange?.('unconfirmed');
        }
      } else {
        setStatus('error');
        onStatusChange?.('error');
      }
      
      setLastChecked(new Date());
    } catch (error) {
      setStatus('error');
      onStatusChange?.('error');
    } finally {
      setLoading(false);
    }
  };

  // Check status on mount and when email changes
  useEffect(() => {
    checkAccountStatus();
  }, [email]);

  // Get status display info
  const getStatusInfo = () => {
    switch (status) {
      case 'checking':
        return {
          icon: 'hourglass-empty',
          color: '#F39C12',
          title: 'Checking Account Status...',
          message: 'Verifying your account status',
          actions: []
        };
      
      case 'confirmed':
        return {
          icon: 'check-circle',
          color: '#27AE60',
          title: 'Account Confirmed!',
          message: 'Your account is ready to use',
          actions: [
            {
              label: 'Sign In Now',
              action: () => navigation.navigate('login' as never),
              primary: true,
            }
          ]
        };
      
      case 'unconfirmed':
        return {
          icon: 'email',
          color: '#E67E22',
          title: 'Account Pending Confirmation',
          message: 'Please check your email and verify your account',
          actions: [
            {
              label: 'Check Email & Verify',
              action: () => navigation.navigate('pendingConfirmation' as never, { email }),
              primary: true,
            },
            {
              label: 'Enter Code Now',
              action: () => navigation.navigate('confirmSignup' as never, { email }),
              primary: false,
            }
          ]
        };
      
      case 'notfound':
        return {
          icon: 'person-off',
          color: '#E74C3C',
          title: 'Account Not Found',
          message: 'No account found with this email address',
          actions: [
            {
              label: 'Create New Account',
              action: () => navigation.navigate('signup' as never),
              primary: true,
            }
          ]
        };
      
      case 'error':
        return {
          icon: 'error',
          color: '#E74C3C',
          title: 'Error Checking Status',
          message: 'Unable to verify account status',
          actions: [
            {
              label: 'Try Again',
              action: checkAccountStatus,
              primary: true,
            },
            {
              label: 'Contact Support',
              action: () => Alert.alert('Support', 'Please contact our support team for assistance.'),
              primary: false,
            }
          ]
        };
      
      default:
        return {
          icon: 'help',
          color: '#999',
          title: 'Unknown Status',
          message: 'Unable to determine account status',
          actions: []
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleAction = (action: (() => void) | undefined) => {
    if (action) {
      action();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusHeader}>
        <MaterialIcons 
          name={statusInfo.icon as any} 
          size={28} 
          color={statusInfo.color} 
        />
        <Text style={[styles.statusTitle, { color: statusInfo.color }]}>
          {statusInfo.title}
        </Text>
      </View>
      
      <Text style={styles.statusMessage}>{statusInfo.message}</Text>
      
      {email && (
        <View style={styles.emailContainer}>
          <FontAwesome name="envelope" size={14} color="#666" />
          <Text style={styles.emailText}>{email}</Text>
        </View>
      )}
      
      {statusInfo.actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {statusInfo.actions.map((action, index) => (
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
      )}
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={checkAccountStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#0c7a7e" />
          ) : (
            <MaterialIcons name="refresh" size={16} color="#0c7a7e" />
          )}
          <Text style={styles.refreshText}>
            {loading ? 'Checking...' : 'Refresh Status'}
          </Text>
        </TouchableOpacity>
        
        {lastChecked && (
          <Text style={styles.lastCheckedText}>
            Last checked: {lastChecked.toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  statusMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  emailText: {
    fontSize: 14,
    color: '#0c7a7e',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
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
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e8f4f8',
    marginBottom: 8,
  },
  refreshText: {
    fontSize: 14,
    color: '#0c7a7e',
    fontWeight: '600',
    marginLeft: 8,
  },
  lastCheckedText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
