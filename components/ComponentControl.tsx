import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import componentStateService from '../services/componentStateService';

interface ComponentControlProps {
  siteId: string;
  componentType: 'pump' | 'auger' | 'heater' | 'highWater' | 'binReplaced' | 'emergencyHeater';
  currentState: boolean;
  onStateChange: (newState: boolean) => void;
  title: string;
  icon: string;
  iconType?: 'MaterialIcons' | 'MaterialCommunityIcons';
  disabled?: boolean;
}

export default function ComponentControl({
  siteId,
  componentType,
  currentState,
  onStateChange,
  title,
  icon,
  iconType = 'MaterialCommunityIcons',
  disabled = false
}: ComponentControlProps) {
  const [isOn, setIsOn] = useState(currentState);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const anim = React.useRef(new Animated.Value(isOn ? 1 : 0)).current;

  // Synchroniser avec l'état parent
  useEffect(() => {
    setIsOn(currentState);
  }, [currentState]);

  // Charger l'état depuis DynamoDB au montage
  useEffect(() => {
    loadComponentState();
  }, []);

  const loadComponentState = async () => {
    try {
      const state = await componentStateService.getComponentState(siteId, componentType);
      if (state) {
        setIsOn(state.state);
        onStateChange(state.state);
      }
    } catch (error) {
      console.error(`❌ Erreur chargement état ${componentType}:`, error);
    }
  };

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOn ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isOn]);

  const handleSwitchPress = () => {
    if (disabled) return;
    setPendingValue(!isOn);
    setConfirmVisible(true);
  };

  const handleConfirm = async (ok: boolean) => {
    if (ok) {
      setIsLoading(true);
      const newState = pendingValue;

      try {
        const result = await componentStateService.updateComponentState(
          siteId,
          componentType,
          newState
        );

        if (result.success) {
          setIsOn(newState);
          onStateChange(newState);
          console.log(`✅ État ${componentType} synchronisé avec succès:`, result);
        } else {
          console.error(`❌ Échec synchronisation ${componentType}:`, result.error);
        }
      } catch (error) {
        console.error(`❌ Erreur mise à jour état ${componentType}:`, error);
      } finally {
        setIsLoading(false);
      }
    }
    setConfirmVisible(false);
  };

  const getIconComponent = () => {
    const iconProps = { size: 32, color: '#fff' };
    
    if (iconType === 'MaterialIcons') {
      return <MaterialIcons name={icon as any} {...iconProps} />;
    } else {
      return <MaterialCommunityIcons name={icon as any} {...iconProps} />;
    }
  };

  const getWarningMessage = () => {
    if (componentType === 'pump' && !pendingValue) {
      return 'Are you sure? Your device will no longer function.';
    }
    if (componentType === 'heater' && !pendingValue) {
      return 'Are you sure? Heating will be disabled.';
    }
    if (componentType === 'emergencyHeater' && !pendingValue) {
      return 'Are you sure? Emergency heating will be disabled.';
    }
    return null;
  };

  return (
    <>
      <View style={styles.manualCardRow}>
        <View style={[styles.iconCircle, disabled && styles.iconCircleDisabled]}>
          {getIconComponent()}
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.statusBold}>{title}</Text>
          <Text style={styles.statusDate}>
            Status: <Text style={isOn ? styles.badgeOn : styles.badgeOff}>
              {isOn ? 'On' : 'Off'}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSwitchPress}
          activeOpacity={0.8}
          style={{ marginLeft: 10 }}
          disabled={disabled || isLoading}
        >
          <View style={[
            styles.switchTrack,
            { backgroundColor: isOn ? '#16989d' : '#b0b0b0' },
            disabled && styles.switchTrackDisabled
          ]}>
            <Animated.View style={[
              styles.switchKnob,
              { left: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 28] }) }
            ]} />
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => handleConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
              {getIconComponent()}
            </View>
            <Text style={styles.modalTitle}>
              {pendingValue ? `Turn ON the ${title.toLowerCase()}?` : `Turn OFF the ${title.toLowerCase()}?`}
            </Text>
            
            {getWarningMessage() && (
              <Text style={styles.warningText}>
                {getWarningMessage()}
              </Text>
            )}
            
            {isLoading && (
              <Text style={styles.syncingText}>
                Synchronizing with cloud...
              </Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => handleConfirm(false)}
                disabled={isLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={() => handleConfirm(true)}
                disabled={isLoading}
              >
                <Text style={styles.confirmBtnText}>
                  {isLoading ? 'Syncing...' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = {
  manualCardRow: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 14,
    padding: 18,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#16989d',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#16989d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16989d',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  iconCircleDisabled: {
    backgroundColor: '#b0b0b0',
    shadowOpacity: 0.05
  },
  statusBold: {
    fontWeight: '700',
    fontSize: 15,
    color: '#222'
  },
  statusDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 2
  },
  badgeOn: {
    color: '#28a745',
    fontWeight: 'bold',
    backgroundColor: '#e6f9ed',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  badgeOff: {
    color: '#d9534f',
    fontWeight: 'bold',
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b0b0b0',
    justifyContent: 'center',
    position: 'relative'
  },
  switchTrackDisabled: {
    opacity: 0.5
  },
  switchKnob: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 18,
    color: '#16989d',
    textAlign: 'center'
  },
  warningText: {
    color: '#d9534f',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 10
  },
  syncingText: {
    color: '#16989d',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  cancelBtn: {
    backgroundColor: '#f0f4f8'
  },
  confirmBtn: {
    backgroundColor: '#16989d',
    marginLeft: 12
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#222'
  },
  confirmBtnText: {
    fontWeight: '700',
    color: '#fff'
  }
};
