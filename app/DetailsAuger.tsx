import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, Modal, Animated } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { controlShellyComponent } from '../services/shellyControlService';
import { ensureDetailedComponents, updateComponentDetailed } from '../lib/utils/componentUtils';

export default function DetailsAuger() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Récupérer les états depuis SiteDetails
  const { siteId, augerState, onAugerChange } = route.params as any;
  
  const [augerOn, setAugerOn] = useState(augerState || false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);
  const anim = React.useRef(new Animated.Value(augerOn ? 1 : 0)).current;

  // Synchroniser avec les états de SiteDetails
  useEffect(() => {
    setAugerOn(augerState || false);
  }, [augerState]);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: augerOn ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [augerOn]);

  const handleSwitchPress = () => {
    setPendingValue(!augerOn);
    setConfirmVisible(true);
  };
  
  const handleConfirm = async (ok: boolean) => {
    if (ok) {
      const newAugerState = pendingValue;
      setAugerOn(newAugerState);
      
      // Notifier SiteDetails du changement
      if (onAugerChange) {
        onAugerChange(newAugerState);
      }
      
      // NOUVEAU : Contrôler la sortie physique Shelly (OUTPUT-1 pour Auger)
      const success = await controlShellyComponent(siteId, 'auger', newAugerState);
      if (success) {
        console.log('✅ Shelly Auger output toggled successfully');
      } else {
        console.error('❌ Error toggling Shelly Auger output');
      }
      
      // Sauvegarder dans AWS DynamoDB (mise à jour, pas création)
      try {
        console.log('🔄 Saving auger change to AWS...');
        const { ShellyService } = require('../services/shellyService');
        const { AuthService } = require('../services/authService');
        
        const currentUserId = await AuthService.getCurrentUserId();
        if (currentUserId) {
          // Récupérer les données actuelles du site
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const sitesJson = await AsyncStorage.getItem('sites');
          if (sitesJson) {
            const sites = JSON.parse(sitesJson);
            const currentSite = sites.find((s: any) => s.id === siteId);
            
            if (currentSite && currentSite.deviceInfo) {
              // S'assurer que les composants ont la structure détaillée
              const detailedComponents = ensureDetailedComponents(currentSite.deviceInfo.components);
              
              // Mettre à jour le composant auger avec la structure détaillée
              const updatedComponents = updateComponentDetailed(detailedComponents, 'auger', newAugerState);
              
              // Construire un payload de mise à jour avec composants détaillés
              const updates = {
                components: updatedComponents,
                lastUpdated: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              console.log('📤 Mise à jour AWS via PUT avec ID:', currentSite.id, 'payload:', updates);
              const result = await ShellyService.updateShellyDevice(currentSite.id, updates);
              
              if (result.success) {
                console.log('✅ Auger state saved to AWS successfully');
              } else {
                console.error('❌ AWS save error:', result.error);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ AWS save error:', error);
      }
      
      console.log('🔧 Auger state changed to:', newAugerState);
    }
    setConfirmVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header moderne comme NotificationHistory */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtnLeft} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={26} color="#0c7a7e" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Auger</Text>
        </View>
        <View style={styles.headerBtnRight} />
      </View>

      {/* Status History */}
      <Text style={styles.sectionTitle}>Status History</Text>
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <MaterialIcons name="error-outline" size={22} color="#f6c343" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.statusBold}>Clog - Needs Maintenance</Text>
            <Text style={styles.statusDate}>2025-07-18 08:20</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <MaterialIcons name="check-circle" size={22} color="#28a745" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.statusBold}>Normal operation</Text>
            <Text style={styles.statusDate}>2025-07-17 22:05</Text>
          </View>
        </View>
      </View>

      {/* Manual Control modernisé */}
      <Text style={styles.sectionTitle}>Manual Control</Text>
      <View style={styles.manualCardRow}>
        {/* Left: icône cercle + badge */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="screwdriver" size={32} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.statusBold}>Auger</Text>
          <Text style={styles.statusDate}>
            Status: <Text style={augerOn ? styles.badgeOn : styles.badgeOff}>{augerOn ? 'On' : 'Off'}</Text>
          </Text>
        </View>
        {/* Switch custom animé */}
        <TouchableOpacity onPress={handleSwitchPress} activeOpacity={0.8} style={{ marginLeft: 10 }}>
          <View style={[styles.switchTrack, { backgroundColor: augerOn ? '#0c7a7e' : '#b0b0b0' }] }>
            <Animated.View style={[styles.switchKnob, { left: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 28] }) }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Modale de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => handleConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="screwdriver" size={36} color="#0c7a7e" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 18, color: '#0c7a7e', textAlign: 'center' }}>
              {pendingValue ? 'Turn ON the auger?' : 'Turn OFF the auger?'}
            </Text>
            {!pendingValue && (
              <Text style={{ color: '#d9534f', fontWeight: '600', fontSize: 15, textAlign: 'center', marginBottom: 10 }}>
                Are you sure? Your device will no longer function.
              </Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f0f4f8' }]} onPress={() => handleConfirm(false)}>
                <Text style={{ fontWeight: '700', color: '#222' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#0c7a7e', marginLeft: 12 }]} onPress={() => handleConfirm(true)}>
                <Text style={{ fontWeight: '700', color: '#fff' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...StyleSheet.flatten({
    container: { flex: 1, backgroundColor: '#f7fafb', padding: 0 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      backgroundColor: '#fff',
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 4,
      height: 72,
      minHeight: 72,
    },
    headerBtnLeft: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    headerBtnRight: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      marginLeft: 0,
    },
    logo: {
      width: 28,
      height: 28,
      marginRight: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: '#0c7a7e',
      letterSpacing: 0.2,
      textAlign: 'left',
      alignSelf: 'center',
    },
    sectionTitle: { fontWeight: '700', fontSize: 16, color: '#222', marginTop: 22, marginBottom: 8, marginLeft: 18 },
    statusCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, borderWidth: 1, borderColor: '#e3e8ee' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    statusBold: { fontWeight: '700', fontSize: 15, color: '#222' },
    statusDate: { fontSize: 13, color: '#888', marginTop: 2 },
    manualCardRow: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 14, padding: 18, marginBottom: 14, elevation: 3, shadowColor: '#0c7a7e', shadowOpacity: 0.10, shadowRadius: 8, borderWidth: 1, borderColor: '#e3e8ee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#0c7a7e', alignItems: 'center', justifyContent: 'center', shadowColor: '#0c7a7e', shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
    badgeOn: { color: '#28a745', fontWeight: 'bold', backgroundColor: '#e6f9ed', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    badgeOff: { color: '#d9534f', fontWeight: 'bold', backgroundColor: '#fdecea', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    switchTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#b0b0b0', justifyContent: 'center', position: 'relative' },
    switchKnob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, elevation: 8 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  })
});
