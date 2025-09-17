import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, Modal, Animated } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { controlShellyComponent } from '../services/shellyControlService';
import { ensureDetailedComponents, updateComponentDetailed } from '../lib/utils/componentUtils';

export default function DetailsHeater() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Récupérer les états depuis SiteDetails
  const { siteId, heaterState, onHeaterChange } = route.params as any;
  
  const [heaterOn, setHeaterOn] = useState(heaterState || false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);
  const anim = React.useRef(new Animated.Value(heaterOn ? 1 : 0)).current;

  // Synchroniser avec les états de SiteDetails
  useEffect(() => {
    setHeaterOn(heaterState || false);
  }, [heaterState]);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: heaterOn ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [heaterOn]);

  const handleSwitchPress = () => {
    setPendingValue(!heaterOn);
    setConfirmVisible(true);
  };
  
  const handleConfirm = async (ok: boolean) => {
    if (ok) {
      const newHeaterState = pendingValue;
      setHeaterOn(newHeaterState);
      
      // Notifier SiteDetails du changement
      if (onHeaterChange) {
        onHeaterChange(newHeaterState);
      }
      
      // NOUVEAU : Contrôler la sortie physique Shelly (OUTPUT-2 pour Heater)
      const success = await controlShellyComponent(siteId, 'heater', newHeaterState);
      if (success) {
        console.log('✅ Shelly Heater output toggled successfully');
      } else {
        console.error('❌ Error toggling Shelly Heater output');
      }
      
      // Sauvegarder dans AWS DynamoDB (mise à jour, pas création)
      try {
        console.log('🔄 Saving heater change to AWS...');
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
              
              // Mettre à jour le composant heater avec la structure détaillée
              const updatedComponents = updateComponentDetailed(detailedComponents, 'heater', newHeaterState);
              
              // Construire un payload de mise à jour avec composants détaillés
              const updates = {
                components: updatedComponents,
                lastUpdated: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              console.log('📤 AWS update via PUT with ID:', currentSite.id, 'payload:', updates);
              const result = await ShellyService.updateShellyDevice(currentSite.id, updates);
              
              if (result.success) {
                console.log('✅ Heater state saved to AWS successfully');
              } else {
                console.error('❌ AWS save error:', result.error);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ AWS save error:', error);
      }
      
      console.log('🔧 Heater state changed to:', newHeaterState);
    }
    setConfirmVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header moderne comme NotificationHistory */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtnLeft} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={26} color="#16989d" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Heater</Text>
        </View>
        <View style={styles.headerBtnRight} />
      </View>

      {/* Status History */}
      <Text style={styles.sectionTitle}>Status History</Text>
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <MaterialIcons name="error-outline" size={22} color="#f6c343" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.statusBold}>Overheat - Needs Attention</Text>
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
          <MaterialCommunityIcons name="fire" size={32} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.statusBold}>Heater</Text>
          <Text style={styles.statusDate}>
            Status: <Text style={heaterOn ? styles.badgeOn : styles.badgeOff}>{heaterOn ? 'On' : 'Off'}</Text>
          </Text>
        </View>
        {/* Switch custom animé */}
        <TouchableOpacity onPress={handleSwitchPress} activeOpacity={0.8} style={{ marginLeft: 10 }}>
          <View style={[styles.switchTrack, { backgroundColor: heaterOn ? '#16989d' : '#b0b0b0' }] }>
            <Animated.View style={[styles.switchKnob, { left: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 28] }) }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Modale de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => handleConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="fire" size={36} color="#16989d" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 18, color: '#16989d', textAlign: 'center' }}>
              {pendingValue ? 'Turn ON the heater?' : 'Turn OFF the heater?'}
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
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#16989d', marginLeft: 12 }]} onPress={() => handleConfirm(true)}>
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
      color: '#16989d',
      letterSpacing: 0.2,
      textAlign: 'left',
      alignSelf: 'center',
    },
    sectionTitle: { fontWeight: '700', fontSize: 16, color: '#222', marginTop: 22, marginBottom: 8, marginLeft: 18 },
    statusCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, borderWidth: 1, borderColor: '#e3e8ee' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    statusBold: { fontWeight: '700', fontSize: 15, color: '#222' },
    statusDate: { fontSize: 13, color: '#888', marginTop: 2 },
    manualCardRow: { backgroundColor: '#fff', borderRadius: 20, marginHorizontal: 14, padding: 18, marginBottom: 14, elevation: 3, shadowColor: '#ff9800', shadowOpacity: 0.10, shadowRadius: 8, borderWidth: 1, borderColor: '#e3e8ee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#16989d', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff9800', shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
    badgeOn: { color: '#28a745', fontWeight: 'bold', backgroundColor: '#e6f9ed', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    badgeOff: { color: '#d9534f', fontWeight: 'bold', backgroundColor: '#fdecea', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    switchTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#b0b0b0', justifyContent: 'center', position: 'relative' },
    switchKnob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 22, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, elevation: 8 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  })
});
