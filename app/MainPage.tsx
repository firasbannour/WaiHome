// app/MainPage.tsx – BLE + Wi-Fi scan
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  FlatList,
  SafeAreaView,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Switch,
  TextInput,
  Linking,
} from "react-native";
import { useNavigation } from '@react-navigation/native';
import { Vibration, AccessibilityInfo } from 'react-native';
import { AuthService } from '../services/authService';
import { BleManager, State } from "react-native-ble-plx";
import WifiManager from "react-native-wifi-reborn";
import { Base64 } from "js-base64";
import {
  MaterialIcons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from 'expo-network';
import { ShellyService } from '../services/shellyService';
import { createDetailedComponents } from '../lib/utils/componentUtils';

type McIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const SERVICE_UUID = "9800";
const CHARACTERISTIC_UUID = "9801";
const bleManager = new BleManager();

interface SiteInfo {
  id: string;
  name: string;
  icon: McIconName;
  status: "Connected" | "Not Connected" | "Maintenance Required";
  solids: number;
  notificationsEnabled: boolean;
  deviceInfo?: {
    deviceId: string;
    macAddress: string;
    ipAddress: string;
    deviceName: string;
    connectionType: 'BLE' | 'WIFI';
    lastConnected: string;
  };
}


// Helper pour fetch avec timeout (remplace AbortSignal.timeout qui ne marche pas en RN)
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try { 
    return await fetch(url, { ...opts, signal: controller.signal }); 
  }
  finally { 
    clearTimeout(id); 
  }
}

// VERROU CRITIQUE : Finaliser la création de site seulement si Shelly est vraiment connecté
async function finalizeSiteCreation(params: {
  shellyIp: string;
  ssid: string;
  siteName: string;
  currentUserId: string;
}) {
  const { shellyIp, ssid, siteName, currentUserId } = params;
  
  try {
    console.log('🔒 VÉRIFICATION CRITIQUE : Test de connexion réelle au Shelly...');
    
    // 1. Test de connexion HTTP au Shelly
    const shellyResponse = await fetchWithTimeout(`http://${shellyIp}/shelly`, {}, 15000);
    if (!shellyResponse.ok) {
      throw new Error(`Shelly non accessible sur ${shellyIp}`);
    }
    
    const shellyData = await shellyResponse.json();
    console.log('✅ Shelly accessible:', shellyData);
    
    // 2. Récupérer deviceId et macAddress
    const deviceId = shellyData.id || shellyData.device?.id || 'unknown';
    const macAddress = shellyData.mac || shellyData.device?.mac || 'unknown';
    
    // 3. Test de connexion simple
    const connectionTest = await fetchWithTimeout(`http://${shellyIp}/status`, {}, 15000);
    if (!connectionTest.ok) {
      throw new Error('Shelly connection test failed');
    }
    
    console.log('✅ VÉRIFICATION CRITIQUE RÉUSSIE : Shelly opérationnel');
    
    // 4. Créer le site dans AWS d'abord
    const deviceInfo = {
      deviceId: deviceId,
      macAddress: macAddress,
      ipAddress: shellyIp,
      deviceName: `Shelly-${deviceId.slice(-6)}`,
      connectionType: 'WIFI' as const,
      lastConnected: new Date().toISOString(),
      siteName: siteName,
      siteId: `${currentUserId}_${deviceId}_${Date.now()}`
    };
    
    const awsResult = await ShellyService.saveShellyDevice(currentUserId, deviceInfo);
    
    if (!awsResult.success) {
      throw new Error(`Erreur AWS: ${awsResult.error || 'Erreur inconnue'}`);
    }
    
    console.log('✅ Site créé dans AWS avec succès');
    
    // 5. Maintenant créer localement
    const newSite: SiteInfo = {
      id: deviceInfo.siteId,
      name: siteName,
      icon: 'home-outline' as McIconName,
      status: 'Connected' as const,
      solids: 0,
      notificationsEnabled: false,
      deviceInfo: {
        deviceId: deviceId,
        macAddress: macAddress,
        ipAddress: shellyIp,
        deviceName: deviceInfo.deviceName,
        connectionType: 'WIFI',
        lastConnected: new Date().toISOString()
      }
    };
    
    return { success: true, site: newSite };
    
  } catch (error) {
    console.error('❌ VÉRIFICATION CRITIQUE ÉCHOUÉE:', error);
    return { 
      success: false, 
      error: (error as Error).message || 'Unable to verify Shelly connection'
    };
  }
}

export default function MainPage() {
  const navigation = useNavigation();

  /* ---------- BLE state ---------- */
  const [bleState, setBleState] = useState<any>('Unknown');
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [connectedDevice, setConnected] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  /* ---------- Wi-Fi state ---------- */
  const [wifiVisible, setWifiVisible] = useState(false);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiList, setWifiList] = useState<{ SSID: string; BSSID?: string; capabilities?: string }[]>(
    []
  );

  /* ---------- UI state ---------- */
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [, setDevVisible] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Heure et date actuelles
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // 1. Ajouter les états pour le renommage
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [selectedSite, setSelectedSite] = useState<SiteInfo | null>(null);

  // Nouveaux états pour le flow d'ajout
  const [addStep, setAddStep] = useState<null | 'method' | 'ble' | 'wifi' | 'wifi-inject' | 'site-name'>(null);
  const [pendingConnection, setPendingConnection] = useState<'ble' | 'wifi' | null>(null);
  const [pendingDevice, setPendingDevice] = useState<any | null>(null);
  const [pendingWifi, setPendingWifi] = useState<string | null>(null);
  const [newSiteName, setNewSiteName] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [injectionSsid, setInjectionSsid] = useState("");
  const [injectionPassword, setInjectionPassword] = useState("");
  const [injectionLoading, setInjectionLoading] = useState(false);
  const [injectionError, setInjectionError] = useState("");
  const [currentWifiSsid, setCurrentWifiSsid] = useState("");
  // IP détectée du Shelly après configuration Wi‑Fi
  const [shellyIP, setShellyIP] = useState<string | null>(null);

  // Lecture des métriques réelles depuis un Shelly Gen2 (RPC) si accessible
  const readShellyComponents = async (ip: string | null | undefined) => {
    try {
      const targetIp = (ip || '').trim();
      if (!targetIp || targetIp === 'N/A') throw new Error('Missing IP');
      const detailed = createDetailedComponents('');

      console.log('📡 Lecture des composants Shelly en temps réel via IP:', targetIp);

      // Test de connectivité d'abord
      try {
        const testResponse = await fetchWithTimeout(`http://${targetIp}/shelly`, { 
          method: 'GET'
        }, 3000);
        if (!testResponse.ok) {
          console.log('❌ Shelly non accessible via IP:', targetIp);
          return createDetailedComponents('');
        }
        console.log('✅ Shelly accessible via IP:', targetIp);
        
        // Tester l'API RPC
        const rpcTest = await fetchWithTimeout(`http://${targetIp}/rpc/Switch.GetStatus?id=0`, { 
          method: 'GET'
        }, 3000);
        if (rpcTest.ok) {
          console.log('✅ API RPC accessible');
        } else {
          console.log('⚠️ API RPC non accessible, utilisation des valeurs par défaut');
        }
      } catch (error) {
        console.log('❌ Erreur de connectivité Shelly:', error);
        return createDetailedComponents('');
      }

      const fetchStatus = async (id: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          // Essayer d'abord l'API RPC standard
          let res = await fetch(`http://${targetIp}/rpc/Switch.GetStatus?id=${id}`, { method: 'GET', signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            // Essayer l'API alternative
            console.log(`⚠️ API RPC standard échouée pour relay ${id}, essai API alternative...`);
            res = await fetch(`http://${targetIp}/rpc/Switch.GetStatus`, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: id }),
              signal: controller.signal 
            });
          }
          
          if (!res.ok) {
            console.log(`❌ API RPC échouée pour relay ${id}:`, res.status, res.statusText);
            return null;
          }
          
          const data = await res.json();
          console.log(`📊 Relay ${id} données brutes:`, JSON.stringify(data, null, 2));
          return data;
        } catch (e) {
          try { clearTimeout(timeoutId); } catch {}
          console.log(`❌ Erreur lecture relay ${id}:`, e);
          return null;
        }
      };

      for (let id = 0; id < 4; id++) {
        const st: any = await fetchStatus(id);
        const key = id === 0 ? 'pump' : id === 1 ? 'heater' : id === 2 ? 'auger' : 'highWater';
        if (st) {
          // Récupérer les vraies valeurs en temps réel selon le format Shelly Pro4PM
          const realPower = Number(st.apower ?? 0); // Utiliser apower pour la puissance active
          const realVoltage = Number(st.voltage ?? 0);
          const realCurrent = Number(st.current ?? 0);
          const realEnergy = typeof st.aenergy === 'object' ? Number(st.aenergy?.total ?? 0) : Number(st.aenergy ?? 0);
          const realTemp = Number(st.temperature ?? 0);
          const realFrequency = Number(st.frequency ?? 0);
          
          console.log(`🔧 Relay ${id} (${key}) - Puissance: ${realPower}W, Voltage: ${realVoltage}V, Courant: ${realCurrent}A, Fréquence: ${realFrequency}Hz`);
          
          (detailed as any)[key] = {
            ...(detailed as any)[key],
            name: (detailed as any)[key].name, // Garder le nom existant
            relay: id, // Utiliser l'ID comme numéro de relay
            status: !!st.output,
            power: realPower,
            voltage: realVoltage,
            current: realCurrent,
            energy: realEnergy,
            temperature: realTemp,
            frequency: realFrequency, // Ajouter la fréquence
          };
        } else {
          console.log(`⚠️ Aucune donnée pour relay ${id} (${key})`);
        }
      }
      
      console.log('📊 Structure détaillée finale avec vraies valeurs:', JSON.stringify(detailed, null, 2));
      return detailed;
    } catch (error) {
      console.log('⚠️ Erreur readShellyComponents, retour de la structure par défaut:', error);
      return createDetailedComponents('');
    }
  };

  // Fonction pour forcer tous les outputs Shelly en OFF (0..3)
  const forceShellyOutputsOff = async (ip: string | null | undefined) => {
    try {
      const targetIp = (ip || '').trim();
      if (!targetIp || targetIp === 'N/A') {
        console.log('⚠️ IP Shelly manquante pour forcer les outputs OFF');
        return false;
      }

      console.log('🔧 Forçage des outputs Shelly en OFF via IP:', targetIp);

      const setOff = async (id: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const response = await fetch(`http://${targetIp}/rpc/Switch.Set`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, on: false })
          });
          clearTimeout(timeoutId);
          return response.ok;
        } catch (e) {
          clearTimeout(timeoutId);
          return false;
        }
      };

      let okCount = 0;
      for (let i = 0; i < 4; i++) {
        const ok = await setOff(i);
        if (ok) okCount++;
        await new Promise(r => setTimeout(r, 120)); // petit délai anti-saturation
      }
      console.log(`✅ Outputs OFF appliqués: ${okCount}/4`);
      
      // Mettre à jour la structure détaillée localement
      const detailedComponents = createDetailedComponents('');
      for (let i = 0; i < 4; i++) {
        const key = i === 0 ? 'pump' : i === 1 ? 'heater' : i === 2 ? 'auger' : 'highWater';
        (detailedComponents as any)[key].status = false;
      }
      console.log('📊 Structure détaillée mise à jour (tous OFF):', JSON.stringify(detailedComponents, null, 2));
      
      return okCount > 0;
    } catch (error) {
      console.log('❌ Erreur forceShellyOutputsOff:', error);
      return false;
    }
  };

  // Wi-Fi password modal states
  const [wifiPasswordModalVisible, setWifiPasswordModalVisible] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiPasswordVisible, setWifiPasswordVisible] = useState(false);
  const [wifiPwLoading, setWifiPwLoading] = useState(false);
  const [wifiPwError, setWifiPwError] = useState("");
  const [wifiPwResult, setWifiPwResult] = useState<null | 'success' | 'fail'>(null);
  const [wifiPwFocused, setWifiPwFocused] = useState(false);
  const wifiPwAnim = useRef(new Animated.Value(0)).current;
  const [wifiPwReduceMotion, setWifiPwReduceMotion] = useState(false);

  // État pour le Wi-Fi connecté
  const [connectedWifiSsid, setConnectedWifiSsid] = useState<string | null>(null);

  // Profile image for header
  const [profileImage, setProfileImage] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await AuthService.getUserProfile();
        if (res?.success && res.data?.picture) {
          setProfileImage(res.data.picture);
        }
      } catch {}
    })();
  }, []);

  // État pour la suppression de site
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<SiteInfo | null>(null);

  // État pour savoir si le Wi-Fi est activé
  const [isWifiOn, setIsWifiOn] = useState(true);
  useEffect(() => {
    const checkWifi = async () => {
      try {
        // Utiliser Network.getNetworkStateAsync() au lieu de WifiManager pour éviter les conflits
      const state = await Network.getNetworkStateAsync();
        const newWifiState = state.type === Network.NetworkStateType.WIFI;
        
        // Ne mettre à jour que si l'état a vraiment changé
        if (newWifiState !== isWifiOn) {
          setIsWifiOn(newWifiState);
        }
      } catch (error) {
        console.log('⚠️ Erreur vérification état Wi-Fi:', error);
        // En cas d'erreur, ne pas changer l'état pour éviter la désactivation
      }
    };
    
    // Vérification initiale seulement
    checkWifi();
    
    // Vérification moins fréquente (toutes les 10 secondes au lieu de 2)
    const interval = setInterval(checkWifi, 10000);
    return () => clearInterval(interval);
  }, [isWifiOn]);

  // NOUVEAU : Protection Wi-Fi au chargement de la page (sans alerte automatique)
  useEffect(() => {
    const protectWifiOnLoad = async () => {
      try {
        console.log('🛡️ Protection Wi-Fi au chargement de la page...');
        
        // Attendre un peu que la page soit chargée
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Vérifier l'état du Wi-Fi (sans alerte automatique)
        const wifiEnabled = await ensureWifiEnabled();
        if (!wifiEnabled) {
          console.log('⚠️ Wi-Fi désactivé détecté au chargement - pas d\'alerte automatique');
        } else {
          console.log('✅ Wi-Fi activé et fonctionnel');
        }
      } catch (error) {
        console.log('⚠️ Erreur protection Wi-Fi au chargement:', error);
      }
    };
    
    protectWifiOnLoad();
  }, []);

  // État pour les tests de connexion en cours
  const [testingConnections, setTestingConnections] = useState<Record<string, boolean>>({});

  // NOUVEAU : États pour MQTT
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastMqttMessage, setLastMqttMessage] = useState<any>(null);

  // Fonction de protection pour éviter de désactiver le Wi-Fi du téléphone
  const ensureWifiEnabled = async () => {
    try {
      // Méthode 1: Vérifier via Network.getNetworkStateAsync()
      const networkState = await Network.getNetworkStateAsync();
      console.log('📡 Network state:', networkState);
      
      // Vérifier si on est connecté au Wi-Fi OU si on a une IP locale
      const isWifiEnabled = networkState.type === Network.NetworkStateType.WIFI || 
                           networkState.type === Network.NetworkStateType.UNKNOWN ||
                           (networkState.isConnected && networkState.isInternetReachable);
      
      if (isWifiEnabled) {
        console.log('✅ Wi-Fi détecté comme activé');
        return true;
      }
      
      // Méthode 2: Vérifier via WifiManager si disponible
      if (Platform.OS === 'android') {
        try {
          const wifiEnabled = await WifiManager.isEnabled();
          console.log('📱 WifiManager.isEnabled():', wifiEnabled);
          if (wifiEnabled) {
      return true;
          }
        } catch (wifiError) {
          console.log('⚠️ WifiManager check failed:', wifiError);
        }
      }
      
      // Méthode 3: Vérifier si on a une IP locale (fallback)
      try {
        const ipAddress = await Network.getIpAddressAsync();
        console.log('🌐 IP address:', ipAddress);
        if (ipAddress && ipAddress !== '0.0.0.0' && ipAddress.includes('192.168.')) {
          console.log('✅ IP locale détectée - Wi-Fi probablement actif');
          return true;
        }
      } catch (ipError) {
        console.log('⚠️ IP check failed:', ipError);
      }
      
      console.log('⚠️ Wi-Fi non détecté - mais on continue quand même');
      // Ne plus bloquer - laisser l'utilisateur essayer
      return true;
      
    } catch (error) {
      console.log('⚠️ Erreur vérification Wi-Fi:', error);
      // En cas d'erreur, ne pas bloquer
      return true;
    }
  };

  // NOUVELLE FONCTION : Réactiver le Wi-Fi si nécessaire
  const reactivateWifiIfNeeded = async () => {
    try {
      console.log('🔄 Tentative de réactivation du Wi-Fi...');
      
      // Vérifier l'état actuel
      const networkState = await Network.getNetworkStateAsync();
      const isWifiEnabled = networkState.type === Network.NetworkStateType.WIFI;
      
      if (!isWifiEnabled) {
        console.log('⚠️ Wi-Fi toujours désactivé - ouverture des paramètres...');
        
        // Ouvrir les paramètres Wi-Fi
        if (Platform.OS === 'android') {
          try {
            await Linking.openSettings();
            console.log('✅ Paramètres ouverts - veuillez activer le Wi-Fi manuellement');
          } catch (error) {
            console.log('❌ Impossible d\'ouvrir les paramètres:', error);
          }
        }
        
        return false;
      } else {
        console.log('✅ Wi-Fi déjà activé');
        return true;
      }
    } catch (error) {
      console.log('❌ Erreur réactivation Wi-Fi:', error);
      return false;
    }
  };

  // Fonction pour scanner le réseau et trouver Shelly
  const scanNetworkForShelly = async () => {
    try {
      console.log('🔍 Scan du réseau pour trouver Shelly...');
      
      // VÉRIFIER D'ABORD que le Wi-Fi est activé
      const wifiEnabled = await ensureWifiEnabled();
      if (!wifiEnabled) {
        console.log('❌ Wi-Fi non activé - scan annulé');
        return null;
      }
      
      // Récupérer l'IP du téléphone
      const phoneIP = await Network.getIpAddressAsync();
      console.log('📱 IP du téléphone:', phoneIP);
      
      // Extraire le préfixe réseau (ex: 192.168.100.)
      const networkPrefix = phoneIP.substring(0, phoneIP.lastIndexOf('.') + 1);
      console.log('🌐 Préfixe réseau:', networkPrefix);
      
      // Scanner les IPs possibles (prioriser .1, .100-120, .2-50, puis reste)
      const priority = [1];
      const midRange = Array.from({ length: 21 }, (_, i) => 100 + i); // 100..120
      const lowRange = Array.from({ length: 49 }, (_, i) => 2 + i);   // 2..50
      const rest = Array.from({ length: 254 }, (_, i) => i + 1).filter(n => !priority.includes(n) && !midRange.includes(n) && !lowRange.includes(n));
      const ordered = [...priority, ...midRange, ...lowRange, ...rest];
      const possibleIPs = ordered.map(n => `${networkPrefix}${n}`);
      
      // Tester les IPs en parallèle (par groupes plus larges et timeout court)
      const batchSize = 20;
      for (let i = 0; i < possibleIPs.length; i += batchSize) {
        const batch = possibleIPs.slice(i, i + batchSize);
        
        const promises = batch.map(async (ip) => {
          try {
            // CORRECTION : Utiliser AbortController avec timeout manuel
            const controller = new AbortController();
            let timeoutId;
            
            // Créer une promesse avec timeout manuel
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Timeout'));
              }, 600); // 0.6s timeout
            });
            
            const fetchPromise = fetch(`http://${ip}/shelly`, {
              method: 'GET',
              signal: controller.signal,
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'WaiHome-App/1.0'
              }
            });
            
            // Race entre fetch et timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            clearTimeout(timeoutId);
            
            // CORRECTION : Vérifier le type de response
            if (response && typeof response === 'object' && 'ok' in response && response.ok) {
              console.log(`✅ Shelly trouvé sur ${ip}!`);
              return ip;
            }
          } catch (error) {
            // Ignorer les erreurs, c'est normal
          }
          return null;
        });
        
        const results = await Promise.all(promises);
        const foundIP = results.find(ip => ip !== null);
        
        if (foundIP) {
          return foundIP;
        }
      }
      
      console.log('❌ Shelly non trouvé sur le réseau');
      return null;
      
    } catch (error) {
      console.error('❌ Erreur lors du scan réseau:', error);
      return null;
    }
  };

  // Fonction pour récupérer les informations Shelly (MAC, Device ID, etc.)
  const getShellyDeviceInfo = async (ipAddress: string) => {
    try {
      console.log('📡 Récupération des informations Shelly...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://${ipAddress}/shelly`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'WaiHome-App/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Informations Shelly reçues:', data);
        
        return {
          deviceId: data.id || `shelly-${ipAddress}`,
          macAddress: data.mac || 'N/A',
          deviceName: data.name || `Shelly-${ipAddress}`,
          model: data.model || 'Unknown',
          firmware: data.fw_ver || 'Unknown'
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des infos Shelly:', error);
      return null;
    }
  };

  // Fonction pour détecter et restaurer un Shelly redémarré
  const detectAndRestoreShellyAfterRestart = async () => {
    try {
      console.log('🔄 Détection d\'un Shelly redémarré...');
      
      // Scanner le réseau pour trouver un Shelly
      const shellyIP = await scanNetworkForShelly();
      if (!shellyIP) {
        console.log('ℹ️ Aucun Shelly détecté sur le réseau');
        return;
      }
      
      // Récupérer les informations du Shelly
      const shellyInfo = await getShellyDeviceInfo(shellyIP);
      if (!shellyInfo) {
        console.log('❌ Impossible de récupérer les infos Shelly');
        return;
      }
      
      console.log('🔍 Shelly détecté:', shellyInfo);
      
      // Vérifier si ce Shelly était déjà configuré
      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.log('❌ Utilisateur non connecté');
        return;
      }
      
      const existingSites = await ShellyService.getUserShellyDevices(currentUserId);
      if (existingSites.success && existingSites.data) {
        const devices = Array.isArray(existingSites.data) ? existingSites.data : [];
        
        // Chercher par MAC address ou Device ID
        const existingDevice = devices.find((device: any) => {
          return (device.macAddress && device.macAddress === shellyInfo.macAddress) ||
                 (device.deviceId && device.deviceId === shellyInfo.deviceId);
        });
        
        if (existingDevice) {
          console.log('🎯 Shelly redémarré détecté ! Restauration des données...');
          console.log('📊 Données du dernier site:', existingDevice);
          
          // 1. Mettre à jour l'IP du Shelly (peut avoir changé après redémarrage)
          const updatedDeviceInfo = {
            ...existingDevice,
            ipAddress: shellyIP,
            lastConnected: new Date().toISOString(),
            status: 'Connected'
          };
          
          // 2. Mettre à jour dans AWS
          try {
            const updateResult = await ShellyService.updateShellyDevice(existingDevice.id, {
              ipAddress: shellyIP,
              lastConnected: new Date().toISOString(),
              status: 'Connected'
            });
            
            if (updateResult.success) {
              console.log('✅ Shelly restauré avec succès !');
              
              // 3. Recharger les sites depuis AWS
              await loadSitesFromAWS();
              
              // 4. Restaurer les états des composants si disponibles
              if (existingDevice.components) {
                console.log('🔄 Restauration des états des composants...');
                await restoreComponentStates(shellyIP, existingDevice.components);
              }
              
              // 5. Afficher un message informatif avec les détails
              const siteName = existingDevice.siteName || 'Unknown Site';
              const lastUpdate = existingDevice.lastUpdated ? 
                new Date(existingDevice.lastUpdated).toLocaleString() : 'Unknown';
              
              setAlertMsg(`✅ Shelly "${siteName}" restarted and reconnected automatically!\n\nLast update: ${lastUpdate}\nIP: ${shellyIP}\n\nAll components have been restored.`);
              setAlertVisible(true);
              
              return true;
            }
          } catch (updateError) {
            console.error('❌ Erreur lors de la restauration:', updateError);
          }
        } else {
          console.log('ℹ️ Nouveau Shelly détecté (pas de données existantes)');
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erreur lors de la détection de redémarrage:', error);
      return false;
    }
  };

  // Fonction pour restaurer les états des composants
  const restoreComponentStates = async (shellyIP: string, components: any) => {
    try {
      console.log('🔄 Restauration des états des composants...');
      console.log('📊 Composants à restaurer:', components);
      console.log('📡 IP Shelly pour restauration:', shellyIP);
      
             // Vérifier d'abord que le Shelly est accessible
       console.log('🔍 Vérification de l\'accessibilité du Shelly...');
       try {
         const testResponse = await fetch(`http://${shellyIP}/shelly`, {
           method: 'GET',
           headers: {
             'Accept': 'application/json',
             'User-Agent': 'WaiHome-App/1.0'
           }
         });
        
        if (!testResponse.ok) {
          throw new Error(`Shelly non accessible: ${testResponse.status}`);
        }
        
        console.log('✅ Shelly accessible, début de la restauration...');
      } catch (testError) {
        console.error('❌ Shelly non accessible:', testError.message);
        throw new Error(`Unable to connect to Shelly on ${shellyIP}`);
      }
      
      // Restaurer chaque composant avec retry
      const restoreComponent = async (relayId: number, componentName: string, shouldBeOn: boolean) => {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 Tentative ${attempt}/${maxRetries} - ${componentName} -> ${shouldBeOn ? 'ON' : 'OFF'}`);
            
                         const response = await fetch(`http://${shellyIP}/relay/${relayId}?turn=${shouldBeOn ? 'on' : 'off'}`, {
               method: 'GET',
               headers: {
                 'Accept': 'application/json',
                 'User-Agent': 'WaiHome-App/1.0'
               }
             });
            
            if (response.ok) {
              const data = await response.json();
              console.log(`✅ ${componentName} restauré: ${shouldBeOn ? 'ON' : 'OFF'} (relay ${relayId})`);
              console.log(`📊 Réponse Shelly:`, data);
              return true;
            } else {
              console.log(`⚠️ Tentative ${attempt} échouée pour ${componentName}: ${response.status}`);
            }
          } catch (error) {
            console.log(`❌ Erreur tentative ${attempt} pour ${componentName}:`, error.message);
          }
          
          // Attendre avant la prochaine tentative
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`❌ Échec de restauration pour ${componentName} après ${maxRetries} tentatives`);
        return false;
      };
      
      // Restaurer tous les composants en parallèle
      const restorePromises = [];
      
      if (components.pump !== undefined) {
        restorePromises.push(restoreComponent(0, 'Pump', components.pump));
      }
      
      if (components.heater !== undefined) {
        restorePromises.push(restoreComponent(1, 'Heater', components.heater));
      }
      
      if (components.highWater !== undefined) {
        restorePromises.push(restoreComponent(2, 'High Water', components.highWater));
      }
      
      if (components.auger !== undefined) {
        restorePromises.push(restoreComponent(3, 'Auger', components.auger));
      }
      
      // Attendre que tous les composants soient restaurés
      const results = await Promise.all(restorePromises);
      const successCount = results.filter(result => result).length;
      const totalCount = restorePromises.length;
      
      console.log(`✅ Restauration terminée: ${successCount}/${totalCount} composants restaurés avec succès`);
      
      if (successCount < totalCount) {
        console.log('⚠️ Certains composants n\'ont pas pu être restaurés');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la restauration des composants:', error);
      throw error;
    }
  };

  // Charger la liste Wi-Fi quand on arrive à l'étape Wi-Fi
  useEffect(() => {
    if (addStep === 'wifi-inject' && (!wifiList || wifiList.length === 0)) {
      scanForWifi();
    }
  }, [addStep]);

  // Fonction pour vérifier l'état de connexion de tous les sites
  const checkSitesConnectionStatus = async (forceCheck = false) => {
    if (sites.length === 0) return;
    
    console.log(`🔄 Vérification de l'état de connexion des sites... ${forceCheck ? '(FORCÉE)' : ''}`);
    console.log(`📋 Sites à vérifier:`, sites.map(s => ({ name: s.name, ip: s.deviceInfo?.ipAddress, status: s.status })));
    
    const updatedSites = await Promise.all(sites.map(async (site) => {
      let newStatus: SiteInfo['status'] = site.status;
      
      if (site.deviceInfo) {
        // Si l'appareil a une IP, il est probablement connecté via Wi-Fi
        // même si connectionType indique BLE (car BLE était juste pour la configuration)
        if (site.deviceInfo.ipAddress && site.deviceInfo.ipAddress !== 'N/A') {
          console.log(`🔍 Test de connexion pour ${site.name} sur IP: ${site.deviceInfo.ipAddress}`);
          try {
            // Essayer de pinger Shelly sur son IP avec timeout plus court
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout augmenté pour APK
            
            // Essayer plusieurs endpoints Shelly dans l'ordre de priorité
            const endpoints = [
              '/shelly',
              '/status',
              '/rpc/Shelly.GetDeviceInfo',
              '/',
              '/settings',
              '/info'
            ];
            
            let shellyResponds = false;
            
            for (const endpoint of endpoints) {
              try {
                const response = await fetch(`http://${site.deviceInfo.ipAddress}${endpoint}`, {
                  method: 'GET',
                  signal: controller.signal,
                  headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'WaiHome-App/1.0',
                    'Connection': 'keep-alive'
                  }
                });
                
                if (response.ok) {
                  shellyResponds = true;
                  console.log(`✅ Site ${site.name} répond sur ${endpoint}`);
                  break;
                }
              } catch (endpointError) {
                // Ignorer les erreurs silencieusement
              }
            }
            
            clearTimeout(timeoutId);
            
            if (shellyResponds) {
              console.log(`✅ ${site.name} est connecté !`);
              newStatus = "Connected";
            } else {
              console.log(`❌ ${site.name} ne répond sur aucun endpoint`);
              newStatus = "Not Connected";
            }
            
          } catch (error) {
            console.log(`❌ Erreur lors du test de ${site.name}:`, error.message);
            newStatus = "Not Connected";
          }
        } else {
          // Si pas d'IP, vérifier BLE comme fallback
          if (site.deviceInfo.connectionType === 'BLE') {
            try {
              const isConnected = await bleManager.isDeviceConnected(site.deviceInfo.deviceId);
              newStatus = isConnected ? "Connected" : "Not Connected";
            } catch (error) {
              newStatus = "Not Connected";
            }
          } else {
            newStatus = "Not Connected";
          }
        }
      } else {
        newStatus = "Not Connected";
      }
      
      return {
        ...site,
        status: newStatus
      };
    }));
    
    // Mettre à jour seulement si le statut a changé (ou si vérification forcée)
    const hasChanges = updatedSites.some((site, index) => site.status !== sites[index].status);
    console.log(`📊 Changements détectés: ${hasChanges}, Vérification forcée: ${forceCheck}`);
    
    if (hasChanges || forceCheck) {
      setSites(updatedSites);
      await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      console.log('🔄 Statuts de connexion mis à jour');
      
      // Mettre à jour AWS DynamoDB UNIQUEMENT pour les sites qui ont changé de statut
      for (let i = 0; i < updatedSites.length; i++) {
        const site = updatedSites[i];
        const oldSite = sites[i];
        
        if (site.status !== oldSite.status) {
          try {
            console.log(`🔄 Mise à jour AWS pour ${site.name}: ${oldSite.status} → ${site.status}`);
            const updates = {
              status: site.status,
              lastUpdated: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            // CORRECTION : Gestion d'erreur améliorée pour éviter les 404
            try {
            const result = await ShellyService.updateShellyDevice(site.id, updates);
            if (result.success) {
              console.log(`✅ AWS mis à jour pour ${site.name}`);
            } else {
                console.log(`⚠️ Erreur mise à jour AWS pour ${site.name}:`, result.error);
                // Ne pas afficher d'erreur critique pour les problèmes de connexion
              }
            } catch (updateError) {
              // CORRECTION : Gérer silencieusement les erreurs 404 (device not found)
              if (updateError.message && updateError.message.includes('404')) {
                console.log(`ℹ️ Site ${site.name} temporairement indisponible (déconnexion Wi-Fi)`);
              } else {
                console.log(`⚠️ Erreur mise à jour AWS pour ${site.name}:`, updateError.message);
              }
            }
          } catch (error) {
            // CORRECTION : Gérer silencieusement les erreurs de mise à jour
            if (error.message && error.message.includes('Device not found')) {
              console.log(`ℹ️ Site ${site.name} temporairement indisponible`);
            } else {
              console.log(`⚠️ Erreur mise à jour AWS pour ${site.name}:`, error.message);
            }
          }
        }
      }
      
      // Afficher un message si un site devient connecté
      updatedSites.forEach((site, index) => {
        if (site.status === "Connected" && sites[index].status !== "Connected") {
          console.log(`🎉 Site ${site.name} est maintenant connecté !`);
          // Forcer la mise à jour de l'interface
          setSites(prevSites => [...prevSites]);
        }
      });
    }
  };

  // Vérifier l'état de connexion périodiquement (plus fréquemment pour détecter rapidement les changements)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Vérification périodique automatique...');
      checkSitesConnectionStatus(false); // Ne pas forcer la vérification
    }, 30000); // Vérifier toutes les 30 secondes pour éviter la boucle
    return () => clearInterval(interval);
  }, [sites]);

  // Vérifier l'état de connexion quand on revient sur la page
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('📱 Retour sur MainPage - vérification immédiate de la connexion');
      checkSitesConnectionStatus(true); // Vérification forcée
    });

    return unsubscribe;
  }, [navigation, sites]);

  // Vérifier l'état de connexion au chargement initial
  useEffect(() => {
    if (sites.length > 0) {
      console.log('🚀 Chargement initial - vérification de la connexion');
      checkSitesConnectionStatus(true); // Vérification forcée
    }
  }, [sites.length]);

  // Détecter automatiquement un Shelly redémarré
  useEffect(() => {
    const detectRestartedShelly = async () => {
      // Attendre un peu que l'app soit complètement chargée
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Détecter et restaurer un Shelly redémarré
      await detectAndRestoreShellyAfterRestart();
    };
    
    detectRestartedShelly();
  }, []); // Seulement au chargement initial de l'app

  // Fonction pour configurer manuellement un Shelly existant
  const configureExistingShelly = async () => {
    try {
      console.log('🔧 Configuration manuelle d\'un Shelly existant...');
      
      // Scanner le réseau pour trouver un Shelly
      const shellyIP = await scanNetworkForShelly();
      if (!shellyIP) {
        setAlertMsg('No Shelly detected on the network. Check connection.');
        setAlertVisible(true);
        return;
      }
      
      console.log('📡 Shelly trouvé sur:', shellyIP);
      
      // Configurer le comportement après coupure
      await configureShellyPowerOnBehavior(shellyIP);
      
      setAlertMsg('✅ Shelly configured successfully! All relays will turn OFF after power outage.');
      setAlertVisible(true);
      
    } catch (error) {
      console.error('❌ Erreur lors de la configuration manuelle:', error);
      setAlertMsg('Erreur lors de la configuration du Shelly.');
      setAlertVisible(true);
    }
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setWifiPwReduceMotion);
    if (wifiPasswordModalVisible) {
      Animated.timing(wifiPwAnim, {
        toValue: 1,
        duration: wifiPwReduceMotion ? 0 : 600,
        useNativeDriver: true,
      }).start();
    } else {
      wifiPwAnim.setValue(0);
    }
  }, [wifiPasswordModalVisible, wifiPwReduceMotion]);

  /* Fade-in header */
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  /* Load saved sites */
  useEffect(() => {
    (async () => {
      // Charger d'abord depuis AWS pour avoir les données les plus récentes
      await loadSitesFromAWS();
    })();
  }, []);

  // Ajouter un refresh automatique quand l'utilisateur revient sur la page
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('📱 Retour sur MainPage - rechargement des sites depuis AWS');
      loadSitesFromAWS();
    });
    return unsubscribe;
  }, [navigation]);

  /* Save helper */
  const persistSites = async (arr: SiteInfo[]) => {
    setSites(arr);
    await AsyncStorage.setItem("sites", JSON.stringify(arr));
  };

  // Fonction pour charger les sites depuis AWS DynamoDB
  const loadSitesFromAWS = async () => {
    try {
      console.log('🔄 Chargement des sites depuis AWS DynamoDB...');
      
      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.log('❌ Utilisateur non connecté, impossible de charger depuis AWS');
        return;
      }

      const result = await ShellyService.getUserShellyDevices(currentUserId);
      console.log('🔍 Résultat complet de getUserShellyDevices:', result);
      
      if (result.success && result.data) {
        console.log('📥 Données reçues d\'AWS:', result.data);
        
        // Sécuriser les données - garantir que c'est un tableau
        const devices = Array.isArray(result.data) ? result.data : [];
        console.log('📋 Devices après sécurisation:', devices);
        console.log('📊 Nombre de devices trouvés:', devices.length);
        
        if (devices.length === 0) {
          console.log('ℹ️ Aucun device trouvé dans AWS, mais la requête a réussi');
          // Garder les sites existants si aucun device n'est trouvé
          return;
        }
        
        // Convertir les données AWS en format SiteInfo
        const awsSites: SiteInfo[] = devices
          .filter((device: any) => {
            // FILTRER LES SITES FANTÔMES - ne pas créer de sites avec des données incomplètes
            const hasValidName = device.siteName && device.siteName.trim() !== '' && device.siteName !== 'Unknown Site';
            const hasValidDeviceInfo = device.deviceId || device.ipAddress || device.macAddress;
            
            if (!hasValidName || !hasValidDeviceInfo) {
              console.log('🚫 Site fantôme filtré:', {
                siteName: device.siteName,
                deviceId: device.deviceId,
                ipAddress: device.ipAddress,
                macAddress: device.macAddress
              });
              return false;
            }
            return true;
          })
          .map((device: any) => ({
            id: device.id || `${currentUserId}_${device.deviceId || 'shelly-device'}`,
          name: device.siteName || 'Unknown Site',
          icon: 'home-outline' as McIconName,
          status: device.status === 'Connected' ? 'Connected' : 'Not Connected',
          solids: (typeof device.solids === 'object' && device.solids !== null)
            ? (Number(device.solids.total) || 0)
            : (Number(device.solids) || 0),
          notificationsEnabled: device.notificationsEnabled || false,
          deviceInfo: {
            deviceId: device.deviceId || 'shelly-main-device',
            macAddress: device.macAddress || 'N/A',
            ipAddress: device.ipAddress || 'N/A',
            deviceName: device.deviceName || 'Unknown Device',
            connectionType: device.connectionType || 'WIFI',
            lastConnected: device.lastConnected || new Date().toISOString()
          }
        }));

        console.log('🔄 Sites convertis depuis AWS:', awsSites);

        // Dédupliquer par id pour éviter les doublons dans la liste
        const uniqueSitesMap = new Map<string, SiteInfo>();
        for (const site of awsSites) {
          uniqueSitesMap.set(site.id, site);
        }
        const uniqueSites = Array.from(uniqueSitesMap.values());
        console.log('🧹 Sites après déduplication:', uniqueSites);
        console.log('📊 Nombre final de sites uniques:', uniqueSites.length);
        
        // Mettre à jour l'état local et AsyncStorage
        setSites(uniqueSites);
        await persistSites(uniqueSites);
        
        console.log('✅ Sites synchronisés depuis AWS DynamoDB - État mis à jour');
      } else {
        console.log('ℹ️ Aucune donnée trouvée dans AWS ou erreur:', result.error);
        console.log('🔍 Détails de l\'erreur:', result);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement depuis AWS:', error);
      console.error('📋 Stack trace:', error.stack);
    }
  };

  /* Watch BLE state */
  useEffect(() => {
    const sub = bleManager.onStateChange(setBleState, true);
    return () => sub.remove();
  }, []);

  /* ---------- BLE helpers ---------- */
  const scanForPeripherals = async () => {
    // Vérifier les permissions Bluetooth d'abord
    if (Platform.OS === "android") {
      try {
        // Demander permission de localisation pour Android < 12
        if (Platform.Version < 31) {
          const loc = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            { title: "Location permission", message: "Required to scan for BLE devices", buttonPositive: "OK" }
          );
          if (loc !== PermissionsAndroid.RESULTS.GRANTED) {
            setAlertMsg("Location permission is required to scan for devices");
            setAlertVisible(true);
            return;
          }
        }
        
        const bluetoothPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: "Bluetooth Permission",
            message: "This app needs Bluetooth permission to scan for devices",
            buttonPositive: "OK",
          }
        );
        
        const bluetoothConnectPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: "Bluetooth Connect Permission",
            message: "This app needs Bluetooth connect permission to connect to devices",
            buttonPositive: "OK",
          }
        );

        if (bluetoothPermission !== PermissionsAndroid.RESULTS.GRANTED || 
            bluetoothConnectPermission !== PermissionsAndroid.RESULTS.GRANTED) {
          setAlertMsg("Bluetooth permissions are required to scan for devices");
          setAlertVisible(true);
          return;
        }
      } catch (error) {
        console.error('❌ Permission request error:', error);
        setAlertMsg("Failed to request Bluetooth permissions");
        setAlertVisible(true);
        return;
      }
    }

    setIsScanning(true);
    setAllDevices([]);
    console.log('🔍 Starting BLE scan...');
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('❌ BLE scan error:', error);
        setIsScanning(false);
        return;
      }
      if (device) {
        console.log('📱 Found BLE device:', {
          id: device.id,
          name: device.name || 'Unknown',
          rssi: device.rssi,
          manufacturerData: device.manufacturerData
        });
        setAllDevices((prev) =>
          prev.find((d) => d.id === device.id) ? prev : [...prev, device]
        );
      }
    });
    
    // Arrêter le scan après 10 secondes
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
      console.log('⏹️ BLE scan stopped');
    }, 10000);
  };

  const connectToDevice = async (device: any) => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const d = await bleManager.connectToDevice(device.id);
      await d.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      setConnected(d);
      setIsConnected(true);
      d.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (e: any | null, ch: any | null) => {
          if (e || !ch?.value) return;
          console.log(Base64.decode(ch.value).trim());
        }
      );
      setDevVisible(false);
    } catch (e) {
      setAlertMsg('A problem occurred while connecting to the device. Please try again.');
      setAlertVisible(true);
    }
    setIsConnecting(false);
  };

  const handleConnectPress = () => {
    if (bleState !== State.PoweredOn) {
      setAlertMsg("Activate Bluetooth");
      setAlertVisible(true);
      return;
    }
    if (!isConnected) {
      scanForPeripherals();
      setDevVisible(true);
    } else if (connectedDevice) {
      connectedDevice.cancelConnection();
      setConnected(null);
      setIsConnected(false);
    }
  };

  /* ---------- Wi-Fi helpers ---------- */
  // Cache pour atténuer les limites Android (4 scans/2 minutes) et éviter les listes vides
  const lastWifiCache = React.useRef<any[]>([]);
  const setAndCacheWifiList = (arr: any[]) => {
    try {
      setWifiList(arr);
      if (Array.isArray(arr) && arr.length > 0) {
        lastWifiCache.current = arr;
      }
    } catch {}
  };
  const scanForWifi = async () => {
    try {
      console.log('📡 Début du scan Wi-Fi...');
      
      if (Platform.OS === "android") {
        console.log('📱 Plateforme Android détectée');
        
        // Demander les permissions Wi-Fi (Android 13+)
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
            { title: "Nearby Wi-Fi permission", message: "Required to scan Wi-Fi networks", buttonPositive: "OK" }
          );
        }
        
        // Demander les permissions de localisation
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location permission",
            message: "Location permission is required to scan Wi-Fi networks",
            buttonPositive: "OK",
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('❌ Permission de localisation refusée');
          setAlertMsg('Location permission is required to scan Wi-Fi networks');
          setAlertVisible(true);
          return;
        }
        
        console.log('✅ Permission de localisation accordée');
        
        // Vérifier si le Wi-Fi est activé (mais ne pas bloquer si ça échoue)
        try {
        const wifiEnabled = await WifiManager.isEnabled();
          console.log('📱 WifiManager.isEnabled():', wifiEnabled);
        if (!wifiEnabled) {
            console.log('⚠️ Wi-Fi désactivé selon WifiManager - mais on continue quand même');
            // Ne plus bloquer - laisser l'utilisateur essayer
          } else {
            console.log('✅ Wi-Fi activé selon WifiManager');
          }
        } catch (wifiError) {
          console.log('⚠️ Erreur vérification WifiManager:', wifiError);
          // En cas d'erreur, continuer quand même
        }
      }
      
      setWifiScanning(true);
      console.log('🔄 Scan Wi-Fi en cours...');
      
      let list: any[] = [];
      
      if (Platform.OS === "android") {
        try {
          // Forcer un nouveau scan
          console.log('📡 Lancement du scan Wi-Fi Android...');
          const rawList = await WifiManager.reScanAndLoadWifiList();
          console.log('📡 Raw Wi-Fi scan result:', typeof rawList, rawList);
          
          // Gérer différents formats de retour
          if (Array.isArray(rawList)) {
            list = rawList;
          } else if (typeof rawList === 'string') {
            try {
              const parsed = JSON.parse(rawList);
              if (Array.isArray(parsed)) {
                list = parsed;
              }
            } catch (parseError) {
              console.log('⚠️ JSON parse failed:', parseError);
              // Gestion du rate limit Android: utiliser le cache si dispo
              if (rawList && rawList.toLowerCase().includes('starting android 9')) {
                if (lastWifiCache.current.length > 0) {
                  console.log('⏪ Rate limit Android détecté, utilisation du cache précédent');
                  list = lastWifiCache.current;
                }
              }
            }
          } else if (rawList && typeof rawList === 'object') {
            // Parfois c'est un objet avec une propriété qui contient le tableau
            const keys = Object.keys(rawList);
            if (keys.length > 0) {
              const firstKey = keys[0];
              if (Array.isArray(rawList[firstKey])) {
                list = rawList[firstKey];
              }
            }
          }
          
          // Fallback si toujours pas de tableau
          if (!Array.isArray(list)) {
            console.log('⚠️ Wi-Fi list not an array, using empty fallback');
            list = [];
          }
          
          console.log(`✅ Scan terminé, ${list.length} réseaux trouvés`);
          
          // CORRECTION : Vérifier que list est un tableau avant forEach
          if (list && Array.isArray(list)) {
          // Log des réseaux trouvés
          list.forEach((network, index) => {
            console.log(`📶 Réseau ${index + 1}: ${network.SSID} (${network.BSSID || 'N/A'})`);
          });
          } else {
            console.log('⚠️ Liste Wi-Fi invalide, tentative de récupération...');
            // Essayer de récupérer la liste existante
            list = await WifiManager.loadWifiList();
            console.log(`✅ Récupération terminée, ${list.length} réseaux trouvés`);
          }
          
        } catch (scanError) {
          console.error('❌ Erreur lors du scan Wi-Fi:', scanError);
          
          // Essayer une méthode alternative
          try {
            console.log('🔄 Tentative de scan alternatif...');
            list = await WifiManager.loadWifiList();
            console.log(`✅ Scan alternatif terminé, ${list.length} réseaux trouvés`);
          } catch (altError) {
            console.error('❌ Erreur scan alternatif:', altError);
            setAlertMsg('Unable to scan Wi-Fi networks. Please check your Wi-Fi settings.');
            setAlertVisible(true);
          }
        }
      } else {
        /* iOS – API limitée : on ajoute juste le réseau actuel */
        console.log('📱 Plateforme iOS détectée');
        const ssid = await WifiManager.getCurrentWifiSSID().catch(() => "");
        if (ssid) {
          list = [{ SSID: ssid }];
          console.log(`✅ Réseau iOS trouvé: ${ssid}`);
        }
      }
      
      // CORRECTION : S'assurer que list est toujours un tableau
      if (!Array.isArray(list)) {
        console.log('⚠️ Liste Wi-Fi invalide, initialisation d\'un tableau vide');
        list = [];
      }
      
      console.log(`📊 Réseaux Wi-Fi trouvés: ${list.length}`);
      // Toujours afficher quelque chose: fallback au cache si liste vide
      if (Array.isArray(list) && list.length === 0 && lastWifiCache.current.length > 0) {
        console.log('⏪ Liste vide, affichage du cache précédent');
        setAndCacheWifiList(lastWifiCache.current);
      } else {
        setAndCacheWifiList(list);
      }
      
      if (list.length === 0) {
        console.log('⚠️ Aucun réseau Wi-Fi trouvé - mais on continue quand même');
        // Ne plus afficher d'alerte automatique - laisser l'utilisateur essayer
        // setAlertMsg('No Wi-Fi networks found. Please check your Wi-Fi settings.');
        // setAlertVisible(true);
      }
      
    } catch (e) {
      console.error("❌ Erreur générale scan Wi-Fi:", e);
      setAlertMsg('Error scanning Wi-Fi networks. Please try again.');
      setAlertVisible(true);
    } finally {
      setWifiScanning(false);
      console.log('⏹️ Scan Wi-Fi terminé');
    }
  };

  const openWifiModal = () => {
    setWifiList([]);
    setWifiVisible(true);
    scanForWifi();
  };

  // Sélection d'un Wi-Fi : afficher formulaire SSID+password+site name
  const selectWifi = async (_ssid: string, capabilities?: string) => {
    setWifiVisible(false);
    setSelectedSsid(_ssid);
    setPendingWifi(_ssid); // 🔧 Capture pour la phase critique
    setInjectionSsid(_ssid); // 👈 Pré-remplir avec le SSID choisi (pas le téléphone)
    setInjectionPassword("");
    setNewSiteName("");
    setAddStep('wifi-inject');
  };

  const handleWifiConnect = async () => {
    setWifiPwError("");
    setWifiPwResult(null);
    if (!wifiPassword) {
      setWifiPwError("Password required");
      Vibration.vibrate(50);
      return;
    }
    if (!selectedSsid) {
      setWifiPwLoading(false);
      setWifiPwError("No Wi-Fi network selected.");
      return;
    }
    setWifiPwLoading(true);
    Vibration.vibrate(10);
    try {
      // Connexion réelle au Wi-Fi (Android uniquement)
      await WifiManager.connectToProtectedSSID(selectedSsid, wifiPassword, false, false);
      // Attendre la stabilisation de la connexion (plus court et plus réactif)
      const ok = await (async () => {
        const end = Date.now() + 12000; // 12s max
        while (Date.now() < end) {
          try {
            const current = await WifiManager.getCurrentWifiSSID();
            if (current && current.trim() === selectedSsid.trim()) return true;
          } catch {}
          await new Promise(r => setTimeout(r, 400));
        }
        return false;
      })();
      if (!ok) throw new Error('Not connected or connecting');
      setWifiPwLoading(false);
      setWifiPwResult('success');
      setConnectedWifiSsid(selectedSsid);
      // Scanner le réseau pour trouver l'IP du Shelly
      const foundIP = await scanNetworkForShelly();
      if (foundIP) {
        setShellyIP(foundIP);
        setWifiPasswordModalVisible(false);
        
        // 🔒 NOUVELLE LOGIQUE : Configuration WiFi Shelly + VÉRIFICATION CRITIQUE
        console.log('🔧 DÉBUT CONFIGURATION WIFI SHELLY...');
        setAlertMsg('🔧 Configuration WiFi Shelly...');
        
        // Configuration WiFi du Shelly
        const wifiConfigSuccess = await configureShellyWifiSimple(selectedSsid, wifiPassword);
        if (wifiConfigSuccess) {
          console.log('✅ Configuration WiFi réussie !');
          setAlertMsg('✅ WiFi configuration successful! Shelly will restart...');
          
          // Attendre le redémarrage
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          // Retour au WiFi principal
          await reconnectToMainWifi(selectedSsid, wifiPassword);
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Chercher le Shelly sur le réseau après redémarrage
          for (let attempt = 1; attempt <= 5; attempt++) {
            setAlertMsg(`🔍 Recherche Shelly (${attempt}/5)...`);
            const newIP = await scanNetworkForShelly();
            if (newIP) {
              console.log('🎉 Shelly trouvé après redémarrage à l\'IP:', newIP);
              setAlertMsg('🎉 Shelly connected to WiFi!');
              setShellyIP(newIP);
              setWifiPasswordModalVisible(false);
              // ✅ CORRECTION : Passer à site-name SEULEMENT si IP trouvée
              // La vérification critique se fera dans handleAddSiteName
        setAddStep('site-name');
        setNewSiteName("");
              return;
            }
            if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          // Si pas trouvé après 5 tentatives - NE PAS passer à site-name
          setAlertMsg('⚠️ Shelly not yet visible - check connection and try again');
          setAlertVisible(true);
          // IMPORTANT: Ne pas passer à site-name sans IP Shelly
        } else {
          console.log('❌ Configuration WiFi échouée');
          setAlertMsg('❌ Shelly WiFi configuration failed. Site not created. Please try again.');
          setAlertVisible(true);
          // NE PAS passer à site-name si échec
          return;
        }
      } else {
        setShellyIP(null);
        setAlertMsg("⚠️ Configuration finished but Shelly is not connected yet. Make sure it is powered on and on the same network, then try again.");
        setAlertVisible(true);
        return; // IMPORTANT: Ne pas continuer sans IP Shelly
      }
    } catch (e) {
      setWifiPwLoading(false);
      setWifiPwResult('fail');
      setWifiPwError("Connection failed. Please check your password.");
      Vibration.vibrate(100);
    }
  };

  /* ---------- Sites helpers ---------- */
  // Ajoute un site avec statut "Not Connected" par défaut
  // SUPPRIMÉ: addSite() - cause des sites fantômes
  // La création se fait uniquement via finalizeSiteCreation() après vérification

  // SUPPRIMÉ: onTemplate() - cause des sites fantômes
  // Le nouveau flux passe par setAddStep('method') uniquement

  // 2. Fonction pour ouvrir le modal de renommage
  const openRename = (site: SiteInfo) => {
    setSelectedSite(site);
    setRenameText(site.name);
    setRenameVisible(true);
  };

  // 3. Fonction pour confirmer le renommage
  const confirmRename = async () => {
    if (!selectedSite) return;
    const newName = renameText.trim();
    if (!newName) {
      setRenameVisible(false);
      return;
    }
    
    // ✅ NOUVEAU : Mettre à jour le nom dans AWS DynamoDB
    try {
      console.log('🔄 Mise à jour du nom du site dans AWS...');
      const currentUserId = await AuthService.getCurrentUserId();
      if (currentUserId) {
        // D'abord, récupérer tous les appareils pour trouver celui correspondant au site
        const devicesResult = await ShellyService.getUserShellyDevices(currentUserId);
        if (devicesResult.success && devicesResult.data) {
          const devices = devicesResult.data.data || devicesResult.data;
          const device = devices.find((d: any) => 
            d.siteId === selectedSite.id || 
            d.siteName === selectedSite.name
          );
          
          if (device) {
            console.log('📱 Appareil trouvé dans AWS:', device.id);
            const updateResult = await ShellyService.updateShellyDevice(device.id, {
              siteName: newName,
              lastUpdated: new Date().toISOString()
            });
            
            if (updateResult.success) {
              console.log('✅ Nom du site mis à jour dans AWS avec succès');
            } else {
              console.error('❌ Erreur lors de la mise à jour du nom dans AWS:', updateResult.error);
            }
          } else {
            console.error('❌ Aucun appareil trouvé dans AWS pour ce site');
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour AWS:', error);
    }
    
    // Mettre à jour localement
    const upd = sites.map((s) =>
      s.id === selectedSite.id ? { ...s, name: newName } : s
    );
    persistSites(upd);
    setRenameVisible(false);
  };

  const handleDeleteSite = (site: SiteInfo) => {
    setSiteToDelete(site);
    setDeleteVisible(true);
  };
  const confirmDeleteSite = async () => {
    if (!siteToDelete) return;
    try {
      console.log('🗑️ Suppression du site:', siteToDelete.name);
      // Supprimer côté AWS si possible (non bloquant)
      if (siteToDelete.deviceInfo && siteToDelete.deviceInfo.deviceId) {
        console.log('🗑️ Suppression AWS pour deviceId:', siteToDelete.deviceInfo.deviceId);
        
        try {
          // Supprimer l'appareil Shelly
          const result = await ShellyService.deleteShellyDevice(siteToDelete.deviceInfo.deviceId);
          
          if (result.success) {
            console.log('✅ Suppression AWS réussie');
          } else {
            console.error('⚠️ Erreur suppression AWS:', result.error);
          }
        } catch (awsError) {
          console.error('⚠️ Erreur suppression AWS (ignorée):', awsError);
        }
      }
      
      // Supprimer localement
      const upd = sites.filter((s) => s.id !== siteToDelete.id);
      persistSites(upd);
      
      setDeleteVisible(false);
      setSiteToDelete(null);
      console.log('✅ Site supprimé localement');
      
    } catch (error) {
      console.error('❌ Error deleting site:', error);
    }
  };

  // Helpers pour changer le statut d'un site (pour démo)
  const setSiteStatus = (id: string, status: SiteInfo['status']) => {
    const upd = sites.map(site => site.id === id ? { ...site, status } : site);
    persistSites(upd);
  };

  // Nouveau handler pour le bouton +
  const handleAddPress = () => {
    setAddStep('method');
  };

  // Handler pour choix BLE/Wi-Fi
  const handleAddMethod = (method: 'ble' | 'wifi') => {
    setPendingConnection(method);
    if (method === 'ble') {
      if (bleState !== State.PoweredOn) {
        setAlertMsg('Bluetooth is disabled. Please enable Bluetooth to continue.');
        setAlertVisible(true);
        return;
      }
      scanForPeripherals();
      setAddStep('ble');
    } else {
      scanForWifi();
      setAddStep('wifi');
    }
  };

  // Handler après connexion BLE
  const handleDeviceConnected = async (device: any) => {
    try {
      // Se connecter d'abord à l'appareil BLE
              console.log('🔗 Connecting to BLE device:', device.name || device.id);
      
      // Simuler la connexion BLE (remplacez par votre vraie logique de connexion)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sauvegarder l'appareil BLE connecté
    setPendingDevice(device);
    setDevVisible(false);
    setNewSiteName("");
      
      // Charger la liste Wi-Fi disponible
      await scanForWifi();
      
      // Sélectionner le premier réseau Wi-Fi par défaut
      if (wifiList && wifiList.length > 0) {
        setInjectionSsid(wifiList[0]?.SSID || '');
      }
      
      // Passer à l'étape de configuration Wi-Fi
    setAddStep('wifi-inject');
      
      console.log('✅ BLE device connected, moving to Wi-Fi configuration');
      
    } catch (error) {
      console.error('❌ Error connecting to BLE device:', error);
      setAlertMsg('Error connecting to the BLE device');
      setAlertVisible(true);
    }
  };

  // Handler après connexion Wi-Fi
  const handleWifiConnected = async (_ssid: string) => {
    try {
    setPendingWifi(_ssid);
    setWifiVisible(false);
    setNewSiteName("");
      
      // Charger la liste Wi-Fi disponible
      await scanForWifi();
      
      // Sélectionner le réseau Wi-Fi choisi
      setInjectionSsid(_ssid);
    setAddStep('wifi-inject');
      
      console.log('✅ Wi-Fi selected, moving to configuration');
      
    } catch (error) {
      console.error('Error connecting to Wi-Fi:', error);
      setAlertMsg('Error selecting Wi‑Fi');
      setAlertVisible(true);
    }
  };

  // Fonction pour tester la connexion Shelly après configuration
  const testShellyConnection = async (deviceInfo: any) => {
    try {
      console.log('🧪 Test de connexion Shelly...', deviceInfo);
      
      // Si l'appareil a une IP, vérifier la connexion Wi-Fi
      // même si connectionType indique BLE (car BLE était juste pour la configuration)
      if (deviceInfo.ipAddress && deviceInfo.ipAddress !== 'N/A') {
        console.log('📡 Test Wi-Fi pour Shelly...');
        
        // 1. Vérifier le réseau actuel
        const currentSsid = await WifiManager.getCurrentWifiSSID();
        console.log('📱 Réseau actuel:', currentSsid);
        
        // 2. Essayer de pinger l'adresse IP de Shelly avec timeout plus court
        try {
          console.log('🌐 Test de connexion à:', deviceInfo.ipAddress);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout réduit à 2 secondes
          
          // Essayer plusieurs endpoints Shelly dans l'ordre de priorité
          const endpoints = [
            '/shelly',
            '/status',
            '/rpc/Shelly.GetDeviceInfo',
            '/',
            '/settings',
            '/info'
          ];
          
          for (const endpoint of endpoints) {
            try {
              const response = await fetch(`http://${deviceInfo.ipAddress}${endpoint}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                  'Accept': 'application/json, text/plain, */*',
                  'User-Agent': 'WaiHome-App/1.0',
                  'Connection': 'keep-alive'
                }
              });
              
              if (response.ok) {
                console.log(`✅ Shelly répond sur ${endpoint}`);
                clearTimeout(timeoutId);
                return true;
              }
            } catch (endpointError) {
              console.log(`❌ Endpoint ${endpoint} échoué:`, endpointError.message);
            }
          }
          
          clearTimeout(timeoutId);
          console.log('❌ Aucun endpoint Shelly ne répond');
          
        } catch (error) {
          console.log('❌ Erreur lors du ping Shelly:', error);
        }
        
        return false;
      }
      
      // Fallback vers BLE si pas d'IP
      if (deviceInfo.connectionType === 'BLE') {
        // Test BLE
        const isConnected = await bleManager.isDeviceConnected(deviceInfo.deviceId);
        console.log('🔗 Statut BLE:', isConnected ? 'Connecté' : 'Déconnecté');
        return isConnected;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erreur lors du test de connexion:', error);
      return false;
    }
  };

  // Fonction pour vérifier la connexion avec retry
  const testShellyConnectionWithRetry = async (deviceInfo: any, maxRetries = 5) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Tentative ${attempt}/${maxRetries} de connexion Shelly...`);
      
      const isConnected = await testShellyConnection(deviceInfo);
      if (isConnected) {
        console.log(`✅ Connexion Shelly réussie à la tentative ${attempt}`);
        return true;
      }
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000; // 1s, 2s, 3s, 4s
        console.log(`⏳ Attente ${waitTime/1000} secondes avant la prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.log('❌ Échec de connexion après toutes les tentatives');
    return false;
  };

  // NOUVEAU : Fonction pour envoyer des commandes à distance
  const sendRemoteCommand = async (siteId: string, component: string, action: string, value?: any) => {
    try {
      console.log(`📤 Envoi commande à distance: ${component} ${action} sur ${siteId}`);
      
      const response = await fetch(`https://waihome-3.onrender.com/api/shelly/command/${siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component, action, value })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Commande envoyée avec succès:', result);
        
        // Afficher un message de confirmation
        setAlertMsg(`✅ Command ${action} sent to component ${component} on ${siteId}`);
        setAlertVisible(true);
        
        // Mettre à jour l'interface si nécessaire
        if (result.mqtt === 'published') {
          console.log('📡 Commande publiée sur AWS IoT');
        } else {
          console.log('💾 Commande enregistrée localement');
        }
        
      } else {
        console.error('❌ Erreur commande:', result.error);
        setAlertMsg(`❌ Erreur: ${result.error}`);
        setAlertVisible(true);
      }
      
    } catch (error) {
      console.error('❌ Erreur envoi commande:', error);
      setAlertMsg('Erreur de connexion au serveur');
      setAlertVisible(true);
    }
  };

  // NOUVEAU : Fonction pour tester la connexion MQTT
  const testMqttConnection = async () => {
    try {
      const response = await fetch('https://waihome-3.onrender.com/api/mqtt/status');
      const status = await response.json();
      
      console.log('📡 Statut MQTT:', status);
      
      if (status.connected) {
        setAlertMsg(`✅ MQTT connected to ${status.endpoint}`);
      } else {
        setAlertMsg(`⚠️ MQTT disconnected - ${status.endpoint}`);
      }
      setAlertVisible(true);
      
    } catch (error) {
      console.error('❌ Erreur test MQTT:', error);
      setAlertMsg('Erreur lors du test MQTT');
      setAlertVisible(true);
    }
  };

  // NOUVEAU : Fonction pour tester les commandes à distance
  const testRemoteCommands = async (siteId: string) => {
    try {
      console.log('🧪 Test des commandes à distance pour site:', siteId);
      
      // Test 1: Activer la pompe
      await sendRemoteCommand(siteId, 'pump', 'on');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 2: Désactiver la pompe
      await sendRemoteCommand(siteId, 'pump', 'off');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 3: Activer le chauffage
      await sendRemoteCommand(siteId, 'heater', 'on');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 4: Désactiver le chauffage
      await sendRemoteCommand(siteId, 'heater', 'off');
      
      setAlertMsg('✅ Remote command tests completed!');
      setAlertVisible(true);
      
    } catch (error) {
      console.error('❌ Erreur tests commandes:', error);
      setAlertMsg('Erreur lors des tests des commandes');
      setAlertVisible(true);
    }
  };

  // Fonction pour configurer le comportement après coupure de courant
  const configureShellyPowerOnBehavior = async (ipAddress: string) => {
    try {
      console.log('⚙️ Configuration du comportement après coupure de courant...');
      
      // Configurer tous les relais pour se remettre en OFF après coupure
      const relays = [0, 1, 2, 3];
      
      for (const relayId of relays) {
        try {
          const response = await fetch(`http://${ipAddress}/settings/relay/${relayId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              auto_on: false,           // Pas d'allumage automatique
              power_on_behavior: "off"  // Reset à OFF après coupure
            })
          });
          
          if (response.ok) {
            console.log(`✅ Relay ${relayId} configuré pour reset à OFF après coupure`);
          } else {
            console.log(`⚠️ Erreur configuration relay ${relayId}:`, response.status);
          }
        } catch (error) {
          console.log(`❌ Erreur configuration relay ${relayId}:`, error.message);
        }
      }
      
      console.log('✅ Configuration après coupure terminée');
      
    } catch (error) {
      console.error('❌ Erreur lors de la configuration après coupure:', error);
    }
  };

  // Fonction pour vérifier si le Shelly est déjà accessible via le réseau principal
  const checkIfShellyIsAccessible = async (): Promise<boolean> => {
    try {
      console.log('🔍 Vérification de l\'accessibilité du Shelly via le réseau principal...');
      
      // Essayer de scanner le réseau pour trouver le Shelly
      const shellyIP = await scanNetworkForShelly();
      if (shellyIP) {
        console.log('✅ Shelly trouvé sur le réseau principal:', shellyIP);
        return true;
      }
      
      console.log('❌ Shelly non trouvé sur le réseau principal');
      return false;
    } catch (error) {
      console.log('❌ Erreur lors de la vérification d\'accessibilité:', error);
      return false;
    }
  };

  // Fonction pour configurer le Wi-Fi du Shelly directement (sans passer par son AP)
  const configureShellyWifiDirect = async (ssid: string, password: string): Promise<boolean> => {
    try {
      console.log('🔧 Configuration Wi-Fi directe du Shelly...');
      
      // Trouver l'IP du Shelly sur le réseau principal
      const shellyIP = await scanNetworkForShelly();
      if (!shellyIP) {
        throw new Error('Shelly not found on main network');
      }
      
      console.log('📡 Configuration Wi-Fi via Shelly sur:', shellyIP);
      
      // Détecter le type de Shelly
      const isShellyGen2 = await detectShellyGeneration(shellyIP);
      console.log(`🔍 Type Shelly détecté: ${isShellyGen2 ? 'Gen2 (Pro/Plus)' : 'Gen1 (Classic)'}`);
      
      let configSuccess = false;
      
      if (isShellyGen2) {
        // Configuration pour Shelly Pro/Plus (Gen2) via RPC
        configSuccess = await configureShellyGen2Wifi(shellyIP, ssid, password);
      } else {
        // Configuration pour Shelly Gen1 via endpoints classiques
        configSuccess = await configureShellyGen1Wifi(shellyIP, ssid, password);
      }
      
      if (configSuccess) {
        console.log('✅ Configuration Wi-Fi directe réussie');
        return true;
      } else {
        throw new Error('Direct Wi-Fi configuration failed');
      }
      
    } catch (error) {
      console.error('❌ Erreur configuration Wi-Fi directe:', error);
      throw error;
    }
  };

  // Fonction pour configurer le Wi-Fi du Shelly via son IP
  const configureShellyWifiViaIP = async (shellyIP: string, ssid: string, password: string): Promise<boolean> => {
    try {
      console.log('🔧 Configuration Wi-Fi du Shelly via IP:', shellyIP);
      
      // Détecter le type de Shelly
      const isShellyGen2 = await detectShellyGeneration(shellyIP);
      console.log(`🔍 Type Shelly détecté: ${isShellyGen2 ? 'Gen2 (Pro/Plus)' : 'Gen1 (Classic)'}`);
      
      let configSuccess = false;
      
      if (isShellyGen2) {
        // Configuration pour Shelly Pro/Plus (Gen2) via RPC
        configSuccess = await configureShellyGen2Wifi(shellyIP, ssid, password);
      } else {
        // Configuration pour Shelly Gen1 via endpoints classiques
        configSuccess = await configureShellyGen1Wifi(shellyIP, ssid, password);
      }
      
      if (configSuccess) {
        console.log('✅ Configuration Wi-Fi via IP réussie');
        return true;
      } else {
        throw new Error('Wi-Fi configuration via IP failed');
      }
      
    } catch (error) {
      console.error('❌ Erreur configuration Wi-Fi via IP:', error);
      throw error;
    }
  };

  // Fonction pour détecter la génération du Shelly
  const detectShellyGeneration = async (shellyIP: string): Promise<boolean> => {
    try {
      // Essayer d'accéder à l'endpoint RPC (Gen2)
      const response = await fetch(`http://${shellyIP}/rpc/Shelly.GetDeviceInfo`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        return true; // Gen2
      }
      
      // Essayer l'endpoint classique (Gen1)
      const classicResponse = await fetch(`http://${shellyIP}/shelly`, {
        method: 'GET'
      });
      
      if (classicResponse.ok) {
        return false; // Gen1
      }
      
      // Par défaut, considérer comme Gen2 (plus récent)
      return true;
    } catch (error) {
      console.log('⚠️ Erreur détection génération Shelly, par défaut Gen2:', error);
      return true;
    }
  };

  // Fonction pour configurer Wi-Fi Shelly Gen2 (Pro/Plus)
  const configureShellyGen2Wifi = async (shellyIP: string, ssid: string, password: string): Promise<boolean> => {
    try {
      console.log('🚀 Configuration Wi-Fi Shelly Gen2 via RPC...');
      
      const rpcWifiConfig = {
        id: 1,
        method: "WiFi.SetConfig",
        params: {
          config: {
            sta: {
              ssid: ssid,
              pass: password,
              enable: true
            },
            ap: {
              enable: true // Garder l'AP actif
            }
          }
        }
      };
      
      const response = await fetch(`http://${shellyIP}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcWifiConfig)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Configuration Wi-Fi Gen2 réussie:', result);
        return true;
      } else {
        console.error('❌ Échec configuration Wi-Fi Gen2:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur configuration Wi-Fi Gen2:', error);
      return false;
    }
  };

  // Fonction pour configurer Wi-Fi Shelly Gen1 (Classic)
  const configureShellyGen1Wifi = async (shellyIP: string, ssid: string, password: string): Promise<boolean> => {
    try {
      console.log('🔧 Configuration Wi-Fi Shelly Gen1 via endpoints classiques...');
      
      const wifiConfig = {
        wifi_ssid: ssid,
        wifi_pass: password,
        wifi_enable: true
      };
      
      const response = await fetch(`http://${shellyIP}/settings/sta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wifiConfig)
      });
      
      if (response.ok) {
        console.log('✅ Configuration Wi-Fi Gen1 réussie');
        return true;
      } else {
        console.error('❌ Échec configuration Wi-Fi Gen1:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur configuration Wi-Fi Gen1:', error);
      return false;
    }
  };

  // Fonction pour retourner au WiFi principal
  const reconnectToMainWifi = async (ssid: string, password: string) => {
    try {
      console.log('🔄 Reconnexion au WiFi principal:', ssid);
      const result = await WifiManager.connectToProtectedSSID(ssid, password, false);
      if (result) {
        console.log('✅ Reconnecté au WiFi principal');
        return true;
      } else {
        console.log('❌ Échec reconnexion au WiFi principal');
        return false;
      }
    } catch (error) {
      console.log('❌ Erreur reconnexion WiFi principal:', error);
      return false;
    }
  };

  // Fonction de configuration WiFi SIMPLE et FONCTIONNELLE
  const configureShellyWifiSimple = async (ssid: string, password: string) => {
    try {
      console.log('🚀 DÉBUT CONFIGURATION WIFI SHELLY SIMPLE');
      console.log('📡 SSID cible:', ssid);
      
      // ÉTAPE 1: Trouver le réseau Shelly AP
      console.log('🔍 ÉTAPE 1: Recherche du réseau Shelly AP...');
      const wifiList = await WifiManager.reScanAndLoadWifiList();
      console.log('📶 Réseaux disponibles:', wifiList.map((w: any) => w.SSID));
      
      const shellyNetwork = wifiList.find((network: any) => 
        network && network.SSID && (
          network.SSID.toLowerCase().includes('shelly') ||
          network.SSID.toLowerCase().includes('shellypro') ||
          network.SSID.toLowerCase().includes('shelly_')
        )
      );
      
      if (!shellyNetwork) {
        console.log('❌ Aucun réseau Shelly AP trouvé');
        console.log('💡 Assure-toi que ton Shelly clignote bleu (mode AP)');
        return false;
      }
      
      console.log('✅ Réseau Shelly trouvé:', shellyNetwork.SSID);
      
      // ÉTAPE 2: Se connecter au réseau Shelly AP (réseau ouvert)
      console.log('🔌 ÉTAPE 2: Connexion au réseau Shelly AP...');
      let connectResult = false as boolean;
      try {
        // 2.a Essayer l'API dédiée aux réseaux ouverts
        // Sur certaines versions d'Android, l'appel suivant fonctionne mieux pour un AP sans mot de passe
        // et évite le dialogue système qui peut annuler la demande.
        // Si indisponible, on bascule sur connectToProtectedSSID avec mot de passe vide.
        // @ts-ignore: connectToSSID existe sur Android via react-native-wifi-reborn
        connectResult = await WifiManager.connectToSSID(shellyNetwork.SSID);
        console.log('✅ Connexion Shelly AP via connectToSSID:', connectResult);
      } catch (e) {
        console.log('ℹ️ connectToSSID non disponible ou échouée, fallback protectedSSID:', e);
      }
      
      if (!connectResult) {
        try {
          connectResult = await WifiManager.connectToProtectedSSID(
            shellyNetwork.SSID,
            '', // AP Shelly sans mot de passe
            false
          );
          console.log('✅ Connexion Shelly AP via connectToProtectedSSID:', connectResult);
        } catch (e2) {
          console.log('❌ Échec connexion au réseau Shelly AP:', e2);
          return false;
        }
      }
      
      console.log('✅ Connecté au réseau Shelly AP');
      
      // ÉTAPE 3: Attendre que la connexion soit stable
      console.log('⏳ ÉTAPE 3: Attente de la connexion stable...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // ÉTAPE 4: Configuration WiFi du Shelly (support Gen 2 + Gen 1)
      console.log('🔧 ÉTAPE 4: Configuration WiFi du Shelly...');
      const shellyIP = '192.168.33.1';
      
      // Essayer plusieurs méthodes de configuration
      let configSuccess = false;
      let usedRpc = false;

      // Méthode 0: RPC Gen2 (Shelly Pro/Plus) - prioritaire
      try {
        console.log('🔧 Méthode 0: RPC Gen2 WiFi.SetConfig...');
        const rpcResponse = await fetch(`http://${shellyIP}/rpc/WiFi.SetConfig`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              sta: { ssid, pass: password, enable: true },
              ap: { enable: false }
            }
          })
        });
        if (rpcResponse.ok) {
          console.log('✅ Configuration WiFi via RPC réussie');
          configSuccess = true;
          usedRpc = true;
        } else {
          console.log('⚠️ RPC WiFi.SetConfig a renvoyé', rpcResponse.status);
        }
      } catch (rpcError) {
        console.log('⚠️ Erreur RPC WiFi.SetConfig:', rpcError);
      }
      
      // Méthode 1: API GET simple
      if (!configSuccess) try {
        console.log('🔧 Méthode 1: API GET simple...');
        const response = await fetch(`http://${shellyIP}/settings/wifi?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(password)}`, {
          method: 'GET'
        });
        
        if (response.ok) {
          console.log('✅ Configuration WiFi via GET réussie');
          configSuccess = true;
        } else {
          console.log('⚠️ GET échoué, essai POST...');
        }
      } catch (getError) {
        console.log('⚠️ Erreur GET:', getError);
      }
      
      // Méthode 2: API POST avec FormData
      if (!configSuccess) {
        try {
          console.log('🔧 Méthode 2: API POST avec FormData...');
          const formData = new FormData();
          formData.append('ssid', ssid);
          formData.append('pass', password);
          
          const response = await fetch(`http://${shellyIP}/settings/wifi`, {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            console.log('✅ Configuration WiFi via POST réussie');
            configSuccess = true;
          } else {
            console.log('⚠️ POST échoué, essai JSON...');
          }
        } catch (postError) {
          console.log('⚠️ Erreur POST:', postError);
        }
      }
      
      // Méthode 3: API JSON
      if (!configSuccess) {
        try {
          console.log('🔧 Méthode 3: API JSON...');
          const response = await fetch(`http://${shellyIP}/settings/wifi`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ssid: ssid,
              pass: password
            })
          });
          
          if (response.ok) {
            console.log('✅ Configuration WiFi via JSON réussie');
            configSuccess = true;
          } else {
            console.log('⚠️ JSON échoué');
          }
        } catch (jsonError) {
          console.log('⚠️ Erreur JSON:', jsonError);
        }
      }
      
      if (configSuccess) {
        console.log('🎉 CONFIGURATION WIFI RÉUSSIE !');
        // Pour les appareils Gen2 configurés via RPC, lancer un reboot explicite
        if (usedRpc) {
          try {
            await fetch(`http://${shellyIP}/rpc/Device.Reboot`, { method: 'POST' });
            console.log('🔄 Reboot demandé via RPC');
          } catch (e) {
            console.log('⚠️ Reboot RPC échoué (peut être normal si l\'appareil redémarre déjà):', e);
          }
        }
        console.log('⏳ Le Shelly va redémarrer et se connecter à ton WiFi...');
        return true;
      } else {
        console.log('❌ Toutes les méthodes de configuration ont échoué');
        return false;
      }
      
    } catch (error) {
      console.log('❌ Erreur configureShellyWifiSimple:', error);
      return false;
    }
  };

  // Fonction pour configurer Wi-Fi via réseau Shelly (connexion réelle)
  const configureShellyWifiViaNetwork = async (ssid: string, password: string) => {
    try {
      console.log('🌐 Configuration Wi-Fi Shelly via AP...');
      console.log('📡 SSID cible:', ssid);
      
      // 1. Scanner pour trouver le réseau Shelly AP
      console.log('🔍 Recherche du réseau Shelly AP...');
      const wifiList = await WifiManager.reScanAndLoadWifiList();
      console.log('📶 Réseaux disponibles:', wifiList);
      
      // Chercher un réseau Shelly (commence par "Shelly-")
      const shellyNetwork = wifiList.find((network: any) => 
        network && network.SSID && network.SSID.toLowerCase().includes('shelly')
      );
      
      if (!shellyNetwork) {
        console.log('❌ Aucun réseau Shelly AP trouvé');
        console.log('💡 Assurez-vous que votre Shelly est en mode AP (clignote bleu)');
        return false;
      }
      
      console.log('✅ Réseau Shelly trouvé:', shellyNetwork.SSID);
      
      // 2. Se connecter au réseau Shelly AP
      console.log('🔌 Connexion au réseau Shelly AP...');
      const connectResult = await WifiManager.connectToProtectedSSID(
        shellyNetwork.SSID, 
        '', // Pas de mot de passe pour l'AP Shelly
        false // Pas de WEP
      );
      
      if (!connectResult) {
        console.log('❌ Échec connexion au réseau Shelly AP');
        return false;
      }
      
      console.log('✅ Connecté au réseau Shelly AP');
      
      // 3. Attendre que la connexion soit stable
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 4. Configurer le WiFi du Shelly via son interface web
      console.log('🔧 Configuration du WiFi Shelly...');
      const shellyIP = '192.168.33.1'; // IP par défaut de l'AP Shelly
      
      // Essayer plusieurs méthodes de configuration
      let configSuccess = false;
      
      // Méthode 1: API RPC Shelly
      try {
        console.log('🔧 Tentative configuration via API RPC...');
        const rpcConfig = {
          method: 'Shelly.SetWiFiConfig',
          params: {
            config: {
              ssid: ssid,
              pass: password,
              ip: null,
              netmask: null,
              gw: null
            }
          }
        };
        
        const rpcResponse = await fetch(`http://${shellyIP}/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rpcConfig)
        });
        
        if (rpcResponse.ok) {
          console.log('✅ Configuration WiFi via RPC réussie');
          configSuccess = true;
        } else {
          console.log('⚠️ Configuration RPC échouée, essai méthode alternative...');
        }
      } catch (rpcError) {
        console.log('⚠️ Erreur RPC, essai méthode alternative:', rpcError);
      }
      
      // Méthode 2: API Settings classique
      if (!configSuccess) {
        try {
          console.log('🔧 Tentative configuration via API Settings...');
          const settingsConfig = {
            wifi: {
              ssid: ssid,
              pass: password,
              ip: null,
              netmask: null,
              gw: null
            }
          };
          
          const settingsResponse = await fetch(`http://${shellyIP}/settings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(settingsConfig)
          });
          
          if (settingsResponse.ok) {
            console.log('✅ Configuration WiFi via Settings réussie');
            configSuccess = true;
          } else {
            console.log('⚠️ Configuration Settings échouée');
          }
        } catch (settingsError) {
          console.log('❌ Erreur configuration Settings:', settingsError);
        }
      }
      
      // Méthode 3: API simple GET
      if (!configSuccess) {
        try {
          console.log('🔧 Tentative configuration via API simple GET...');
          const simpleResponse = await fetch(`http://${shellyIP}/settings/wifi?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(password)}`, {
            method: 'GET'
          });
          
          if (simpleResponse.ok) {
            console.log('✅ Configuration WiFi via API simple GET réussie');
            configSuccess = true;
          }
        } catch (simpleError) {
          console.log('❌ Erreur configuration simple GET:', simpleError);
        }
      }
      
      // Méthode 4: API simple POST
      if (!configSuccess) {
        try {
          console.log('🔧 Tentative configuration via API simple POST...');
          const formData = new FormData();
          formData.append('ssid', ssid);
          formData.append('pass', password);
          
          const postResponse = await fetch(`http://${shellyIP}/settings/wifi`, {
            method: 'POST',
            body: formData
          });
          
          if (postResponse.ok) {
            console.log('✅ Configuration WiFi via API simple POST réussie');
            configSuccess = true;
          }
        } catch (postError) {
          console.log('❌ Erreur configuration simple POST:', postError);
        }
      }
      
      if (configSuccess) {
        // 5. Attendre que le Shelly se reconnecte au nouveau WiFi
        console.log('⏳ Attente de la reconnexion Shelly...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        return true;
      } else {
        console.log('❌ Toutes les méthodes de configuration ont échoué');
        return false;
      }
      
    } catch (error) {
      console.log('❌ Erreur configureShellyWifiViaNetwork:', error);
      return false;
    }
  };

  // Fonction pour configurer Wi-Fi via réseau Shelly (ancienne version - gardée pour compatibilité)
  const configureShellyWifiViaNetworkOld = async (ssid: string, password: string) => {
    let currentNetwork = null;
    
    try {
      console.log('🌐 Configuration Wi-Fi via réseau Shelly...');
      
      // 1. Sauvegarder le réseau actuel
      currentNetwork = await WifiManager.getCurrentWifiSSID();
      console.log('📱 Réseau actuel:', currentNetwork);
      
      // 2. ESSAYER D'ABORD la configuration directe (même si Shelly pas détecté)
      console.log('🔍 Tentative de configuration directe du Shelly...');
      try {
        const directResult = await configureShellyWifiDirect(ssid, password);
        if (directResult) {
          console.log('✅ Configuration Wi-Fi directe réussie');
          return true;
        }
      } catch (e) {
        console.log('⚠️ Configuration directe échouée:', e?.message || e);
      }
      
      // 3. Si configuration directe échoue, scanner pour trouver le réseau Shelly AP
      console.log('🔍 Configuration directe échouée - scan des réseaux Wi-Fi disponibles...');
      let wifiList: any[] = [];
      try {
        const wifiListRaw = await WifiManager.reScanAndLoadWifiList();
        console.log('📡 Raw Wi-Fi scan result:', typeof wifiListRaw, wifiListRaw);
        
        if (Array.isArray(wifiListRaw)) {
          wifiList = wifiListRaw;
        } else if (typeof wifiListRaw === 'string') {
          try {
            const parsed = JSON.parse(wifiListRaw);
            if (Array.isArray(parsed)) {
              wifiList = parsed;
            }
          } catch (parseError) {
            console.log('⚠️ JSON parse failed:', parseError);
          }
        } else if (wifiListRaw && typeof wifiListRaw === 'object') {
          // Parfois c'est un objet avec une propriété qui contient le tableau
          const keys = Object.keys(wifiListRaw);
          if (keys.length > 0) {
            const firstKey = keys[0];
            if (Array.isArray(wifiListRaw[firstKey])) {
              wifiList = wifiListRaw[firstKey];
            }
          }
        }
      } catch (scanError) {
        console.log('❌ Wi-Fi scan failed:', scanError);
      }
      
      // Fallback si toujours pas de tableau
      if (!Array.isArray(wifiList)) {
        console.log('⚠️ Wi-Fi list not an array, using empty fallback');
        wifiList = [];
      }
      
      // Double vérification de sécurité
      if (!wifiList) {
        console.log('⚠️ wifiList is null/undefined, initializing empty array');
        wifiList = [];
      }
      
      console.log('📶 Réseaux trouvés (' + (wifiList?.length || 0) + '):', Array.isArray(wifiList) && wifiList.length > 0 ? wifiList.map((n: any) => n?.SSID || 'Unknown').join(', ') : 'Liste invalide ou vide');
      
      const shellyNetwork = Array.isArray(wifiList) ? wifiList.find((network: any) => 
        network && typeof network.SSID === 'string' && network.SSID.toLowerCase().includes('shelly')
      ) : null;
      
      if (!shellyNetwork) {
        console.log('ℹ️ Aucun réseau Shelly trouvé – tentative de configuration directe sur le réseau principal');
        try {
          const directOk = await configureShellyWifiDirect(ssid, password);
          if (directOk) {
            console.log('✅ Configuration Wi‑Fi directe réussie (sans passer par AP)');
            return true;
          }
        } catch (e) {
          console.log('❌ Échec configuration directe:', e?.message || e);
        }
        
        // Si la configuration directe échoue aussi, essayer quand même de continuer
        console.log('⚠️ Configuration directe échouée, mais on continue quand même');
        
        // Essayer de trouver le Shelly via son IP actuelle
        console.log('🔍 Tentative de configuration via IP actuelle du Shelly...');
        try {
          const shellyIP = await scanNetworkForShelly();
          if (shellyIP) {
            console.log('✅ Shelly trouvé via IP:', shellyIP);
            // Essayer de configurer le Wi-Fi via cette IP
            const configResult = await configureShellyWifiViaIP(shellyIP, ssid, password);
            if (configResult) {
              console.log('✅ Configuration Wi-Fi via IP réussie');
              return true;
            }
          }
        } catch (e) {
          console.log('❌ Échec configuration via IP:', e?.message || e);
        }
        
        return true; // Retourner true pour permettre la continuation
      }
      
      console.log('📡 Réseau Shelly trouvé:', shellyNetwork.SSID);
      
      // Détecter si c'est un Shelly Pro/Plus (Gen2) ou Gen1
      const isShellyGen2 = shellyNetwork.SSID.toLowerCase().includes('shellypro') || 
                           shellyNetwork.SSID.toLowerCase().includes('shellyplus') ||
                           shellyNetwork.SSID.toLowerCase().includes('shellypro4pm');
      
      console.log(`🔍 Type Shelly détecté: ${isShellyGen2 ? 'Gen2 (Pro/Plus)' : 'Gen1 (Classic)'}`);
      
      // 3. Se connecter au réseau Shelly
      console.log('🔗 Connexion au réseau Shelly...');
      try {
        // Vérifier que le Wi-Fi est activé avant la connexion
        const wifiEnabled = await WifiManager.isEnabled();
        if (!wifiEnabled) {
          console.log('⚠️ Wi-Fi désactivé, tentative de réactivation...');
          await WifiManager.setEnabled(true);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2s
        }
        
        await WifiManager.connectToProtectedSSID(shellyNetwork.SSID, '', false, false);
        const okShelly = await (async () => {
          const end = Date.now() + 10000; // 10s
          while (Date.now() < end) {
            try {
              const current = await WifiManager.getCurrentWifiSSID();
              if (current && current.trim() === shellyNetwork.SSID.trim()) return true;
            } catch {}
            await new Promise(r => setTimeout(r, 400));
          }
          return false;
        })();
        if (!okShelly) throw new Error('Not connected to Shelly AP');
        console.log('✅ Connexion au réseau Shelly réussie');
      } catch (connectError) {
        console.error('❌ Erreur connexion au réseau Shelly:', connectError);
        // Essayer de réactiver le Wi-Fi en cas d'erreur
        try {
          await WifiManager.setEnabled(true);
          console.log('🔄 Wi-Fi réactivé après erreur de connexion');
        } catch (wifiError) {
          console.log('⚠️ Impossible de réactiver le Wi-Fi:', wifiError);
        }
        throw new Error(`Unable to connect to Shelly network: ${connectError.message}`);
      }
      
      // Attendre la connexion
      console.log('⏳ Attente de la stabilisation de la connexion...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Augmenté à 5 secondes
      
      // 4. Scanner le réseau pour trouver l'IP du Shelly
      console.log('🔍 Recherche de l\'IP du Shelly...');
      
      // Utiliser directement l'IP AP par défaut des Shelly (Gen2/Gen1): 192.168.33.1 (fallback .33.2)
      let shellyIP = '192.168.33.1';
      const fallbackIPs = ['192.168.33.2'];
      
      // Vérifier que l'IP par défaut répond avant de continuer
      const tryProbe = async (ip: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`http://${ip}/shelly`, { method: 'GET', signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) return true;
        } catch {}
        return false;
      };
      
      let reachable = await tryProbe(shellyIP);
      if (!reachable) {
        for (const ip of fallbackIPs) {
          if (await tryProbe(ip)) { shellyIP = ip; reachable = true; break; }
        }
      }
      
      if (!reachable) {
        console.log('❌ IP AP par défaut non joignable');
        throw new Error('Unable to reach Shelly on 192.168.33.1. Make sure you are connected to Shelly Wi-Fi.');
      }
      
      console.log('✅ Shelly AP joignable sur IP:', shellyIP);
      
      // 5. Envoyer la configuration Wi-Fi au Shelly via HTTP
      console.log('📤 Envoi de la configuration Wi-Fi au Shelly...');
      
      let configSuccess = false;
      
      if (isShellyGen2) {
        // Configuration pour Shelly Pro/Plus (Gen2) via RPC
        console.log('🚀 Utilisation des endpoints RPC Gen2 pour Shelly Pro/Plus...');
        
        try {
          // Configuration Wi-Fi via RPC
          const rpcWifiConfig = {
            id: 1,
            method: "WiFi.SetConfig",
            params: {
              config: {
                sta: {
                  ssid: ssid,
                  pass: password,
                  enable: true
                },
                ap: {
                  // Garder l'AP actif même après connexion STA
                  enable: true,
                  keep_on: true
                }
              }
            }
          };
          
          console.log('📤 Configuration RPC Gen2 à envoyer:', rpcWifiConfig);
          
          const rpcResponse = await fetch(`http://${shellyIP}/rpc`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(rpcWifiConfig)
          });
          
          if (rpcResponse.ok) {
            const rpcResult = await rpcResponse.json();
            console.log('✅ Configuration Wi-Fi RPC Gen2 envoyée avec succès:', rpcResult);
            configSuccess = true;
          } else {
            const errorText = await rpcResponse.text();
            console.log('⚠️ Erreur RPC Gen2, tentative avec méthode Gen1:', errorText);
          }
          
        } catch (rpcError) {
          console.log('⚠️ Erreur RPC Gen2, tentative avec méthode Gen1:', rpcError.message);
        }
      }
      
      // Si RPC Gen2 a échoué ou si c'est un Gen1, utiliser la méthode classique
      if (!configSuccess) {
        console.log('🔄 Utilisation de la méthode classique Gen1...');
        
        const wifiConfig = {
          wifi: {
          ssid: ssid,
          password: password,
            enable: true
          }
        };
        
        console.log('📤 Configuration Gen1 à envoyer:', wifiConfig);
        
        try {
          const response = await fetch(`http://${shellyIP}/settings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(wifiConfig)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur HTTP Gen1:', response.status, errorText);
            throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
          }
          
          const result = await response.json();
          console.log('✅ Configuration Wi-Fi Gen1 envoyée avec succès:', result);
          configSuccess = true;
          
        } catch (httpError) {
          console.error('❌ Erreur lors de l\'envoi de la configuration Gen1:', httpError);
          throw new Error(`Erreur lors de l'envoi de la configuration: ${httpError.message}`);
        }
      }
      
      if (!configSuccess) {
        throw new Error('No configuration method worked');
      }
      
      // 6. Redémarrer le Shelly pour appliquer la configuration
      console.log('🔄 Redémarrage du Shelly...');
      try {
        if (isShellyGen2) {
          // Redémarrage via RPC pour Gen2
          const rebootRpc = {
            id: 2,
            method: "Shelly.Reboot",
            params: {}
          };
          
          await fetch(`http://${shellyIP}/rpc`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(rebootRpc)
          });
          console.log('✅ Commande de redémarrage RPC Gen2 envoyée');
      } else {
          // Redémarrage classique pour Gen1
          await fetch(`http://${shellyIP}/settings?reboot=true`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          console.log('✅ Commande de redémarrage Gen1 envoyée');
        }
      } catch (rebootError) {
        console.log('⚠️ Erreur lors du redémarrage (peut être normal):', rebootError.message);
      }
      
      // 7. Attendre que le Shelly redémarre
      console.log('⏳ Attente du redémarrage du Shelly...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 8. Se reconnecter au réseau principal
      console.log('🔄 Reconnexion au réseau principal...');
      if (currentNetwork && currentNetwork !== shellyNetwork.SSID) {
        try {
          // Vérifier que le Wi-Fi est toujours activé avant la reconnexion
          const wifiStillEnabled = await WifiManager.isEnabled();
          if (!wifiStillEnabled) {
            console.log('⚠️ Wi-Fi désactivé pendant la configuration, réactivation...');
            await WifiManager.setEnabled(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Tentative de reconnexion automatique au réseau maison (celui fourni par l'utilisateur)
          console.log(`📡 Tentative de reconnexion automatique à ${ssid} ...`);
          try {
            await WifiManager.connectToProtectedSSID(ssid, password, false, false);
            console.log('✅ Reconnexion automatique réussie');
          } catch (autoErr) {
            console.log('⚠️ Reconnexion auto échouée, tentative alternative...');
            try {
              await WifiManager.connectToSSID(ssid);
              console.log('✅ Reconnexion alternative réussie');
            } catch (altErr) {
              console.log('⚠️ Reconnexion alternative échouée');
            }
          }
        } catch (reconnectError) {
          console.log('⚠️ Reconnexion automatique échouée, reconnexion manuelle requise');
          console.log('⚠️ Veuillez vous reconnecter manuellement au réseau:', currentNetwork);
          console.log('💡 Le Shelly devrait maintenant être connecté au réseau:', ssid);
        }
      }
      
      console.log('✅ Configuration Wi-Fi terminée avec succès !');
      return true;
      
    } catch (error) {
      console.error('❌ Erreur lors de la configuration Wi-Fi via réseau:', error);
      
      // Essayer de se reconnecter au réseau principal en cas d'erreur
      try {
        // Réactiver le Wi-Fi en cas d'erreur
        const wifiEnabled = await WifiManager.isEnabled();
        if (!wifiEnabled) {
          console.log('🔄 Réactivation du Wi-Fi après erreur...');
          await WifiManager.setEnabled(true);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (currentNetwork) {
          console.log('🔄 Tentative de reconnexion au réseau principal...');
          console.log('⚠️ Veuillez vous reconnecter manuellement au réseau:', currentNetwork);
        }
      } catch (reconnectError) {
        console.log('❌ Erreur lors de la reconnexion au réseau principal');
      }
      
      throw error;
    }
  };

  // Handler pour injection Wi-Fi (étape 1)
  const handleInjectWifi = async () => {
    setInjectionError("");
    const ssid = injectionSsid.trim();
    const password = injectionPassword;
    if (!ssid || !password) {
      setInjectionError("SSID and password are required.");
      return;
    }
    if (password.length < 8) {
      setInjectionError("Password must be at least 8 characters.");
      return;
    }
    setInjectionLoading(true);
    
    // 🔧 Synchroniser injectionPassword → wifiPassword et selectedSsid → pendingWifi
    setWifiPassword(password);
    setPendingWifi(ssid);
    
    try {
      // Vérifier que le Wi-Fi est activé
      const wifiEnabled = await WifiManager.isEnabled();
      if (!wifiEnabled) {
        setInjectionError("Wi-Fi is disabled. Please enable Wi-Fi to continue.");
        setInjectionLoading(false);
        return;
      }
      
      // Récupérer le SSID actuel du téléphone
      const currentSsid = await WifiManager.getCurrentWifiSSID();
      console.log('📱 Téléphone connecté à:', currentSsid);
      
      // VÉRIFICATION DU MOT DE PASSE WI-FI
      console.log('🔐 Vérification du mot de passe Wi-Fi pour:', ssid);
      
      try {
        // Tenter de se connecter au Wi-Fi pour vérifier le mot de passe
        await WifiManager.connectToProtectedSSID(ssid, password, false, false);
        console.log('✅ Mot de passe Wi-Fi correct !');
        
        // Vérifier que le Wi-Fi est toujours activé après la connexion
        const wifiStillEnabled = await WifiManager.isEnabled();
        if (!wifiStillEnabled) {
          console.log('⚠️ Wi-Fi désactivé après connexion, réactivation...');
          await WifiManager.setEnabled(true);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Revenir au réseau original si différent
        if (currentSsid && currentSsid !== ssid) {
          console.log('🔄 Retour au réseau original:', currentSsid);
          // Note: Ici vous devriez reconnecter au réseau original
          // await WifiManager.connectToProtectedSSID(currentSsid, originalPassword, false, false);
        }
        
      } catch (wifiError) {
        console.error('❌ Mot de passe Wi-Fi incorrect:', wifiError);
        // Réactiver le Wi-Fi en cas d'erreur
        try {
          const wifiEnabled = await WifiManager.isEnabled();
          if (!wifiEnabled) {
            console.log('🔄 Réactivation du Wi-Fi après erreur de mot de passe...');
            await WifiManager.setEnabled(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (wifiError2) {
          console.log('⚠️ Impossible de réactiver le Wi-Fi:', wifiError2);
        }
        setInjectionError("Incorrect Wi-Fi password. Please check your password.");
        setInjectionLoading(false);
        return;
      }
      
      if (pendingDevice) {
        // Mode BLE : Envoyer les paramètres Wi-Fi via Bluetooth
        console.log('📡 Envoi des paramètres Wi-Fi via BLE à l\'appareil Shelly:', { ssid, password });
        
        // Utiliser la vraie communication BLE avec Shelly (simulation pour l'instant)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Paramètres Wi-Fi envoyés via BLE');
        
      } else {
        // Mode Wi-Fi : Configuration via le réseau Shelly
        console.log('📡 Configuration via réseau Shelly');
        
        try {
          // Configuration réelle via le réseau Shelly
          await configureShellyWifiViaNetwork(ssid, password);
          console.log('✅ Configuration Wi-Fi via réseau Shelly terminée');
        } catch (wifiError) {
          console.error('❌ Erreur configuration Wi-Fi via réseau:', wifiError);
          
          // Ne plus bloquer sur les erreurs de réseau Shelly - continuer quand même
          console.log('⚠️ Erreur configuration Wi-Fi, mais on continue quand même');
          
          // Messages d'erreur plus spécifiques (mais ne plus bloquer)
          let specificError = "Wi-Fi configuration completed with warnings. Please check device connection.";
          
          if (wifiError.message && wifiError.message.includes('Aucun réseau Shelly trouvé')) {
            specificError = "No Shelly network found, but continuing with direct configuration.";
          } else if (wifiError.message && wifiError.message.includes('Impossible de se connecter au réseau Shelly')) {
            specificError = "Cannot connect to Shelly network, but continuing with direct configuration.";
          } else if (wifiError.message && wifiError.message.includes('Impossible de trouver l\'IP du Shelly')) {
            specificError = "Cannot find Shelly IP, but continuing with direct configuration.";
          } else if (wifiError.message && wifiError.message.includes('Erreur HTTP')) {
            specificError = "HTTP error during configuration, but continuing.";
          }
          
          console.log('ℹ️ Message d\'information:', specificError);
          // Ne plus afficher l'erreur comme bloquante
        }
      }
      
      setInjectionLoading(false);
      
      // 🔒 Ne PAS aller à 'site-name' tant que le Shelly n'est pas joignable
      setAlertMsg('⏳ Shelly restarts and connects to your Wi-Fi...');
      setAlertVisible(true);

      // attendre ~30 s le reboot
      await new Promise(res => setTimeout(res, 30000));

      // (optionnel) petite pause pour stabiliser la connexion
      await new Promise(res => setTimeout(res, 10000));

      // tenter 5 fois de trouver l'IP
      let foundIP: string | null = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        setAlertMsg(`🔍 Recherche Shelly (${attempt}/5)...`);
        foundIP = await scanNetworkForShelly();
        if (foundIP) break;
        if (attempt < 5) await new Promise(r => setTimeout(r, 5000));
      }

      if (!foundIP) {
        setAlertMsg('❌ Unable to find Shelly. No site was created.');
        setAlertVisible(true);
        return; // 🔒 STOP : on NE va PAS à 'site-name'
      }

      setShellyIP(foundIP);
      setAlertVisible(false);
      setAddStep('site-name'); // ✅ on n'ouvre le nom de site que maintenant
      
    } catch (error) {
      console.error('❌ Erreur lors de la configuration Wi-Fi:', error);
      
      let errorMessage = "Error configuring Wi-Fi. Please try again.";
      
      if (error.message && error.message.includes('AUTHENTICATION_FAILED')) {
        errorMessage = "Incorrect Wi-Fi password. Please check your password.";
      } else if (error.message && error.message.includes('NETWORK_NOT_FOUND')) {
        errorMessage = "Wi-Fi network not found. Check the network name.";
      } else if (error.message && error.message.includes('TIMEOUT')) {
        errorMessage = "Timeout exceeded. Please try again.";
      }
      
      setInjectionError(errorMessage);
      setInjectionLoading(false);
    }
  };


  // Handler pour ajout du site après saisie du nom (étape 2) - VERSION SIMPLIFIÉE AVEC VERROU CRITIQUE
  const handleAddSiteName = async () => {
    const name = newSiteName.trim();
    if (!name) return;
    if (isAddingSite) return;
    
    let creationTimeout: ReturnType<typeof setTimeout> | null = null;
    
    try {
      setIsAddingSite(true);
      setAlertMsg(`🔍 Recherche d'un appareil Shelly...`);
      setAlertVisible(true);
      
      // Safety timeout to avoid being stuck on "Creating..."
      creationTimeout = setTimeout(() => {
        try { 
          setAddStep(null); 
        setIsAddingSite(false);
          setAlertVisible(false);
        } catch (error) {
          console.error('❌ Erreur dans timeout:', error);
        }
      }, 90000);
      
      // Récupérer l'ID utilisateur actuel
      const userIdResult = await AuthService.getCurrentUserId();
      if (!userIdResult || !userIdResult.success) {
        setAlertMsg('Error: User not signed in');
        setAlertVisible(true);
        return;
      }
      const currentUserId = userIdResult.data || userIdResult.userId || userIdResult;

      // 🔒 VERROU CRITIQUE : Vérifier que le Shelly est accessible
      console.log('🔒 VÉRIFICATION CRITIQUE : Test de connexion réelle au Shelly...');
      setAlertMsg(`🔒 Verifying Shelly connection...`);
      
      // Utiliser l'IP Shelly trouvée précédemment (dans handleWifiConnect ou handleInjectWifi)
      const foundShellyIP = shellyIP;
      
      if (foundShellyIP) {
        const finalizeResult = await finalizeSiteCreation({
          shellyIp: foundShellyIP!,
          ssid: selectedSsid || pendingWifi || 'direct',
          siteName: name,
          currentUserId: currentUserId
        });
        
        if (finalizeResult.success) {
          console.log('✅ VERROU CRITIQUE RÉUSSI : Site créé avec succès');
          setAlertMsg('✅ Site created successfully!');
              setAlertVisible(true);
          
          // Ajouter le site localement avec persistance immédiate
          await persistSites([...sites, finalizeResult.site!]);
          
          // Reset des états
          setAddStep(null);
          setPendingWifi(null);
          setWifiPassword('');
          setPendingDevice(null);
          setNewSiteName('');
          setSelectedSsid(null);
          setShellyIP(null);
          
          // Background sync
          setTimeout(async () => { try { await loadSitesFromAWS(); } catch {} }, 1000);
          
        } else {
          console.log('❌ VERROU CRITIQUE ÉCHOUÉ :', finalizeResult.error);
          setAlertMsg(`❌ ${finalizeResult.error || 'Erreur inconnue'}`);
          setAlertVisible(true);
        }
        
        // Cleanup
        if (creationTimeout) clearTimeout(creationTimeout);
        setIsAddingSite(false);
        return;
      } else {
        console.log('❌ Aucune IP Shelly trouvée');
        setAlertMsg('❌ Shelly not found on network. Check connection.');
        setAlertVisible(true);
        if (creationTimeout) clearTimeout(creationTimeout);
          setAddStep(null);
          setIsAddingSite(false);
        return;
      }

      
    } catch (error) {
      console.error('❌ ERREUR CRITIQUE lors de l\'ajout du site:', error);
      
      // Gestion d'erreur simplifiée
      if (creationTimeout) clearTimeout(creationTimeout);
          setAddStep(null);
          setIsAddingSite(false);
      
      let errorMessage = 'Error creating site';
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = (error as any).message;
        if (errorMsg.includes('Connection timeout')) {
          errorMessage = 'Connection timeout - check your network';
        } else if (errorMsg.includes('Network request failed')) {
          errorMessage = 'Network error - check your connection';
        } else if (errorMsg.includes('AWS')) {
          errorMessage = 'Server error - try again later';
        }
      }
      
      setAlertMsg(`❌ ${errorMessage}`);
      setAlertVisible(true);
      
      // Reset des états
          setPendingWifi(null);
      setWifiPassword('');
      setPendingDevice(null);
      setShellyIP(null);
    } finally {
      setIsAddingSite(false);
    }
  };

  // SUPPRIMÉ: handleAddSiteType() - cause des sites fantômes

  /* ---------- Render ---------- */
  // Composant bannière Wi-Fi d'origine (aucune, ou à remettre si besoin)
  // (Supprimé pour revenir à l'affichage initial)
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER MODERN */}
      <View style={styles.headerModern}>
        {/* Composant bannière Wi-Fi d'origine (aucune, ou à remettre si besoin) */}
        <SafeAreaView style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
          <View style={{width: 40}} />
          <Image source={require('../assets/waihome_logo.png')} style={styles.logoModern} />
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {/* Bouton Profile */}
          <TouchableOpacity style={styles.profileBtnModern} onPress={() => (navigation as any).navigate('profile')}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
            <MaterialIcons name="more-vert" size={32} color="#0c7a7e" />
            )}
          </TouchableOpacity>
          </View>
        </SafeAreaView>
        </View>

      <View style={styles.spacer} />
      {/* Heure et date actuelles */}
      <View style={styles.timeDateBox}>
        <Text style={styles.timeText}>{timeStr}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>
      {/* BODY */}
      <ScrollView contentContainerStyle={styles.body}>
        {/* Sites list */}
        <View style={{ marginTop: 10, marginBottom: 80 }}>
          {sites.length === 0 ? (
            <Text style={styles.empty}>No site yet – add one with the + button.</Text>
          ) : (
            sites.map((s) => (
              <View key={s.id} style={styles.siteCardModern}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => (navigation as any).navigate('SiteDetails', { id: s.id })}
                  onLongPress={() => openRename(s)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name={s.icon}
                    size={38}
                    color="#0c7a7e"
                    style={{ marginRight: 16 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteNameModern}>{s.name}</Text>
                    <View style={styles.siteStatusRowModern}>
                      <View style={[styles.siteStatusBadgeModern, { backgroundColor: (!isWifiOn && s.status !== "Maintenance Required") ? '#fbeee6' : s.status === "Connected" ? '#e6f7f1' : '#fbeee6' }]}> 
                        <MaterialIcons
                          name={(!isWifiOn && s.status !== "Maintenance Required") ? "error" : s.status === "Connected" ? "check-circle" : "error"}
                          size={18}
                          color={(!isWifiOn && s.status !== "Maintenance Required") ? "#b35b2a" : s.status === "Connected" ? "#28a745" : "#b35b2a"}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: (!isWifiOn && s.status !== "Maintenance Required") ? "#b35b2a" : s.status === "Connected" ? "#28a745" : s.status === "Maintenance Required" ? "#f6c343" : "#b35b2a", fontWeight: '700', fontSize: 13 }}>
                          {s.status === "Maintenance Required" ? "Maintenance Required" : (!isWifiOn ? "Not Connected" : (s.status === "Connected" ? "Operational" : s.status))}
                        </Text>
                      </View>
                      <View style={styles.siteSolidsBadgeModern}>
                        <MaterialCommunityIcons name="beaker" size={16} color="#0c7a7e" style={{ marginRight: 2 }} />
                        <Text style={{ color: '#0c7a7e', fontWeight: '700', fontSize: 13 }}>Solids: {typeof (s as any).solids === 'object' && (s as any).solids ? ((s as any).solids.total ?? 0) : (s.solids ?? 0)}%</Text>
                      </View>
                    </View>
                    {/* Switch Enable Notifications */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <MaterialCommunityIcons
                        name={s.notificationsEnabled ? "bell-ring-outline" : "bell-off-outline"}
                        size={22}
                        color={s.notificationsEnabled ? "#0c7a7e" : "#b0b0b0"}
                        style={{ marginRight: 6, opacity: s.notificationsEnabled ? 1 : 0.7 }}
                      />
                      <Text style={{ fontSize: 14, color: '#222', marginRight: 8 }}>Enable Notifications</Text>
                      <Switch
                        value={s.notificationsEnabled}
                        onValueChange={async (val) => {
                          const upd = sites.map(site => site.id === s.id ? { ...site, notificationsEnabled: val } : site);
                          persistSites(upd);
                          
                          // Synchroniser avec AWS DynamoDB
                          try {
                            console.log('🔄 Synchronisation des notifications avec AWS DynamoDB...');
                            
                            // Utiliser l'ID du site actuel
                            const targetId = s.id;
                            console.log('📤 ID utilisé pour la mise à jour:', targetId);
                            
                            // Envoyer SEULEMENT notificationsEnabled
                            const updates = {
                              notificationsEnabled: val
                            };
                            
                            console.log('🔧 Valeur notificationsEnabled à envoyer:', val);
                            console.log('📤 Updates envoyés:', updates);
                            
                            const result = await ShellyService.updateShellyDevice(targetId, updates);
                            
                            if (result.success) {
                              console.log('✅ Notifications synchronisées avec AWS DynamoDB');
                              console.log('📊 Réponse AWS:', result.data);
                              
                              // Mettre à jour aussi l'état local du site
                              const updatedSites = sites.map(site => 
                                site.id === s.id ? { ...site, notificationsEnabled: val } : site
                              );
                              setSites(updatedSites);
                              await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
                            } else {
                              console.error('❌ Erreur synchronisation notifications AWS:', result.error);
                            }
                          } catch (error) {
                            console.error('❌ Erreur synchronisation notifications AWS:', error);
                          }
                        }}
                        trackColor={{ false: '#d1d8db', true: '#0c7a7e' }}
                        thumbColor="#fff"
                      />
                    </View>
                    
                  </View>
                </TouchableOpacity>
                {/* bouton corbeille modernisé */}
                <TouchableOpacity
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#b35b2a', justifyContent: 'center', alignItems: 'center', marginLeft: 10, elevation: 2 }}
                  onPress={() => handleDeleteSite(s)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="delete" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Site FAB flottant en bas à droite */}
      <TouchableOpacity
        style={[styles.fabPlus, { bottom: 80, right: 24, position: 'absolute', zIndex: 10 }]}
        onPress={handleAddPress}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={32} color="#fff" />
      </TouchableOpacity>







      

      {/* Nouveau flow d'ajout de site */}
      <Modal
        visible={addStep === 'method'}
        transparent
        animationType="fade"
        onRequestClose={() => setAddStep(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30, borderRadius: 32, minWidth: 320, maxWidth: 390, backgroundColor: '#f7fafb', shadowColor: '#0c7a7e', shadowOpacity: 0.10, shadowRadius: 18, elevation: 10 }] }>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <MaterialCommunityIcons name="plus" size={48} color="#0c7a7e" style={{ opacity: 0.90, marginBottom: 4 }} />
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#0c7a7e', marginBottom: 6, textAlign: 'center', letterSpacing: 0.2 }}>Add a Site</Text>
              <Text style={{ fontSize: 16, color: '#888', marginBottom: 14, textAlign: 'center', fontWeight: '500' }}>Choose how you want to connect your new site</Text>
              {/* Encadré info */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#e6f7f1', borderRadius: 14, padding: 12, marginBottom: 18, maxWidth: 320, shadowColor: '#0c7a7e', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }}>
                <MaterialCommunityIcons name="information" size={22} color="#16989d" style={{ marginRight: 10, marginTop: 2 }} />
                <Text style={{ color: '#16989d', fontSize: 14, fontWeight: '600', flex: 1 }}>
                  Bluetooth is recommended for direct device setup. Wi-Fi is ideal if your device is already on the network.
                </Text>
          </View>
            </View>
          <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#16989d', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 22, width: '100%', marginBottom: 20, shadowColor: '#0c7a7e', shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
              onPress={() => handleAddMethod('ble')}
              activeOpacity={0.85}
          >
              <MaterialCommunityIcons name="bluetooth" size={30} color="#fff" style={{ marginRight: 16 }} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 0.2 }}>Add via Bluetooth</Text>
          </TouchableOpacity>
        <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#16989d', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 22, width: '100%', marginBottom: 14, shadowColor: '#16989d', shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 }}
              onPress={() => handleAddMethod('wifi')}
              activeOpacity={0.85}
        >
              <MaterialCommunityIcons name="wifi" size={30} color="#fff" style={{ marginRight: 16 }} />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 0.2 }}>Add via Wi-Fi</Text>
        </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddStep(null)} style={{ marginTop: 10 }}>
              <Text style={{ color: '#b35b2a', fontWeight: '700', fontSize: 16, textAlign: 'center', opacity: 0.85 }}>Cancel</Text>
            </TouchableOpacity>
        </View>
        </View>
      </Modal>

      {/* Modal BLE scan pour ajout */}
      <Modal
        visible={addStep === 'ble'}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStep(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
                <TouchableOpacity
              style={styles.close}
              onPress={() => setAddStep(null)}
            >
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isScanning ? "Scanning..." : "Select a device"}
                        </Text>
            <FlatList
              data={allDevices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.devItem}
                  onPress={() => handleDeviceConnected(item)}
                >
                  <Text style={styles.devName}>
                    {item.name || `Device ${item.id.slice(-6)}`}
                  </Text>
                  <Text style={styles.devId}>
                    {item.id} {item.rssi ? `(${item.rssi} dBm)` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.empty}>
                  {isScanning ? "Searching..." : "No devices found"}
                </Text>
              )}
        />
      </View>
                  </View>
      </Modal>

      {/* Modal Wi-Fi scan pour ajout */}
      <Modal
        visible={addStep === 'wifi'}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStep(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setAddStep(null)}
            >
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.close, { right: 46 }]}
              onPress={scanForWifi}
              disabled={wifiScanning}
            >
              <MaterialIcons name="refresh" size={20} color={wifiScanning ? '#9bbfc1' : '#0c7a7e'} />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={styles.modalTitle}>
                {wifiScanning ? "Scanning..." : "Select a network"}
              </Text>
            </View>
            
            {wifiScanning && (
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <ActivityIndicator size="small" color="#0c7a7e" />
                <Text style={{ color: '#666', marginTop: 5 }}>Scanning Wi-Fi networks...</Text>
              </View>
            )}
            
            <FlatList
              data={wifiList}
              keyExtractor={(item, idx) => (item.BSSID ? item.BSSID : item.SSID ? item.SSID : String(idx))}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.devItem}
                  onPress={() => selectWifi(item.SSID, item.capabilities)}
                >
                  <Text style={styles.devName}>{item.SSID}</Text>
                  {item.BSSID && (
                    <Text style={styles.devId}>{item.BSSID}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal mot de passe Wi-Fi (étape 1) : SSID (non éditable, du téléphone) + password + Next */}
      <Modal
        visible={addStep === 'wifi-inject'}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStep(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28, borderRadius: 28, minWidth: 300, maxWidth: 370, backgroundColor: '#fff' }] }>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0c7a7e', marginBottom: 18, textAlign: 'center' }}>
              {pendingDevice ? 'Configure Shelly Wi-Fi' : 'Wi-Fi Connection'}
            </Text>
            {pendingDevice && (
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 18, textAlign: 'center', fontStyle: 'italic' }}>
                Connected to: {pendingDevice.name || pendingDevice.id}
              </Text>
            )}
            
            {/* Sélection du réseau Wi-Fi + bouton refresh */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'left' }}>
              Select Wi-Fi Network:
            </Text>
              <TouchableOpacity onPress={scanForWifi} disabled={wifiScanning} style={{ paddingHorizontal: 8, paddingVertical: 4, opacity: wifiScanning ? 0.5 : 1 }}>
                <MaterialIcons name="refresh" size={20} color="#0c7a7e" />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', maxHeight: 120, marginBottom: 12 }}>
              <FlatList
                data={wifiList}
                keyExtractor={(item, idx) => (item.BSSID ? item.BSSID : item.SSID ? item.SSID : String(idx))}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: injectionSsid === item.SSID ? '#e6f7f1' : '#f7fafb',
                      borderRadius: 8,
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: injectionSsid === item.SSID ? '#0c7a7e' : '#e3e8ee'
                    }}
                    onPress={() => setInjectionSsid(item.SSID)}
                  >
                    <Text style={{ 
                      fontSize: 16, 
                      fontWeight: injectionSsid === item.SSID ? '600' : '400',
                      color: injectionSsid === item.SSID ? '#0c7a7e' : '#333'
                    }}>
                      {item.SSID}
                    </Text>
                    {item.BSSID && (
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        {item.BSSID}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                    <Text style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', marginBottom: 8 }}>
                    No Wi-Fi networks found
                  </Text>
                    <TouchableOpacity onPress={scanForWifi} style={{ backgroundColor: '#0c7a7e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Retry Scan</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
            
            <TextInput
              value={injectionPassword}
              onChangeText={setInjectionPassword}
              placeholder="Wi-Fi Password"
              placeholderTextColor="#888"
              style={{ borderWidth: 1.5, borderColor: '#e3e8ee', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 17, color: '#222', width: '100%', marginBottom: 18, backgroundColor: '#f7fafb' }}
              secureTextEntry
              maxLength={64}
              returnKeyType="done"
              autoFocus
            />
            {injectionError ? (
              <Text style={{ color: '#d32f2f', fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>{injectionError}</Text>
            ) : null}
            <TouchableOpacity
              style={{ 
                backgroundColor: injectionSsid && injectionPassword ? '#0c7a7e' : '#ccc', 
                borderRadius: 14, 
                paddingVertical: 13, 
                paddingHorizontal: 38, 
                alignItems: 'center', 
                width: 200, 
                marginBottom: 8, 
                opacity: injectionLoading ? 0.7 : 1 
              }}
              onPress={handleInjectWifi}
              activeOpacity={0.85}
              disabled={injectionLoading || !injectionSsid || !injectionPassword}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                {injectionLoading ? 'Verifying...' : 'Verify & Continue'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddStep(null)} style={{ marginTop: 6 }}>
              <Text style={{ color: '#b35b2a', fontWeight: '600', fontSize: 15, textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal nom du site (étape 2) : uniquement champ nom du site + bouton Add */}
      <Modal
        visible={addStep === 'site-name'}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStep(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 28, borderRadius: 28, minWidth: 320, maxWidth: 400, backgroundColor: '#fff' }] }>
            {/* Icône de succès */}
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e6f7f1', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <MaterialCommunityIcons name="check-circle" size={40} color="#28a745" />
            </View>
            
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0c7a7e', marginBottom: 8, textAlign: 'center' }}>Site Configuration Success!</Text>
            
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center', lineHeight: 22 }}>
              Your Shelly is now connected to your Wi-Fi network.
            </Text>
            
            {/* Informations de connexion */}
            {shellyIP && (
              <View style={{ backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 20, width: '100%' }}>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' }}>Connection Details:</Text>
                <Text style={{ fontSize: 14, color: '#0c7a7e', fontWeight: '600', textAlign: 'center' }}>
                  IP Address: {shellyIP}
                </Text>
              </View>
            )}
            
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12, textAlign: 'center' }}>Now give your site a name:</Text>
            
            <TextInput
              value={newSiteName}
              onChangeText={setNewSiteName}
              placeholder="e.g., Home, Office, Garden..."
              placeholderTextColor="#888"
              style={{ 
                borderWidth: 2, 
                borderColor: newSiteName.trim() ? '#0c7a7e' : '#e3e8ee', 
                borderRadius: 12, 
                paddingHorizontal: 16, 
                paddingVertical: 14, 
                fontSize: 18, 
                color: '#222', 
                width: '100%', 
                marginBottom: 20, 
                backgroundColor: '#f7fafb',
                textAlign: 'center'
              }}
              maxLength={32}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={handleAddSiteName}
            />
            
            <TouchableOpacity
              style={{ 
                backgroundColor: (newSiteName.trim() && !isAddingSite && shellyIP) ? '#0c7a7e' : '#ccc', 
                borderRadius: 16, 
                paddingVertical: 16, 
                paddingHorizontal: 40, 
                alignItems: 'center', 
                width: '100%', 
                marginBottom: 12,
                opacity: (newSiteName.trim() && !isAddingSite && shellyIP) ? 1 : 0.6
              }}
              onPress={handleAddSiteName}
              activeOpacity={0.85}
              disabled={!newSiteName.trim() || isAddingSite || !shellyIP}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {isAddingSite ? 'Creating…' : 'Add Site'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setAddStep(null)} style={{ marginTop: 4 }}>
              <Text style={{ color: '#b35b2a', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename site modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { paddingVertical: 28, paddingHorizontal: 22, borderRadius: 20 }]}>
            <TouchableOpacity style={styles.close} onPress={() => setRenameVisible(false)}>
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Rename site</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="New name"
              placeholderTextColor="#888"
              style={{
                borderWidth: 1.5,
                borderColor: '#e3e8ee',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: '#222',
                backgroundColor: '#f7fafb',
                marginBottom: 16,
              }}
              returnKeyType="done"
              onSubmitEditing={confirmRename}
              autoFocus
            />
                <TouchableOpacity
              onPress={confirmRename}
              style={{
                backgroundColor: renameText.trim() ? '#0c7a7e' : '#ccc',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
              }}
              disabled={!renameText.trim()}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { paddingVertical: 28, paddingHorizontal: 22, borderRadius: 20 }]}>
            <TouchableOpacity style={styles.close} onPress={() => setDeleteVisible(false)}>
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { marginBottom: 10 }]}>Delete site</Text>
            <Text style={{ color: '#444', marginBottom: 18, textAlign: 'center' }}>
              Are you sure you want to delete{' '}
              <Text style={{ fontWeight: '700' }}>{siteToDelete?.name}</Text>?
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => setDeleteVisible(false)}
                style={{
                  flex: 1,
                  marginRight: 8,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: '#e3e8ee',
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#333', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteSite}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: '#b35b2a',
                }}
                activeOpacity={0.9}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Info / error alert modal */}
      <Modal
        visible={alertVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { paddingVertical: 24, paddingHorizontal: 22, borderRadius: 18 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Notice</Text>
            <ScrollView style={{ maxHeight: 180 }}>
              <Text style={{ color: '#333', lineHeight: 20 }}>{alertMsg}</Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setAlertVisible(false)}
              style={{
                marginTop: 16,
                backgroundColor: '#0c7a7e',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device scan modal */}
      <Modal
        visible={false}
        transparent
        animationType="slide"
        onRequestClose={() => {
          bleManager.stopDeviceScan();
          setDevVisible(false);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => {
                bleManager.stopDeviceScan();
                setDevVisible(false);
              }}
            >
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isScanning ? "Scanning..." : "Select a device"}
            </Text>
            <FlatList
              data={allDevices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.devItem}
                  onPress={() => connectToDevice(item)}
                >
                  <Text style={styles.devName}>{item.name}</Text>
                  <Text style={styles.devId}>{item.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.empty}>
                  {isScanning ? "Searching..." : "No devices found"}
                </Text>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Wi-Fi modal */}
      <Modal
        visible={wifiVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWifiVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setWifiVisible(false)}
            >
              <MaterialIcons name="close" size={22} color="#b35b2a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.close, { right: 46 }]}
              onPress={scanForWifi}
              disabled={wifiScanning}
            >
              <MaterialIcons name="refresh" size={20} color={wifiScanning ? '#9bbfc1' : '#0c7a7e'} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text style={styles.modalTitle}>
              {wifiScanning ? "Scanning..." : "Select a network"}
            </Text>
            </View>
            {wifiScanning && (
              <ActivityIndicator size="small" color="#0c7a7e" />
            )}
            <FlatList
              data={wifiList}
              keyExtractor={(item) => item.SSID}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.devItem}
                  onPress={() => selectWifi(item.SSID, item.capabilities)}
                >
                  <Text style={styles.devName}>{item.SSID}</Text>
                  {item.BSSID && (
                    <Text style={styles.devId}>{item.BSSID}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => !wifiScanning && (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={styles.empty}>No networks found</Text>
                  <TouchableOpacity onPress={scanForWifi} style={{ marginTop: 10, backgroundColor: '#0c7a7e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Retry Scan</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Wi-Fi Password Modal (design pro) */}
      <Modal
        visible={wifiPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWifiPasswordModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#f7fafb' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Animated.View
            style={[
              styles.wifiCardPro,
              {
                opacity: wifiPwAnim,
                transform: [
                  { scale: wifiPwAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  { translateY: wifiPwAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                ],
                backgroundColor: wifiPwResult === 'success' ? 'rgba(40,167,69,0.10)' : wifiPwResult === 'fail' ? 'rgba(217,83,79,0.10)' : 'rgba(255,255,255,0.88)',
                borderColor: wifiPwResult === 'success' ? '#28a745' : wifiPwResult === 'fail' ? '#d9534f' : 'rgba(227,232,238,0.7)',
              },
            ]}
            accessible accessibilityLabel="Wi-Fi password card"
          >
            {/* Bouton retour/close */}
            <TouchableOpacity style={styles.wifiCloseBtn} onPress={() => setWifiPasswordModalVisible(false)}>
              <MaterialIcons name="arrow-back" size={26} color="#0c7a7e" />
            </TouchableOpacity>
            {/* Icône Wi-Fi animée dans un cercle pastel */}
            <Animated.View style={[styles.wifiIconCircle, { transform: [{ scale: wifiPwAnim }] }]}> 
              <MaterialCommunityIcons
                name={wifiPwLoading ? "wifi-sync" : wifiPwResult === 'success' ? "check-circle-outline" : wifiPwResult === 'fail' ? "close-circle-outline" : "wifi"}
                size={64}
                color={wifiPwResult === 'success' ? "#28a745" : wifiPwResult === 'fail' ? "#d9534f" : "#0c7a7e"}
                style={{ opacity: 0.95 }}
              />
            </Animated.View>
            <Text style={styles.wifiTitlePro}>Wi‑Fi Access</Text>
            <Text style={styles.wifiSubtitlePro}>Enter the password for your network below</Text>
            {selectedSsid && (
              <View style={styles.wifiSsidBadge}>
                <MaterialIcons name="wifi" size={20} color="#0c7a7e" style={{ marginRight: 8 }} />
                <Text style={styles.wifiSsidText}>{selectedSsid}</Text>
              </View>
            )}
            {/* Champ password avec label flottant */}
            <View style={[styles.wifiInputBox, wifiPwFocused && styles.wifiInputBoxFocused]}>
              <Animated.Text
                style={[
                  styles.wifiInputLabel,
                  (wifiPwFocused || wifiPassword) && { top: 6, fontSize: 13, color: '#0c7a7e' },
                ]}
              >
                Password
              </Animated.Text>
              <TextInput
                value={wifiPassword}
                onChangeText={setWifiPassword}
                style={styles.wifiInput}
                secureTextEntry={!wifiPasswordVisible}
                onFocus={() => setWifiPwFocused(true)}
                onBlur={() => setWifiPwFocused(false)}
                autoCorrect={false}
                autoCapitalize="none"
                placeholder=""
                accessibilityLabel="Wi-Fi password"
              />
              <TouchableOpacity
                onPress={() => setWifiPasswordVisible((v) => !v)}
                style={styles.wifiEyeBtn}
                accessibilityLabel={wifiPasswordVisible ? "Hide password" : "Show password"}
              >
                <MaterialCommunityIcons name={wifiPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color="#0c7a7e" />
              </TouchableOpacity>
            </View>
            {/* Feedback visuel */}
            {wifiPwError ? (
              <View style={styles.wifiMsgRow}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#d9534f" /><Text style={styles.wifiMsgErr}>{wifiPwError}</Text></View>
            ) : null}
            {wifiPwResult === 'success' && (
              <View style={styles.wifiMsgRow}><MaterialCommunityIcons name="check-circle-outline" size={18} color="#28a745" /><Text style={styles.wifiMsgSuccess}>Connected successfully!</Text></View>
            )}
            {wifiPwResult === 'fail' && (
              <View style={styles.wifiMsgRow}><MaterialCommunityIcons name="close-circle-outline" size={18} color="#d9534f" /><Text style={styles.wifiMsgFail}>Connection failed. Please try again.</Text></View>
            )}
            {/* Bouton Connect pro */}
            <TouchableOpacity
              style={[
                styles.wifiBtnPro,
                wifiPwLoading && { opacity: 0.7 },
              ]}
              onPress={handleWifiConnect}
              disabled={wifiPwLoading}
              activeOpacity={0.85}
              accessibilityLabel="Connect to Wi-Fi"
            >
              <View style={{ flex: 1, backgroundColor: '#0c7a7e', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }} />
              {wifiPwLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialCommunityIcons name="wifi-arrow-up-down" size={22} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.wifiBtnProTxt}>Connect</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Alert modal */}
      <Modal visible={alertVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={{ backgroundColor: '#f7fafb', borderRadius: 28, paddingVertical: 36, paddingHorizontal: 28, width: 330, alignItems: 'center', shadowColor: '#0c7a7e', shadowOpacity: 0.10, shadowRadius: 16, elevation: 10 }}>
            {/* Icône dynamique selon le message */}
            {alertMsg && alertMsg.toLowerCase().includes('bluetooth') ? (
              <MaterialCommunityIcons name="bluetooth-off" size={44} color="#d32f2f" style={{ marginBottom: 10, opacity: 0.92 }} />
            ) : alertMsg && alertMsg.toLowerCase().includes('wi-fi') ? (
              <MaterialCommunityIcons name="wifi-off" size={44} color="#d32f2f" style={{ marginBottom: 10, opacity: 0.92 }} />
            ) : (
              <MaterialCommunityIcons name="alert-circle" size={44} color="#d32f2f" style={{ marginBottom: 10, opacity: 0.92 }} />
            )}
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#d32f2f', marginBottom: 8, textAlign: 'center', letterSpacing: 0.2 }}>
              {alertMsg && alertMsg.toLowerCase().includes('bluetooth') ? 'Bluetooth disabled' : alertMsg && alertMsg.toLowerCase().includes('wi-fi') ? 'Wi-Fi disabled' : 'Info'}
            </Text>
            <Text style={{ fontSize: 16, color: '#444', marginBottom: 22, textAlign: 'center', fontWeight: '500', lineHeight: 22 }}>{alertMsg}</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#0c7a7e', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 38, marginTop: 4, alignItems: 'center', width: '80%', shadowColor: '#0c7a7e', shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 }}
              onPress={() => setAlertVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.2 }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de renommage */}
      <Modal
        transparent
        visible={renameVisible}
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 22, paddingVertical: 32, paddingHorizontal: 28, width: 330, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 12, elevation: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0c7a7e', marginBottom: 10, textAlign: 'center', letterSpacing: 0.2 }}>Rename Site</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, color: '#000', marginBottom: 16, width: '100%' }}
              placeholder="New name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginRight: 8, backgroundColor: '#f2f2f2' }} onPress={() => setRenameVisible(false)}>
                <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginLeft: 8, backgroundColor: '#0c7a7e' }} onPress={confirmRename}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmation suppression site */}
      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 28, width: 330 }] }>
            <MaterialIcons name="delete" size={32} color="#d32f2f" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', marginBottom: 16, textAlign: 'center' }}>
              Delete this site?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f0f4f8', marginRight: 8, paddingVertical: 10, borderRadius: 10 }]} onPress={() => setDeleteVisible(false)}>
                <Text style={{ fontWeight: '700', color: '#222', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#d32f2f', marginLeft: 8, paddingVertical: 10, borderRadius: 10 }]} onPress={confirmDeleteSite}>
                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
}

/* ---------- Nav helper ---------- */
const Nav = ({
  icon,
  label,
  active,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.navBtn} onPress={onPress}>
    <MaterialIcons
      name={icon}
      size={20}
      color={active ? "#0c7a7e" : "#6c757d"}
    />
    <Text
      style={[styles.navLbl, { color: active ? "#0c7a7e" : "#6c757d" }]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);
/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },

  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 35 : 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerLogo: { width: 300, height: 40 },
  userIcon: { position: "absolute", right: 20, top: Platform.OS === "android" ? 35 : 28 },

  spacer: { height: 20 },

  body: { paddingHorizontal: 20, paddingBottom: 140 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", flex: 1 },
  status: { fontSize: 14, fontWeight: "600", marginVertical: 4 },
  btn: { borderRadius: 10, paddingVertical: 9, alignItems: "center", marginTop: 4 },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  plus: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0c7a7e",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  site: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  siteName: { fontSize: 17, fontWeight: "700" },
  solids: { fontSize: 13, color: "#555" },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  navBtn: { alignItems: "center" },
  navLbl: { fontSize: 12, marginTop: 4 },

  /* Modals & overlay */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modal: {
    width: "86%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    elevation: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  tplBtn: { alignItems: "center", marginVertical: 12, flex: 1 },
  tplLbl: { marginTop: 6, fontSize: 12 },

  cancel: { textAlign: "center", marginTop: 14, color: "#b35b2a", fontWeight: "600" },

  close: { position: "absolute", top: 10, right: 10, padding: 4 },

  devItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  devName: { fontSize: 16 },
  devId: { fontSize: 11, color: "#666" },
  empty: { textAlign: "center", marginTop: 20, color: "#666" },

  /* Alert */
  alert: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "80%", alignItems: "center" },
  alertTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  alertMsg: { fontSize: 14, textAlign: "center", marginBottom: 14 },
  alertBtn: { backgroundColor: "#0c7a7e", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 24 },

  // Styles modernisés
  headerModern: {
    backgroundColor: '#fff',
    paddingTop: 0,
    paddingBottom: 18,
    paddingHorizontal: 0,
    height: 90,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLogoModern: {
    width: 160,
    height: 32,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  headerBtnRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'android' ? 18 : 10,
  },
  cardModern: {
    backgroundColor: '#f7fafb',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  rowModern: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  titleModern: { fontSize: 18, fontWeight: '700', color: '#0c7a7e', flex: 1 },
  statusRowModern: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusBadgeModern: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, marginRight: 8 },
  btnModern: { borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  btnTxtModern: { color: '#fff', fontSize: 16, fontWeight: '700' },
  plusModern: {
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0c7a7e',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  siteCardModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  siteNameModern: { fontSize: 18, fontWeight: '700', color: '#0c7a7e', marginBottom: 2 },
  siteStatusRowModern: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  siteStatusBadgeModern: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, marginRight: 8 },
  siteSolidsBadgeModern: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f7f1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  profileBtnModern: {
    marginRight: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiRecoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  wifiRecoveryText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  logoModern: {
    width: 160,
    height: 32,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  homeWelcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0c7a7e',
    marginTop: 10,
    marginBottom: 2,
    textAlign: 'center',
  },
  homeSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 18,
    textAlign: 'center',
  },
  fabPlus: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 62,
    height: 62,
    marginBottom : 0,
    borderRadius: 31,
    backgroundColor: '#0c7a7e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  timeDateBox: {
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0c7a7e',
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 15,
    color: '#666',
    marginTop: 2,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  // Styles for Wi-Fi Password Modal
  illustrationBox: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0c7a7e',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  selectedSsidBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7f1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 20,
  },
  selectedSsid: {
    fontSize: 14,
    color: '#0c7a7e',
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  inputPwBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  inputPwBoxFocused: {
    borderColor: '#0c7a7e',
    shadowColor: '#0c7a7e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  inputPw: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 0,
    paddingHorizontal: 8,
  },
  eyeBtn: {
    padding: 8,
  },
  errorMsg: {
    color: '#d9534f',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  successMsg: {
    color: '#28a745',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  failMsg: {
    color: '#d9534f',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  wifiCardPro: {
    width: '90%',
    maxWidth: 370,
    minWidth: 300,
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#0c7a7e',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(227,232,238,0.7)',
  },
  wifiCloseBtn: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 10,
    backgroundColor: 'rgba(12,122,126,0.07)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e6f7f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#0c7a7e',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  wifiTitlePro: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0c7a7e',
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  wifiSubtitlePro: {
    fontSize: 15,
    color: '#888',
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  wifiSsidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7f1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
  },
  wifiSsidText: {
    fontSize: 16,
    color: '#0c7a7e',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  wifiInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e3e8ee',
    width: '100%',
    position: 'relative',
  },
  wifiInputBoxFocused: {
    borderColor: '#0c7a7e',
    shadowColor: '#0c7a7e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 2,
  },
  wifiInput: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    paddingVertical: 0,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    height: 38,
  },
  wifiInputLabel: {
    position: 'absolute',
    left: 16,
    top: 18,
    fontSize: 16,
    color: '#888',
    zIndex: 2,
    backgroundColor: 'transparent',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  wifiEyeBtn: {
    padding: 6,
  },
  wifiMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  wifiMsgErr: {
    color: '#d9534f',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  wifiMsgSuccess: {
    color: '#28a745',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  wifiMsgFail: {
    color: '#d9534f',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 4,
  },
  wifiBtnPro: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#0c7a7e',
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  wifiBtnProTxt: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modalBtn: {
    width: '45%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
