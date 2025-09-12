// app/SiteDetails.tsx
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
  Alert,
  Modal,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
} from "@expo/vector-icons";
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";
import { ShellyService } from '../services/shellyService';
import { AuthService } from '../services/authService';
import { remoteControlService } from '../services/remoteControlService';
import { updateComponentDetailed, ensureDetailedComponents, DetailedComponents } from '../lib/utils/componentUtils';
import * as Network from 'expo-network';

/* ---------- Types ---------- */
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
interface SiteInfo {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
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
    components?: DetailedComponents & {
      emergency?: boolean;
      binReplaced?: boolean;
      heaterStarted?: boolean;
    };
    waterUsage?: {
      daily?: { [date: string]: number };
      timestamp?: number;
    };
  };
}

/* ---------- Reusable line-area graph ---------- */
const LineArea = ({
  data,
  max,
  color,
  width = 300,
  height = 140,
  xLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}: {
  data: number[];
  max: number;
  color: string;
  width?: number;
  height?: number;
  xLabels?: string[];
}) => {
  // Générer les labels Y (graduations) avec des valeurs plus lisibles
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const value = max - (max / ySteps) * i;
    return value < 10 ? value.toFixed(1) : Math.round(value);
  });

  const yAxisWidth = 30;
  const chartWidth = width;
  const chartHeight = height;

  // Créer des points de données avec des coordonnées
  const points = data.map((v, i) => ({
    x: (chartWidth / (data.length - 1)) * i,
    y: chartHeight - (v / max) * chartHeight,
    value: v
  }));

  const path = points
    .map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`)
    .join("");

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {/* Axe Y amélioré */}
      <View style={{ width: yAxisWidth, height: chartHeight + 24, justifyContent: 'space-between' }}>
        {yLabels.map((label, i) => (
          <Text key={i} style={{ 
            fontSize: 10, 
            color: '#6c757d', 
            position: 'absolute', 
            top: (chartHeight / ySteps) * i - 6, 
            right: 4,
            fontWeight: '500'
          }}>
            {label}
          </Text>
        ))}
      </View>
      
      {/* Courbe et axe X */}
      <View style={{ marginLeft: -8 }}>
        <Svg width={chartWidth} height={chartHeight + 24}>
          {/* Grille horizontale améliorée */}
          {yLabels.map((_, i) => {
            const y = (chartHeight / ySteps) * i;
        return (
          <Line
                key={i}
                x1={0}
                x2={chartWidth}
            y1={y}
            y2={y}
                stroke="#e9ecef"
            strokeWidth="1"
                strokeDasharray={i === 0 ? "0" : "3,3"}
          />
        );
      })}
          
          {/* Grille verticale */}
          {points.map((point, i) => (
            <Line
              key={`v-${i}`}
              x1={point.x}
              x2={point.x}
              y1={0}
              y2={chartHeight}
              stroke="#f8f9fa"
              strokeWidth="1"
            />
          ))}
          
      <Defs>
        <LinearGradient id={`${color}-grad`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.4" />
              <Stop offset="0.5" stopColor={color} stopOpacity="0.2" />
              <Stop offset="1" stopColor={color} stopOpacity="0.05" />
        </LinearGradient>
      </Defs>
          
          {/* Zone remplie */}
          <Path 
            d={`${path} L${chartWidth},${chartHeight} L0,${chartHeight} Z`} 
            fill={`url(#${color}-grad)`} 
          />
          
          {/* Ligne principale */}
          <Path 
            d={path} 
            stroke={color} 
            strokeWidth="3" 
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Points de données */}
          {points.map((point, i) => (
            <Circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color}
              stroke="#fff"
              strokeWidth="2"
            />
          ))}
          
          {/* Labels X améliorés */}
          {xLabels.map((label, i) => (
            <SvgText
              key={i}
              x={(chartWidth / (data.length - 1)) * i}
              y={chartHeight + 18}
              fontSize="12"
              fontWeight="600"
              textAnchor="middle"
              fill="#495057"
            >
              {label}
            </SvgText>
          ))}
    </Svg>
      </View>
    </View>
  );
};

/* ---------- Component ---------- */
export default function SiteDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params as { id: string };

  /* -------- site -------- */
  const [site, setSite] = useState<SiteInfo | null>(null);

  /* -------- water usage state -------- */
  const [waterHistoryMap, setWaterHistoryMap] = useState<{ [date: string]: number }>({});
  const [lastWaterSampleTs, setLastWaterSampleTs] = useState<number | null>(null);

  /* -------- power data (state) -------- */
  const [powerMetrics, setPowerMetrics] = useState({ voltage: 0, current: 0, power: 0, energyToday: 0 });
  const [isShellyConnected, setIsShellyConnected] = useState(true);
  useEffect(() => {
    (async () => {
      console.log('🏠 useEffect - Chargement du site avec ID:', id);
      const json = await AsyncStorage.getItem("sites");
      if (json) {
        const arr: SiteInfo[] = JSON.parse(json);
        const foundSite = arr.find((s) => s.id === id) || null;
        console.log('📍 Site trouvé:', foundSite?.name);
        setSite(foundSite);
        
        if (foundSite) {
          // Charger d'abord localement (rapide)
          console.log('📱 Tentative de chargement local...');
          const localLoaded = await loadComponentStatesLocally();
          console.log('📱 Chargement local réussi:', localLoaded);
          
          // Si pas d'états locaux, charger depuis AWS
          if (!localLoaded && foundSite.deviceInfo) {
            console.log('☁️ Chargement depuis AWS...');
            await loadComponentStatesFromAWS(foundSite);
          }
        }
      }
    })();
  }, [id]);

  // Fonction pour charger les états des composants depuis AWS DynamoDB
  const loadComponentStatesFromAWS = async (siteData: SiteInfo) => {
    try {
      setIsLoadingComponents(true);
      console.log('🔄 Chargement des états des composants depuis AWS...');
      
      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.log('❌ Utilisateur non connecté');
        return;
      }

      // Récupérer les appareils de l'utilisateur depuis AWS
      const result = await ShellyService.getUserShellyDevices(currentUserId);
      
      if (result.success && result.data) {
        const devices = result.data.data || result.data; // Gérer les deux formats possibles
        
        // Trouver l'appareil correspondant au site
        const device = devices.find((d: any) => 
          d.siteId === siteData.id || 
          d.deviceId === siteData.deviceInfo?.deviceId ||
          d.siteName === siteData.name
        );
        
        if (device && device.components) {
          console.log('✅ États des composants trouvés dans AWS:', device.components);
          
      // ✅ NOUVEAU : Charger Water Usage depuis AWS
      if (device.waterUsage) {
        console.log('✅ Water Usage trouvé dans AWS:', device.waterUsage);
        
        // Restaurer l'historique Water Usage
        if (device.waterUsage.daily) {
          setWaterHistoryMap(device.waterUsage.daily);
          recomputeWaterSeries(device.waterUsage.daily);
          console.log('📊 Water Usage chargé depuis AWS:', device.waterUsage.daily);
        }
        
        // Restaurer le timestamp
        if (device.waterUsage.timestamp) {
          setLastWaterSampleTs(device.waterUsage.timestamp);
          console.log('⏰ Timestamp Water Usage restauré:', device.waterUsage.timestamp);
        }
        
        // ✅ NOUVEAU : Calculer les valeurs manquantes depuis le dernier timestamp
        const now = Date.now();
        const lastTs = device.waterUsage.timestamp || now;
        const elapsedMinutes = Math.max((now - lastTs) / 60000, 0);
        
        console.log(`⏰ Temps écoulé depuis dernière sauvegarde: ${elapsedMinutes.toFixed(1)} minutes`);
        
        // ✅ NOUVEAU : Restaurer l'état exact des composants avant déconnexion
        if (device.components) {
          console.log('🔄 Restauration des états des composants avant déconnexion...');
          const restoredComponents = ensureDetailedComponents(device.components);
          
          // Mettre à jour les toggles avec les derniers états
          setToggles({
            pump: restoredComponents.pump.status,
            auger: restoredComponents.auger.status,
            heater: restoredComponents.heater.status,
            highWaterAlarm: restoredComponents.highWater.status,
            emergency: restoredComponents.heater.status,
          });
          
          console.log('✅ États des composants restaurés:', {
            pump: restoredComponents.pump.status,
            auger: restoredComponents.auger.status,
            heater: restoredComponents.heater.status,
            highWater: restoredComponents.highWater.status
          });
        }
        
        // Ajouter l'eau consommée depuis la dernière sauvegarde
        if (elapsedMinutes > 0 && device.components && device.components.pump && device.components.pump.status) {
          const additionalWater = elapsedMinutes * FLOW_RATE_LPM;
          const todayKey = getDateKey(new Date());
          const newMap = { ...device.waterUsage.daily };
          newMap[todayKey] = (newMap[todayKey] || 0) + additionalWater;
          
          setWaterHistoryMap(newMap);
          recomputeWaterSeries(newMap);
          setLastWaterSampleTs(now);
          
          console.log(`💧 Eau ajoutée depuis déconnexion: ${additionalWater.toFixed(1)}L (pompe était ON)`);
        }
      } else {
        console.log('⚠️ Aucune donnée Water Usage trouvée dans AWS');
      }
          
          // S'assurer que les composants ont la structure détaillée
          const detailedComponents = ensureDetailedComponents(device.components);
          console.log('📊 Composants avec structure détaillée:', JSON.stringify(detailedComponents, null, 2));
          
          // Extraire les états pour les toggles (pour l'interface utilisateur)
          const newToggles = {
            pump: detailedComponents.pump.status,
            auger: detailedComponents.auger.status,
            emergency: detailedComponents.heater.status, // Note: emergency utilise heater
            heater: detailedComponents.heater.status,
            highWaterAlarm: detailedComponents.highWater.status,
          };
          
          setToggles(newToggles);
          setBinReplaced(device.components.binReplaced || false);
          setHeaterStarted(device.components.heaterStarted || false);

          // Normaliser les métriques de puissance si présentes
          try {
            const p = (device as any).power;
            if (p && typeof p === 'object') {
              setPowerMetrics({
                voltage: Number(p.voltage) || 0,
                current: Number(p.current) || 0,
                power: Number(p.total) || 0,
                energyToday: Number((device as any).energyToday) || 0,
              });
            }
          } catch {}
          
          // Mettre à jour aussi les données du site avec les composants AWS (structure détaillée)
          if (siteData.deviceInfo) {
            const updatedSite = {
              ...siteData,
              deviceInfo: {
                ...siteData.deviceInfo,
                // Utiliser la structure détaillée complète
                components: detailedComponents
              }
            };
            setSite(updatedSite);
            
            // Sauvegarder dans AsyncStorage
            const sitesJson = await AsyncStorage.getItem('sites');
            if (sitesJson) {
              const sites = JSON.parse(sitesJson);
              const updatedSites = sites.map((s: any) => 
                s.id === siteData.id ? updatedSite : s
              );
              await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
            }
          }
          
          console.log('🔄 États des composants chargés depuis AWS et synchronisés');
        } else {
          console.log('⚠️ Aucun appareil trouvé dans AWS pour ce site');
        }
      } else {
        console.log('❌ Erreur lors du chargement depuis AWS:', result.error);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des états:', error);
    } finally {
      setIsLoadingComponents(false);
    }
  };

  /* -------- toggles -------- */
  const [toggles, setToggles] = useState({
    pump: false,
    auger: false,
    emergency: false,
    heater: false,
    highWaterAlarm: false,
  });
  
  // Ajout des états pour la modale de confirmation toggle
  const [toggleConfirm, setToggleConfirm] = useState<null | { key: keyof typeof toggles; isOn: boolean }>(null);

  // États pour les autres composants
  const [binReplaced, setBinReplaced] = useState(false);
  const [heaterStarted, setHeaterStarted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingComponents, setIsLoadingComponents] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  
  // ✅ NOUVEAU : Gestion intelligente des sauvegardes AWS
  const [lastWaterUsageSave, setLastWaterUsageSave] = useState<number>(0);
  const WATER_USAGE_SAVE_INTERVAL = 5000; // Sauvegarder toutes les 5 secondes pour une meilleure persistance

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

  // Refresh automatique des données Shelly au chargement et toutes les 5 secondes
  useEffect(() => {
    if (!site?.deviceInfo?.ipAddress) return;
    
    // Refresh immédiat au chargement
    console.log('🔄 Refresh immédiat des données Shelly au chargement...');
    refreshShellyData();
    
    // Puis refresh automatique toutes les 5 secondes (plus fréquent pour temps réel)
    const interval = setInterval(() => {
      console.log('🔄 Refresh automatique des données Shelly...');
      refreshShellyData();
    }, 5000); // 5 secondes

    // ✅ NOUVEAU : Sauvegarder les données quand l'app se ferme
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 App en arrière-plan - Sauvegarde finale des données complètes...');
        if (site?.id && waterHistoryMap && site?.deviceInfo?.components) {
          const components = ensureDetailedComponents(site.deviceInfo.components);
          
          // ✅ Sauvegarde immédiate et synchrone
          saveComponentsAndWaterUsageToAWS(site.id, components, waterHistoryMap, Date.now())
            .then(() => {
              console.log('✅ Sauvegarde finale terminée avec succès');
            })
            .catch((error) => {
              console.error('❌ Erreur lors de la sauvegarde finale:', error);
            });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, [site?.deviceInfo?.ipAddress, site?.id, waterHistoryMap]);

  // Refresh dès que l'écran redevient visible
  useFocusEffect(
    React.useCallback(() => {
      console.log('👀 Écran SiteDetails focalisé → refresh immédiat');
      refreshShellyData();
      return () => {};
    }, [site?.deviceInfo?.ipAddress])
  );

  // Refresh quand l'app revient au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && site?.deviceInfo?.ipAddress) {
        console.log('📱 App active → refresh immédiat');
        refreshShellyData();
      }
    });
    return () => sub.remove();
  }, [site?.deviceInfo?.ipAddress]);

  // Fonction pour récupérer les données en temps réel depuis le Shelly
  const refreshShellyData = async () => {
    try {
      if (!site?.deviceInfo?.ipAddress) {
        console.log('❌ Pas d\'IP Shelly disponible pour le refresh');
        return;
      }

      setIsRefreshingData(true);
      console.log('🔄 Refresh des données Shelly en temps réel...');
      
      const fetchStatus = async (id: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(`http://${site.deviceInfo.ipAddress}/rpc/Switch.GetStatus?id=${id}`, { 
            method: 'GET', 
            signal: controller.signal 
          });
          clearTimeout(timeoutId);
          if (!res.ok) return null;
          const data = await res.json();
          console.log(`📊 Relay ${id} données temps réel:`, JSON.stringify(data, null, 2));
          return data;
        } catch (e) {
          try { clearTimeout(timeoutId); } catch {}
          console.log(`❌ Erreur lecture relay ${id}:`, e);
          return null;
        }
      };

      // Récupérer les données pour tous les relays
      const components = ensureDetailedComponents(site.deviceInfo?.components);
      
      let shellyConnected = false;
      for (let id = 0; id < 4; id++) {
        const st: any = await fetchStatus(id);
        const key = id === 0 ? 'pump' : id === 1 ? 'heater' : id === 2 ? 'auger' : 'highWater';
        
        if (st) {
          shellyConnected = true;
          // Mettre à jour avec les vraies valeurs selon le format Shelly Pro4PM
          const realPower = Number(st.apower ?? 0); // Utiliser apower pour la puissance active
          const realVoltage = Number(st.voltage ?? 0);
          const realCurrent = Number(st.current ?? 0);
          const realEnergy = typeof st.aenergy === 'object' ? Number(st.aenergy?.total ?? 0) : Number(st.aenergy ?? 0);
          const realTemp = Number(st.temperature ?? 0);
          const realFrequency = Number(st.frequency ?? 0);
          
          console.log(`🔧 Relay ${id} (${key}) - Puissance: ${realPower}W, Voltage: ${realVoltage}V, Courant: ${realCurrent}A, Fréquence: ${realFrequency}Hz`);
          
          // Mettre à jour le composant avec les vraies valeurs
          (components as any)[key] = {
            ...(components as any)[key],
            status: !!st.output,
            power: realPower,
            voltage: realVoltage,
            current: realCurrent,
            energy: realEnergy,
            temperature: realTemp,
            frequency: realFrequency, // Ajouter la fréquence
          };
        }
      }

      // Mettre à jour l'état local du site
      const updatedSite = {
        ...site,
        deviceInfo: site.deviceInfo ? {
          ...site.deviceInfo,
          components: components
        } : site.deviceInfo
      };
      setSite(updatedSite);

      // Sauvegarder dans AsyncStorage
      const sitesJson = await AsyncStorage.getItem('sites');
      if (sitesJson) {
        const sites = JSON.parse(sitesJson);
        const updatedSites = sites.map((s: any) => 
          s.id === site.id ? updatedSite : s
        );
        await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      }

      // Mettre à jour les toggles avec les nouveaux états
      setToggles({
        pump: components.pump.status,
        auger: components.auger.status,
        heater: components.heater.status,
        highWaterAlarm: components.highWater.status,
        emergency: components.heater.status, // emergency utilise heater
      });

      console.log('✅ Données Shelly mises à jour en temps réel');
      
      // ✅ NOUVEAU : Mettre à jour l'état de connexion
      setIsShellyConnected(shellyConnected);
      if (!shellyConnected) {
        console.log('⚠️ Shelly non connecté détecté');
      } else {
        console.log('✅ Shelly connecté');
      }

      // ✅ NOUVEAU : Charger les dernières données Water Usage depuis AWS SEULEMENT si Shelly connecté
      if (shellyConnected) {
        try {
          if (site?.id) {
            const currentUserId = await AuthService.getCurrentUserId();
            if (currentUserId) {
              const result = await ShellyService.getUserShellyDevices(currentUserId);
              if (result.success && result.data) {
                const devices = result.data.data || result.data;
                const device = devices.find((d: any) => 
                  d.siteId === site.id || 
                  d.deviceId === site.deviceInfo?.deviceId ||
                  d.siteName === site.name
                );
                
                if (device && device.waterUsage) {
                  console.log('🔄 Water Usage mis à jour depuis AWS en temps réel:', device.waterUsage);
                  
                  if (device.waterUsage.daily) {
                    setWaterHistoryMap(device.waterUsage.daily);
                    recomputeWaterSeries(device.waterUsage.daily);
                    console.log('📊 Graphique Water Usage mis à jour avec données AWS');
                  }
                  
                  if (device.waterUsage.timestamp) {
                    setLastWaterSampleTs(device.waterUsage.timestamp);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log('⚠️ Erreur lors du chargement Water Usage depuis AWS:', error);
        }
      } else {
        console.log('💧 Shelly déconnecté - Water Usage reste stable (pas de mise à jour)');
      }

      // ✅ NOUVEAU : Mettre à jour l'historique Water Usage SEULEMENT si Shelly connecté
      if (shellyConnected) {
        try {
          const now = Date.now();
          const lastTs = lastWaterSampleTs || now;
          const elapsedMinutes = Math.max((now - lastTs) / 60000, 0);

          const comp = ensureDetailedComponents(components);
          const isPumpOn = !!comp.pump.status;
          const todayKey = getDateKey(new Date());
          const newMap = { ...waterHistoryMap };
          const addLiters = isPumpOn ? elapsedMinutes * FLOW_RATE_LPM : 0;
          newMap[todayKey] = (newMap[todayKey] || 0) + addLiters;
          setWaterHistoryMap(newMap);
          setLastWaterSampleTs(now);
          recomputeWaterSeries(newMap);
          console.log('💧 Water Usage mis à jour (Shelly connecté)');
          
          // ✅ NOUVEAU : Sauvegarder dans AWS aussi (avec gestion des conflits et limitation de fréquence)
          if (site?.id) {
            await saveWaterHistory(site.id, newMap, now);
            
            // Sauvegarder dans AWS seulement si assez de temps s'est écoulé (éviter les conflits)
            const timeSinceLastSave = now - lastWaterUsageSave;
            if (timeSinceLastSave >= WATER_USAGE_SAVE_INTERVAL) {
              try {
                // ✅ NOUVEAU : Sauvegarder aussi les composants avec leurs vraies valeurs Shelly
                await saveComponentsAndWaterUsageToAWS(site.id, components, newMap, now);
                setLastWaterUsageSave(now);
                console.log('💧 Water Usage ET composants sauvegardés dans AWS (intervalle respecté)');
              } catch (conflictError) {
                console.log('⚠️ Conflit Water Usage géré automatiquement:', conflictError);
                // La fonction saveWaterUsageToAWS gère déjà les conflits
              }
            } else {
              console.log(`⏱️ Water Usage AWS sauvegarde différée (${Math.round((WATER_USAGE_SAVE_INTERVAL - timeSinceLastSave) / 1000)}s restantes)`);
            }
          }
        } catch (error) {
          console.error('❌ Erreur mise à jour Water Usage:', error);
        }
      } else {
        console.log('💧 Shelly déconnecté - Water Usage reste stable (pas de calcul)');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du refresh Shelly:', error);
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Fonction pour récupérer les vraies coordonnées Shelly
  const getRealShellyCoordinates = async () => {
    try {
      console.log('🔍 Récupération des vraies coordonnées Shelly...');
      
      // Essayer de scanner le réseau pour trouver Shelly
      const phoneIP = await Network.getIpAddressAsync();
      const networkPrefix = phoneIP.substring(0, phoneIP.lastIndexOf('.') + 1);
      
      // Scanner les IPs possibles (1-254)
      for (let i = 1; i <= 254; i++) {
        const ip = `${networkPrefix}${i}`;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          const response = await fetch(`http://${ip}/shelly`, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log(`✅ Shelly trouvé sur ${ip}!`);
            return {
              deviceId: `shelly-${ip.replace(/\./g, '-')}`,
              macAddress: '08:3A:F2:7C:F1:16', // MAC par défaut
              ipAddress: ip,
              deviceName: `Shelly-${ip.replace(/\./g, '-')}`,
              connectionType: 'WIFI' as const,
              lastConnected: new Date().toISOString()
            };
          }
        } catch (error) {
          // Ignorer les erreurs, c'est normal
        }
      }
      
      console.log('❌ Shelly non trouvé sur le réseau');
      return null;
      
    } catch (error) {
      console.error('❌ Erreur lors du scan réseau:', error);
      return null;
    }
  };

  // Fonction pour sauvegarder les états vers AWS DynamoDB
  const saveDeviceStateToAWS = async (updatedToggles?: typeof toggles, updatedBinReplaced?: boolean, updatedHeaterStarted?: boolean) => {
    try {
      setIsSaving(true);
      console.log('🔄 Sauvegarde des états vers AWS DynamoDB...');
      console.log('📊 États actuels:', { toggles, binReplaced, heaterStarted });
      console.log('📊 États mis à jour:', { updatedToggles, updatedBinReplaced, updatedHeaterStarted });

      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.error('❌ Utilisateur non connecté');
        return;
      }

      const currentToggles = updatedToggles || toggles;
      const currentBinReplaced = updatedBinReplaced !== undefined ? updatedBinReplaced : binReplaced;
      const currentHeaterStarted = updatedHeaterStarted !== undefined ? updatedHeaterStarted : heaterStarted;

      console.log('📊 États finaux à sauvegarder:', { currentToggles, currentBinReplaced, currentHeaterStarted });
      if (!site) {
        console.error('❌ Aucun site chargé, annulation de la sauvegarde AWS');
        return;
      }

      // S'assurer que les composants ont la structure détaillée
      const currentComponents = ensureDetailedComponents(site.deviceInfo?.components);
      
      // FORCER la structure détaillée complète pour AWS
      const updatedComponents = {
        pump: {
          name: "Pump",
          relay: 0,
          status: currentToggles.pump,
          power: currentComponents.pump.power,
          voltage: currentComponents.pump.voltage,
          current: currentComponents.pump.current,
          energy: currentComponents.pump.energy,
          temperature: currentComponents.pump.temperature,
          frequency: currentComponents.pump.frequency || 0
        },
        auger: {
          name: "Auger",
          relay: 2,
          status: currentToggles.auger,
          power: currentComponents.auger.power,
          voltage: currentComponents.auger.voltage,
          current: currentComponents.auger.current,
          energy: currentComponents.auger.energy,
          temperature: currentComponents.auger.temperature,
          frequency: currentComponents.auger.frequency || 0
        },
        heater: {
          name: "Heater",
          relay: 1,
          status: currentToggles.heater,
          power: currentComponents.heater.power,
          voltage: currentComponents.heater.voltage,
          current: currentComponents.heater.current,
          energy: currentComponents.heater.energy,
          temperature: currentComponents.heater.temperature,
          frequency: currentComponents.heater.frequency || 0
        },
        highWater: {
          name: "High Water Alarm",
          relay: 3,
          status: currentToggles.highWaterAlarm,
          power: currentComponents.highWater.power,
          voltage: currentComponents.highWater.voltage,
          current: currentComponents.highWater.current,
          energy: currentComponents.highWater.energy,
          temperature: currentComponents.highWater.temperature,
          frequency: currentComponents.highWater.frequency || 0
        },
        // Garder les autres composants comme booléens
          binReplaced: currentBinReplaced,
          heaterStarted: currentHeaterStarted,
        emergency: currentToggles.emergency,
      };
      
      // ✅ NOUVEAU : Ajouter Water Usage
      const waterUsageData = {
        daily: waterHistoryMap,
        today: waterHistoryMap[getDateKey(new Date())] || 0,
        lastUpdated: new Date().toISOString(),
        timestamp: lastWaterSampleTs || Date.now()
      };
      
      console.log('📊 Composants mis à jour avec structure détaillée:', JSON.stringify(updatedComponents, null, 2));

      // Utiliser la route de mise à jour avec l'ID stable du site pour éviter les doublons
      const updates = {
        components: updatedComponents,
        waterUsage: waterUsageData, // ✅ NOUVEAU : Ajouter Water Usage
        status: site.status,
        lastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;

      console.log('📤 Mise à jour AWS via PUT avec ID:', site.id, 'payload:', updates);

      const result = await ShellyService.updateShellyDevice(site.id, updates);
      
      if (result.success) {
        console.log('✅ Appareil Shelly et composants sauvegardés avec succès dans AWS');
        
        // Mettre à jour l'état local du site
        if (site) {
          const updatedSite = { ...site };
          setSite(updatedSite);
          
          // Sauvegarder dans AsyncStorage
          const sitesJson = await AsyncStorage.getItem('sites');
          if (sitesJson) {
            const sites = JSON.parse(sitesJson);
            const updatedSites = sites.map((s: any) => 
              s.id === site.id ? updatedSite : s
            );
            await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
          }
        }
      } else {
        console.error('❌ Erreur lors de la sauvegarde AWS:', result.error);
        
        // ✅ NOUVEAU : Gestion des conflits de concurrence
        if (result.error && result.error.includes('concurrent')) {
          console.log('🔄 Conflit de concurrence détecté - Synchronisation automatique...');
          
          // Recharger les données depuis AWS pour synchroniser
          if (site) {
            await loadComponentStatesFromAWS(site);
            console.log('🔄 Données synchronisées avec AWS après conflit');
          }
        } else {
        Alert.alert('Error', 'Failed to save device state to AWS: ' + result.error);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde AWS:', error);
      Alert.alert('Error', 'Failed to save device state to AWS');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ NOUVEAU : Fonction pour sauvegarder composants ET Water Usage ensemble
  const saveComponentsAndWaterUsageToAWS = async (siteId: string, components: any, waterMap: { [date: string]: number }, timestamp: number) => {
    try {
      console.log('💧 Sauvegarde composants ET Water Usage vers AWS...');
      
      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.log('❌ Utilisateur non connecté');
        return;
      }

      // Calculer le total d'eau aujourd'hui
      const todayKey = getDateKey(new Date());
      const todayWaterUsage = waterMap[todayKey] || 0;
      
      // ✅ Vérifier que les composants existent
      if (!components) {
        console.log('⚠️ Aucun composant à sauvegarder');
        return;
      }
      
      // Préparer les données complètes pour AWS
      const fullData = {
        siteId: siteId,
        components: components, // ✅ NOUVEAU : Inclure les composants avec leurs vraies valeurs
        waterUsage: {
          daily: waterMap, // Historique des 7 jours
          today: todayWaterUsage,
          lastUpdated: new Date().toISOString(),
          timestamp: timestamp
        },
        lastUpdated: new Date().toISOString()
      };

      console.log('📤 Données complètes pour AWS:', JSON.stringify(fullData, null, 2));

      // Mettre à jour dans AWS via l'API existante
      const result = await ShellyService.updateShellyDevice(siteId, fullData);
      
      if (result.success) {
        console.log('✅ Composants ET Water Usage sauvegardés dans AWS avec succès');
      } else {
        console.error('❌ Erreur sauvegarde complète AWS:', result.error);
        
        // ✅ Gestion des conflits de concurrence
        if (result.error && result.error.includes('concurrent')) {
          console.log('🔄 Conflit de concurrence détecté - Récupération des données récentes...');
          
          // Récupérer les données les plus récentes depuis AWS
          const freshResult = await ShellyService.getUserShellyDevices(currentUserId);
          if (freshResult.success && freshResult.data) {
            const devices = freshResult.data.data || freshResult.data;
            const device = devices.find((d: any) => d.siteId === siteId);
            
            if (device && device.waterUsage) {
              console.log('📥 Données AWS récentes récupérées:', device.waterUsage);
              
              // Fusionner intelligemment les données
              const awsDaily = device.waterUsage.daily || {};
              const mergedDaily = { ...awsDaily, ...waterMap };
              
              // Mettre à jour localement avec les données fusionnées
              setWaterHistoryMap(mergedDaily);
              recomputeWaterSeries(mergedDaily);
              
              console.log('🔄 Données Water Usage fusionnées avec succès');
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde complète AWS:', error);
    }
  };

  // Fonction pour sauvegarder Water Usage dans AWS avec gestion des conflits
  const saveWaterUsageToAWS = async (siteId: string, waterMap: { [date: string]: number }, timestamp: number) => {
    try {
      console.log('💧 Sauvegarde Water Usage vers AWS...');
      
      const currentUserId = await AuthService.getCurrentUserId();
      if (!currentUserId) {
        console.log('❌ Utilisateur non connecté');
        return;
      }

      // Calculer le total d'eau aujourd'hui
      const todayKey = getDateKey(new Date());
      const todayWaterUsage = waterMap[todayKey] || 0;
      
      // Préparer les données pour AWS
      const waterUsageData = {
        siteId: siteId,
        waterUsage: {
          daily: waterMap, // Historique des 7 jours
          today: todayWaterUsage,
          lastUpdated: new Date().toISOString(),
          timestamp: timestamp
        },
        lastUpdated: new Date().toISOString()
      };

      console.log('📤 Données Water Usage pour AWS:', waterUsageData);

      // Mettre à jour dans AWS via l'API existante
      const result = await ShellyService.updateShellyDevice(siteId, waterUsageData);
      
      if (result.success) {
        console.log('✅ Water Usage sauvegardé dans AWS avec succès');
      } else {
        console.error('❌ Erreur sauvegarde Water Usage AWS:', result.error);
        
        // ✅ NOUVEAU : Gestion des conflits de concurrence
        if (result.error && result.error.includes('concurrent')) {
          console.log('🔄 Conflit de concurrence détecté - Récupération des données récentes...');
          
          // Récupérer les données les plus récentes depuis AWS
          const freshResult = await ShellyService.getUserShellyDevices(currentUserId);
          if (freshResult.success && freshResult.data) {
            const devices = freshResult.data.data || freshResult.data;
            const device = devices.find((d: any) => d.siteId === siteId);
            
            if (device && device.waterUsage) {
              console.log('📥 Données AWS récentes récupérées:', device.waterUsage);
              
              // Fusionner intelligemment les données
              const awsDaily = device.waterUsage.daily || {};
              const mergedDaily = { ...awsDaily, ...waterMap };
              
              // Mettre à jour localement avec les données fusionnées
              setWaterHistoryMap(mergedDaily);
              recomputeWaterSeries(mergedDaily);
              
              console.log('🔄 Données Water Usage fusionnées avec succès');
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde Water Usage AWS:', error);
    }
  };

  // Fonction pour sauvegarder les états localement
  const saveComponentStatesLocally = async (newToggles: typeof toggles, newBinReplaced: boolean, newHeaterStarted: boolean) => {
    try {
      console.log('💾 saveComponentStatesLocally appelée avec:', { newToggles, newBinReplaced, newHeaterStarted });
      if (!site) {
        console.log('❌ Pas de site, sauvegarde locale annulée');
        return;
      }
      
      // ✅ NOUVEAU : Sauvegarder aussi les composants détaillés et Water Usage
      const componentStates = {
        siteId: site.id,
        toggles: newToggles,
        binReplaced: newBinReplaced,
        heaterStarted: newHeaterStarted,
        components: site.deviceInfo?.components, // ✅ Inclure les composants détaillés
        waterUsage: {
          daily: waterHistoryMap,
          timestamp: lastWaterSampleTs || Date.now()
        }, // ✅ Inclure Water Usage
        lastUpdated: new Date().toISOString()
      };
      
      console.log('💾 Données complètes à sauvegarder localement:', componentStates);
      await AsyncStorage.setItem(`componentStates_${site.id}`, JSON.stringify(componentStates));
      console.log('✅ États des composants ET Water Usage sauvegardés localement');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde locale:', error);
    }
  };

  // Fonction pour charger les états localement
  const loadComponentStatesLocally = async () => {
    try {
      console.log('📱 loadComponentStatesLocally appelée pour site:', site?.id);
      if (!site) {
        console.log('❌ Pas de site, chargement local annulé');
        return false;
      }
      
      const savedStates = await AsyncStorage.getItem(`componentStates_${site.id}`);
      console.log('📱 États sauvegardés trouvés:', savedStates ? 'OUI' : 'NON');
      
      if (savedStates) {
        const states = JSON.parse(savedStates);
        console.log('📱 États des composants chargés localement:', states);
        
        // ✅ Restaurer les états des composants
        setToggles(states.toggles || { pump: false, auger: false, emergency: false, heater: false, highWaterAlarm: false });
        setBinReplaced(states.binReplaced || false);
        setHeaterStarted(states.heaterStarted || false);
        
        // ✅ NOUVEAU : Restaurer les composants détaillés
        if (states.components && site.deviceInfo) {
          const updatedSite = {
            ...site,
            deviceInfo: {
              ...site.deviceInfo,
              components: states.components
            }
          };
          setSite(updatedSite);
          console.log('✅ Composants détaillés restaurés localement');
        }
        
        // ✅ NOUVEAU : Restaurer Water Usage
        if (states.waterUsage) {
          if (states.waterUsage.daily) {
            setWaterHistoryMap(states.waterUsage.daily);
            recomputeWaterSeries(states.waterUsage.daily);
            console.log('✅ Water Usage restauré localement:', states.waterUsage.daily);
          }
          if (states.waterUsage.timestamp) {
            setLastWaterSampleTs(states.waterUsage.timestamp);
            console.log('✅ Timestamp Water Usage restauré localement');
          }
        }
        
        console.log('✅ États locaux appliqués avec succès');
        return true; // États chargés localement
      }
      console.log('📭 Aucun état local trouvé');
      return false; // Aucun état local trouvé
    } catch (error) {
      console.error('❌ Erreur lors du chargement local:', error);
      return false;
    }
  };

  const toggle = (k: keyof typeof toggles) => {
    setToggleConfirm({ key: k, isOn: toggles[k] });
  };
  
  const handleToggleConfirm = async (confirm: boolean) => {
    console.log('🔧 handleToggleConfirm appelé avec:', confirm, toggleConfirm);
    if (confirm && toggleConfirm && site) {
      const newToggles = { ...toggles, [toggleConfirm.key]: !toggleConfirm.isOn };
      console.log('🔄 Nouveaux toggles:', newToggles);
      setToggles(newToggles);
      
      // NOUVEAU : Contrôle à distance via AWS IoT
      const component = toggleConfirm.key;
      const newState = newToggles[component];
      const action = newState ? 'on' : 'off';
      
      console.log(`📡 Envoi commande à distance: ${component} ${action}`);
      
      try {
        const remoteResult = await remoteControlService.sendRemoteCommand(
          site.id, 
          component, 
          action
        );
        
        if (remoteResult.success) {
          console.log('✅ Commande à distance envoyée avec succès:', remoteResult);
          
          // Sauvegarder localement ET dans AWS
          console.log('💾 Début sauvegarde locale...');
          await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
          console.log('☁️ Début sauvegarde AWS...');
          await saveDeviceStateToAWS(newToggles);
          console.log('✅ Sauvegardes terminées');
          
        } else {
          console.error('❌ Erreur commande à distance:', remoteResult.error);
          Alert.alert(
            'Erreur de contrôle à distance', 
            `Impossible de contrôler ${component}: ${remoteResult.error}`
          );
          
          // Annuler le changement local
          setToggles(toggles);
        }
        
      } catch (error) {
        console.error('❌ Erreur lors du contrôle à distance:', error);
        Alert.alert(
          'Erreur de connexion', 
          'Impossible de se connecter au serveur de contrôle à distance'
        );
        
        // Annuler le changement local
        setToggles(toggles);
      }
    }
    setToggleConfirm(null);
  };
  const knob = (on: boolean) => ({ transform: [{ translateX: on ? 20 : 0 }] });

  /* -------- demo metrics -------- */
  const solidsPct = 32;
  const heatPct = 18;
  const heatTime = 28;

  /* -------- graph data -------- */
  // ✅ NOUVEAU : Générer les vrais labels de jours basés sur les dates
  const getDayLabels = () => {
    const today = new Date();
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[d.getDay()];
      const dayNumber = d.getDate();
      labels.push(`${dayName}\n${dayNumber}`);
    }
    return labels;
  };
  
  const days = getDayLabels();
  // Water usage (réel) – alimenté par le runtime de la pompe
  const [waterSeries, setWaterSeries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]); // ✅ Historique par défaut (7 zéros)
  // ✅ NOUVEAU : État initial vide - seulement les vraies valeurs
  const getInitialPowerHistory = () => {
    // Commencer avec des zéros - seulement les vraies valeurs seront affichées
    return [0, 0, 0, 0, 0, 0, 0];
  };
  
  const [powerSeriesHistory, setPowerSeriesHistory] = useState<number[]>(getInitialPowerHistory()); // ✅ Historique vide au début

  // ✅ NOUVEAU : Charger l'historique Power depuis AsyncStorage
  const loadPowerHistory = async (siteId?: string) => {
    try {
      if (!siteId) return;
      const json = await AsyncStorage.getItem(`powerHistory_${siteId}`);
      if (json) {
        const history = JSON.parse(json);
        setPowerSeriesHistory(history);
        console.log('📈 Historique Power chargé depuis AsyncStorage:', history);
      } else {
        // ✅ Si pas d'historique sauvegardé, garder les zéros (pas de valeurs simulées)
        const defaultHistory = getInitialPowerHistory();
        setPowerSeriesHistory(defaultHistory);
        console.log('📈 Pas d\'historique Power - Affichage de zéros');
      }
    } catch (error) {
      console.error('❌ Erreur chargement historique Power:', error);
      // ✅ En cas d'erreur, utiliser les valeurs par défaut
      setPowerSeriesHistory(getInitialPowerHistory());
    }
  };

  // ✅ NOUVEAU : Sauvegarder l'historique Power dans AsyncStorage
  const savePowerHistory = async (siteId: string, history: number[]) => {
    try {
      await AsyncStorage.setItem(`powerHistory_${siteId}`, JSON.stringify(history));
      console.log('💾 Historique Power sauvegardé:', history);
    } catch (error) {
      console.error('❌ Erreur sauvegarde historique Power:', error);
    }
  };
  const FLOW_RATE_LPM = 20; // Débit pompe par défaut (litres/minute). Ajustable si besoin.
  
  // ✅ NOUVEAU : Retourner l'historique des puissances (toujours conservé)
  const getPowerSeries = () => {
    console.log(`📈 Power Series actuel:`, powerSeriesHistory);
    return powerSeriesHistory;
  };
  
  // ✅ NOUVEAU : Créer un historique sur 7 jours avec la nouvelle valeur d'aujourd'hui
  useEffect(() => {
    try {
      if (site?.deviceInfo?.components) {
        const components = ensureDetailedComponents(site.deviceInfo.components);
        const currentPower = components.pump.power + components.heater.power + components.auger.power + components.highWater.power;
        
        if (currentPower > 0) {
        // ✅ NOUVEAU : Seulement les vraies valeurs - pas de données simulées
        const today = new Date();
        const powerData = [];
        const basePower = Math.round(currentPower);
        
        // Générer les 7 derniers jours (du plus ancien au plus récent)
        for (let i = 6; i >= 0; i--) {
          if (i === 0) { // Aujourd'hui
            powerData.push(basePower); // Seulement la vraie valeur d'aujourd'hui
          } else { // Jours passés
            // ✅ NOUVEAU : Utiliser seulement l'historique existant (vraies données), sinon zéro
            if (powerSeriesHistory.length > 0 && powerSeriesHistory[6 - i] > 0) {
              powerData.push(powerSeriesHistory[6 - i]); // Garder seulement les vraies données
            } else {
              powerData.push(0); // Pas de données simulées
            }
          }
        }
          
          setPowerSeriesHistory(powerData);
          // ✅ Sauvegarder l'historique (même en cas d'erreur backend)
          if (site?.id) {
            savePowerHistory(site.id, powerData).catch(err => {
              console.warn('⚠️ Impossible de sauvegarder l\'historique Power (erreur backend):', err);
            });
          }
          console.log(`📈 Historique Power 7 jours mis à jour:`, powerData);
        }
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour historique Power:', error);
      // ✅ En cas d'erreur, garder l'historique existant ou utiliser des zéros
      if (powerSeriesHistory.length === 0) {
        setPowerSeriesHistory([0, 0, 0, 0, 0, 0, 0]);
      }
    }
  }, [site?.deviceInfo?.components]);

  // ✅ NOUVEAU : Charger l'historique Power au démarrage
  useEffect(() => {
    if (site?.id) {
      loadPowerHistory(site.id).catch(err => {
        console.warn('⚠️ Impossible de charger l\'historique Power (erreur backend):', err);
      // ✅ En cas d'erreur, utiliser des zéros
      setPowerSeriesHistory([0, 0, 0, 0, 0, 0, 0]);
      });
    }
  }, [site?.id]);

  const powerSeries = getPowerSeries();
  const powerMax = powerSeries && powerSeries.length > 0 ? Math.max(...powerSeries, 50) : 50; // Ajuster l'échelle dynamiquement

  const { voltage, current, power, energyToday } = powerMetrics;

  // Helpers: gestion historique Water Usage (7 jours)
  const getDateKey = (d: Date) => d.toISOString().slice(0, 10);
  const getLast7Dates = () => {
    const arr: string[] = [];
    const today = new Date();
    // ✅ CORRECTION : Générer les 7 derniers jours (du plus ancien au plus récent)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i); // -i = jours passés (pas le futur)
      arr.push(getDateKey(d));
    }
    console.log('📅 7 derniers jours générés:', arr);
    return arr;
  };
  const recomputeWaterSeries = (map: { [date: string]: number }) => {
    const last7 = getLast7Dates();
    // ✅ NOUVEAU : Toujours créer un historique (même avec des zéros)
    const series = last7.map((k) => {
      const value = map[k];
      return value !== undefined ? Math.round(value * 10) / 10 : 0; // Historique complet
    });
    setWaterSeries(series);
    console.log('💧 Water Usage historique (7 jours):', series);
  };
  const loadWaterHistory = async (siteId?: string) => {
    try {
      if (!siteId) return;
      const json = await AsyncStorage.getItem(`waterHistory_${siteId}`);
      const tsStr = await AsyncStorage.getItem(`waterLastTs_${siteId}`);
      let map = {} as { [date: string]: number };
      if (json) {
        map = JSON.parse(json);
        setWaterHistoryMap(map);
      }
      if (tsStr) setLastWaterSampleTs(Number(tsStr));
      recomputeWaterSeries(map);
    } catch {}
  };
  const saveWaterHistory = async (siteId: string, map: { [date: string]: number }, ts: number) => {
    try {
      await AsyncStorage.setItem(`waterHistory_${siteId}`, JSON.stringify(map));
      await AsyncStorage.setItem(`waterLastTs_${siteId}`, String(ts));
    } catch {}
  };

  // Mettre à jour les métriques de puissance avec les données Shelly en temps réel
  useEffect(() => {
    if (site?.deviceInfo?.components) {
      const components = ensureDetailedComponents(site.deviceInfo.components);
      
      // Calculer les totaux de tous les composants
      const totalPower = components.pump.power + components.heater.power + components.auger.power + components.highWater.power;
      const totalCurrent = components.pump.current + components.heater.current + components.auger.current + components.highWater.current;
      const avgVoltage = (components.pump.voltage + components.heater.voltage + components.auger.voltage + components.highWater.voltage) / 4;
      const totalEnergy = components.pump.energy + components.heater.energy + components.auger.energy + components.highWater.energy;
      
      console.log(`📊 Métriques calculées - Puissance: ${totalPower}W, Courant: ${totalCurrent}A, Voltage: ${avgVoltage}V`);
      
      // ✅ NOUVEAU : Toujours mettre à jour avec les vraies valeurs (même si 0)
      setPowerMetrics({
        voltage: avgVoltage,        // ✅ Vraie valeur (même si 0)
        current: totalCurrent,      // ✅ Vraie valeur (même si 0)
        power: totalPower,          // ✅ Vraie valeur (même si 0)
        energyToday: totalEnergy,   // ✅ Vraie valeur (même si 0)
      });
      console.log('📈 Graphique Power Monitoring mis à jour avec les vraies données Shelly');
    } else {
      // ✅ NOUVEAU : Si pas de composants, garder les dernières valeurs (ne pas les effacer)
      console.log('📊 Aucun composant disponible - Conservation des dernières valeurs');
      // Ne pas changer powerMetrics, garder les dernières valeurs
    }
  }, [site?.deviceInfo?.components]);

  // Charger l'historique Water dès qu'on connaît le site
  useEffect(() => {
    if (site?.id) {
      loadWaterHistory(site.id);
    }
  }, [site?.id]);

  /* -------- modal -------- */
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceSuccess, setReplaceSuccess] = useState(false);
  const onConfirmBin = async () => {
    console.log('🗑️ onConfirmBin appelé');
    setIsReplacing(true);
    setTimeout(async () => {
      setIsReplacing(false);
      setReplaceSuccess(true);
      
      // Mettre à jour l'état local
      const newBinReplaced = true;
      console.log('🔄 Nouveau binReplaced:', newBinReplaced);
      setBinReplaced(newBinReplaced);
      
      // Sauvegarder localement ET dans AWS
      console.log('💾 Début sauvegarde locale (bin)...');
      await saveComponentStatesLocally(toggles, newBinReplaced, heaterStarted);
      console.log('☁️ Début sauvegarde AWS (bin)...');
      await saveDeviceStateToAWS(toggles, newBinReplaced, heaterStarted);
      console.log('✅ Sauvegardes bin terminées');
      
      setTimeout(() => {
        setReplaceSuccess(false);
        setConfirmVisible(false);
      }, 1000);
    }, 1000);
  };

  // Utilitaire pour label du toggle
  const getToggleLabel = (key: string) => {
    if (key === 'pump') return 'Heater';
    if (key === 'auger') return 'High Water Alarm';
    if (key === 'emergency') return 'Urgence';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  // Helper for rental card (toujours défini)
  const RentalCard = () => (
    <View style={styles.rentalCard}>
      <Text style={styles.cardTitle}>{site?.name || 'Site'}</Text>
      <Text style={{ fontWeight: '700', fontSize: 16, color: '#222', marginTop: 2, marginBottom: 6 }}>Status</Text>
      {/* 4 gros boutons statuts juste sous Status - Ordre: Pump, Auger, Heater, High Water */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 0, marginTop: 10, marginBottom: 0 }}>
        {/* Pump - Relay 0 */}
        <View style={{ alignItems: 'center', width: 90 }}>
          <TouchableOpacity
            style={{
              width: 80,
              height: 70,
              borderRadius: 18,
              backgroundColor: '#28a745',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
              shadowColor: '#28a745',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 3,
            }}
            onPress={() => (navigation as any).navigate('DetailsPump', {
              siteId: site?.id,
              pumpState: toggles.pump,
              onPumpChange: handlePumpChange
            })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="pump" size={30} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginTop: 6, textAlign: 'center' }}>Pump</Text>
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {site?.deviceInfo?.components ? 
                (ensureDetailedComponents(site.deviceInfo.components).pump.power || 0) : 
                Math.round(powerMetrics.power * 0.8)
              }W
            </Text>
          </TouchableOpacity>
        </View>
        {/* Auger - Relay 2 */}
        <View style={{ alignItems: 'center', width: 90 }}>
          <TouchableOpacity
            style={{
              width: 80,
              height: 70,
              borderRadius: 18,
              backgroundColor: '#f6c343',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
              shadowColor: '#f6c343',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 3,
            }}
            onPress={() => (navigation as any).navigate('DetailsAuger', {
              siteId: site?.id,
              augerState: toggles.auger,
              onAugerChange: handleAugerChange
            })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="screwdriver" size={30} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginTop: 6, textAlign: 'center' }}>Auger</Text>
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {site?.deviceInfo?.components ? 
                (ensureDetailedComponents(site.deviceInfo.components).auger.power || 0) : 
                Math.round(powerMetrics.power * 0.1)
              }W
            </Text>
          </TouchableOpacity>
        </View>
        {/* Heater - Relay 1 */}
        <View style={{ alignItems: 'center', width: 90, justifyContent: 'center' }}>
          <TouchableOpacity
            style={{
              width: 80,
              height: 70,
              borderRadius: 18,
              backgroundColor: '#ff9800',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
              shadowColor: '#ff9800',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 3,
            }}
            onPress={() => (navigation as any).navigate('DetailsHeater', {
              siteId: site?.id,
              heaterState: toggles.heater,
              onHeaterChange: handleHeaterChange
            })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="fire" size={30} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginTop: 6, textAlign: 'center' }}>Heater</Text>
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {site?.deviceInfo?.components ? 
                (ensureDetailedComponents(site.deviceInfo.components).heater.power || 0) : 
                Math.round(powerMetrics.power * 0.05)
              }W
            </Text>
          </TouchableOpacity>
        </View>
        {/* High Water - Relay 3 */}
        <View style={{ alignItems: 'center', width: 90 }}>
          <TouchableOpacity
            style={{
              width: 80,
              height: 70,
              borderRadius: 18,
              backgroundColor: '#16989d',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 8,
              shadowColor: '#16989d',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 3,
            }}
            onPress={() => (navigation as any).navigate('DetailsHighWater', {
              siteId: site?.id,
              highWaterState: toggles.highWaterAlarm,
              onHighWaterChange: handleHighWaterChange
            })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="water" size={30} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14, marginTop: 6, textAlign: 'center' }}>High Water</Text>
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 10, marginTop: 2, textAlign: 'center' }}>
              {site?.deviceInfo?.components ? 
                (ensureDetailedComponents(site.deviceInfo.components).highWater.power || 0) : 
                Math.round(powerMetrics.power * 0.05)
              }W
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nouveau design Solids Management */}
      <Text style={{ fontWeight: '800', fontSize: 20, color: '#222', marginTop: 8, marginBottom: 8, textAlign: 'left' }}>Solids Management</Text>
      
      
      
      {/* Bouton pour récupérer les coordonnées Shelly si manquantes */}
      {(!site?.deviceInfo || site.deviceInfo.deviceId === 'unknown') && (
        <View style={{ backgroundColor: '#fff3cd', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#ffeaa7' }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: '#856404', marginBottom: 8 }}>⚠️ Coordonnées Shelly manquantes</Text>
          <Text style={{ fontSize: 14, color: '#856404', marginBottom: 12 }}>
            Les coordonnées Shelly ne sont pas disponibles. Cliquez sur le bouton ci-dessous pour les récupérer automatiquement.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#0c7a7e',
              borderRadius: 8,
              paddingVertical: 8,
              paddingHorizontal: 16,
              alignItems: 'center',
              alignSelf: 'flex-start'
            }}
            onPress={async () => {
              console.log('🔍 Récupération manuelle des coordonnées Shelly...');
              const coordinates = await getRealShellyCoordinates();
              if (coordinates) {
                console.log('✅ Coordonnées récupérées:', coordinates);
                Alert.alert('Success', 'Coordonnées Shelly récupérées avec succès !');
              } else {
                Alert.alert('Error', 'Impossible de récupérer les coordonnées Shelly. Vérifiez que l\'appareil est allumé et connecté.');
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Récupérer coordonnées</Text>
          </TouchableOpacity>
        </View>
      )}


      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 38, marginBottom: 8 }}>
        {/* Replace Bin */}
        <View style={{ alignItems: 'center', width: 120 }}>
          <TouchableOpacity
            style={{
              width: 90,
              height: 85,
              borderRadius: 24,
              backgroundColor: '#16989d',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 14,
              shadowColor: '#16989d',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={() => setConfirmVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="refresh" size={36} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 15, marginTop: 7, textAlign: 'center', lineHeight: 18 }}>Replace{"\n"}Bin</Text>
          </TouchableOpacity>
          {/* Barre de progression fine */}
          <View style={{ width: 80, height: 8, borderRadius: 8, backgroundColor: '#e3e8ee', marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${solidsPct}%`, height: '100%', backgroundColor: '#16989d', borderRadius: 8 }} />
          </View>
        </View>
        {/* Start Heater */}
        <View style={{ alignItems: 'center', width: 120 }}>
          <TouchableOpacity
            style={{
              width: 90,
              height: 85,
              borderRadius: 24,
              backgroundColor: '#16989d',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 14,
              shadowColor: '#16989d',
              shadowOpacity: 0.13,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={() => setHeaterConfirmVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="fire" size={36} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '400', fontSize: 15, marginTop: 7, textAlign: 'center', lineHeight: 18 }}>{'Start\nHeater'}</Text>
        </TouchableOpacity>
          {/* Barre de progression fine */}
          <View style={{ width: 80, height: 8, borderRadius: 8, backgroundColor: '#e3e8ee', marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${heatPct}%`, height: '100%', backgroundColor: '#16989d', borderRadius: 8 }} />
      </View>
        </View>
      </View>
    </View>
  );

  const getToggleIconColor = (key: keyof typeof toggles) => {
    if (key === 'pump') return '#28a745';
    if (key === 'auger') return '#f6c343';
    if (key === 'emergency') return '#d9534f';
    return '#0c7a7e';
  };

  // Ajout état pour la modale de confirmation du heater
  const [heaterConfirmVisible, setHeaterConfirmVisible] = useState(false);

  // Handlers pour les changements d'états des composants individuels
  const handlePumpChange = async (newPumpState: boolean) => {
    console.log('🔧 handlePumpChange appelé avec:', newPumpState);
    const newToggles = { ...toggles, pump: newPumpState };
    setToggles(newToggles);
    
    // Sauvegarder localement ET dans AWS
    console.log('💾 Début sauvegarde locale (pump)...');
    await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
    console.log('☁️ Début sauvegarde AWS (pump)...');
    await saveDeviceStateToAWS(newToggles);
    console.log('✅ Sauvegardes pump terminées');
    
    // Mettre à jour l'état local du site avec les nouveaux composants (structure détaillée)
    if (site) {
      // S'assurer que les composants ont la structure détaillée
      const currentComponents = ensureDetailedComponents(site.deviceInfo?.components);
      
      // Mettre à jour le composant pump avec la structure détaillée
      const updatedComponents = updateComponentDetailed(currentComponents, 'pump', newPumpState);
      
      const updatedSite = {
        ...site,
        deviceInfo: site.deviceInfo ? {
          ...site.deviceInfo,
          components: updatedComponents
        } : site.deviceInfo
      };
      setSite(updatedSite);
      
      // Sauvegarder dans AsyncStorage
      const sitesJson = await AsyncStorage.getItem('sites');
      if (sitesJson) {
        const sites = JSON.parse(sitesJson);
        const updatedSites = sites.map((s: any) => 
          s.id === site.id ? updatedSite : s
        );
        await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      }
    }
  };

  const handleAugerChange = async (newAugerState: boolean) => {
    console.log('🔧 handleAugerChange appelé avec:', newAugerState);
    const newToggles = { ...toggles, auger: newAugerState };
    setToggles(newToggles);
    
    // Sauvegarder localement ET dans AWS
    console.log('💾 Début sauvegarde locale (auger)...');
    await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
    console.log('☁️ Début sauvegarde AWS (auger)...');
    await saveDeviceStateToAWS(newToggles);
    console.log('✅ Sauvegardes auger terminées');
    
    // Mettre à jour l'état local du site avec les nouveaux composants (structure détaillée)
    if (site) {
      // S'assurer que les composants ont la structure détaillée
      const currentComponents = ensureDetailedComponents(site.deviceInfo?.components);
      
      // Mettre à jour le composant auger avec la structure détaillée
      const updatedComponents = updateComponentDetailed(currentComponents, 'auger', newAugerState);
      
      const updatedSite = {
        ...site,
        deviceInfo: site.deviceInfo ? {
          ...site.deviceInfo,
          components: updatedComponents
        } : site.deviceInfo
      };
      setSite(updatedSite);
      
      // Sauvegarder dans AsyncStorage
      const sitesJson = await AsyncStorage.getItem('sites');
      if (sitesJson) {
        const sites = JSON.parse(sitesJson);
        const updatedSites = sites.map((s: any) => 
          s.id === site.id ? updatedSite : s
        );
        await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      }
    }
  };

  const handleHeaterChange = async (newHeaterState: boolean) => {
    console.log('🔧 handleHeaterChange appelé avec:', newHeaterState);
    const newToggles = { ...toggles, heater: newHeaterState };
    setToggles(newToggles);
    
    // Sauvegarder localement ET dans AWS
    console.log('💾 Début sauvegarde locale (heater)...');
    await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
    console.log('☁️ Début sauvegarde AWS (heater)...');
    await saveDeviceStateToAWS(newToggles);
    console.log('✅ Sauvegardes heater terminées');
    
    // Mettre à jour l'état local du site avec les nouveaux composants (structure détaillée)
    if (site) {
      // S'assurer que les composants ont la structure détaillée
      const currentComponents = ensureDetailedComponents(site.deviceInfo?.components);
      
      // Mettre à jour le composant heater avec la structure détaillée
      const updatedComponents = updateComponentDetailed(currentComponents, 'heater', newHeaterState);
      
      const updatedSite = {
        ...site,
        deviceInfo: site.deviceInfo ? {
          ...site.deviceInfo,
          components: updatedComponents
        } : site.deviceInfo
      };
      setSite(updatedSite);
      
      // Sauvegarder dans AsyncStorage
      const sitesJson = await AsyncStorage.getItem('sites');
      if (sitesJson) {
        const sites = JSON.parse(sitesJson);
        const updatedSites = sites.map((s: any) => 
          s.id === site.id ? updatedSite : s
        );
        await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      }
    }
  };

  const handleHighWaterChange = async (newHighWaterState: boolean) => {
    console.log('🔧 handleHighWaterChange appelé avec:', newHighWaterState);
    const newToggles = { ...toggles, highWaterAlarm: newHighWaterState };
    setToggles(newToggles);
    
    // Sauvegarder localement ET dans AWS
    console.log('💾 Début sauvegarde locale (highWater)...');
    await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
    console.log('☁️ Début sauvegarde AWS (highWater)...');
    await saveDeviceStateToAWS(newToggles);
    console.log('✅ Sauvegardes highWater terminées');
    
    // Mettre à jour l'état local du site avec les nouveaux composants (structure détaillée)
    if (site) {
      // S'assurer que les composants ont la structure détaillée
      const currentComponents = ensureDetailedComponents(site.deviceInfo?.components);
      
      // Mettre à jour le composant highWater avec la structure détaillée
      const updatedComponents = updateComponentDetailed(currentComponents, 'highWater', newHighWaterState);
      
      const updatedSite = {
        ...site,
        deviceInfo: site.deviceInfo ? {
          ...site.deviceInfo,
          components: updatedComponents
        } : site.deviceInfo
      };
      setSite(updatedSite);
      
      // Sauvegarder dans AsyncStorage
      const sitesJson = await AsyncStorage.getItem('sites');
      if (sitesJson) {
        const sites = JSON.parse(sitesJson);
        const updatedSites = sites.map((s: any) => 
          s.id === site.id ? updatedSite : s
        );
        await AsyncStorage.setItem('sites', JSON.stringify(updatedSites));
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* ---------- Header ---------- */}
      {/* HEADER MODERN */}
      <View style={styles.headerModern}>
        <SafeAreaView style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
          <TouchableOpacity style={styles.backBtnModern} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={28} color="#0c7a7e" />
        </TouchableOpacity>
          <Image source={require('../assets/waihome_logo.png')} style={styles.logoModern} />
          <TouchableOpacity style={styles.profileBtnModern} onPress={() => navigation.navigate('profile' as never)}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <FontAwesome name="user-circle" size={32} color="#0c7a7e" />
            )}
        </TouchableOpacity>
      </SafeAreaView>
      </View>

      {/* ---------- Message de connexion Shelly ---------- */}
      {!isShellyConnected && (
        <View style={{
          backgroundColor: '#fff3cd',
          marginHorizontal: 16,
          marginTop: 10,
          padding: 12,
          borderRadius: 8,
          borderLeftWidth: 4,
          borderLeftColor: '#ffc107',
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#856404" style={{ marginRight: 8 }} />
          <Text style={{ color: '#856404', fontWeight: '600', flex: 1 }}>
            Shelly not connected - Cannot see real values
          </Text>
        </View>
      )}

      {/* ---------- Rental Property card placée juste après le header ---------- */}
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ height: 20 }} />
      <RentalCard />

        {/* ---------- STATUS/TOGGLES ---------- */}
      {/* (Toggles supprimés, ne garder que le bouton moderne Activate Emergency) */}

        {/* ---------- WATER USAGE ---------- */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Water Usage</Text>
            <View style={{ 
              backgroundColor: '#e8f5e8', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              <View style={{ 
                width: 8, 
                height: 8, 
                borderRadius: 4, 
                backgroundColor: '#0c7a7e', 
                marginRight: 6 
              }} />
              <Text style={{ fontSize: 12, color: '#2d5a2d', fontWeight: '600' }}>Live Data</Text>
            </View>
          </View>
          
          {/* Affichage de la consommation d'aujourd'hui */}
          <View style={{ 
            backgroundColor: '#f8f9fa',
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: '#0c7a7e'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#6c757d', marginBottom: 4 }}>Consommation aujourd'hui</Text>
              {isRefreshingData && (
                <ActivityIndicator size="small" color="#0c7a7e" />
              )}
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0c7a7e' }}>
              {waterHistoryMap[getDateKey(new Date())]?.toFixed(1) || '0.0'} L
            </Text>
            <Text style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>
              {site?.deviceInfo?.components?.pump?.status ? 'Pompe: ON - Débit: 20L/min' : 'Pompe: OFF'}
            </Text>
          </View>
          
          <LineArea 
            data={waterSeries} 
            max={Math.max(300, ...waterSeries, 50)} 
            color="#0c7a7e" 
            xLabels={days}
          />
        </View>

        {/* ---------- POWER MONITORING ---------- */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={styles.cardTitle}>Power Monitoring</Text>
            <View style={{ 
              backgroundColor: '#e8f5e8', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              <View style={{ 
                width: 8, 
                height: 8, 
                borderRadius: 4, 
                backgroundColor: '#28a745', 
                marginRight: 6 
              }} />
              <Text style={{ fontSize: 12, color: '#2d5a2d', fontWeight: '600' }}>Live Data</Text>
            </View>
          </View>
          
          {/* KPIs au-dessus de la courbe */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiVal}>{voltage.toFixed(1)}</Text>
              <Text style={styles.kpiUnit}>V</Text>
              <Text style={styles.kpiLabel}>Voltage</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiVal}>{current.toFixed(2)}</Text>
              <Text style={styles.kpiUnit}>A</Text>
              <Text style={styles.kpiLabel}>Current</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiVal, { color: '#28a745' }]}>{power.toFixed(0)}</Text>
              <Text style={styles.kpiUnit}>W</Text>
              <Text style={styles.kpiLabel}>Power</Text>
            </View>
          </View>
          
          {/* Energy Consumption avec design amélioré */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'flex-end', 
            marginBottom: 16,
            backgroundColor: '#f8f9fa',
            padding: 12,
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: '#0c7a7e'
          }}>
            <View>
              <Text style={[styles.energyTodayVal, { color: '#0c7a7e', fontSize: 36 }]}>
                {energyToday.toFixed(3)}
              </Text>
              <Text style={[styles.energyLabel, { marginBottom: 0, color: '#6c757d', fontWeight: '500' }]}>Energy Consumption</Text>
            </View>
            <Text style={[styles.energyUnit, { color: '#6c757d', marginLeft: 0, marginTop: 0, marginBottom: 4, fontSize: 18 }]}>kWh</Text>
          </View>
          
          {/* Graphique Power avec design amélioré */}
          <View style={{ backgroundColor: '#f8f9fa', borderRadius: 16, padding: 16 }}>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '600', 
              color: '#495057', 
              marginBottom: 12,
              textAlign: 'center'
            }}>
              Power Consumption (7 Days)
            </Text>
            {powerSeries && powerSeries.some(val => val > 0) ? (
              <LineArea 
                data={powerSeries} 
                max={powerMax} 
                color="#28a745" 
                xLabels={days} 
                width={280} 
                height={120}
              />
            ) : (
              <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#6c757d', fontSize: 14, textAlign: 'center' }}>
                  No power data available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bouton moderne Activate Emergency centré (après Power Monitoring) */}
        <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 0 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fdecea',
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: '#d32f2f',
              paddingVertical: 10,
              paddingHorizontal: 18,
              width: 210,
              shadowColor: '#d32f2f',
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
              marginBottom: 4,
            }}
            onPress={() => setToggleConfirm({ key: 'emergency', isOn: toggles.emergency })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="alert" size={22} color="#d32f2f" style={{ marginRight: 10 }} />
            <Text style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.2 }}>Activate Emergency</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ---------- Confirm Modal ---------- */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {replaceSuccess ? (
              <>
                <View style={styles.modalIcon}>
                  <MaterialCommunityIcons name="check-circle" size={40} color="#28a745" />
                </View>
                <Text style={[styles.modalText, { color: '#28a745' }]}>Bin replaced successfully!</Text>
              </>
            ) : (
              <>
                <View style={styles.modalIcon}>
                  <MaterialCommunityIcons name="refresh" size={32} color="#0c7a7e" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#16989d', marginBottom: 12, textAlign: 'center' }}>Replace bin now?</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setConfirmVisible(false)}
                    disabled={isReplacing}
                  >
                    <Text style={styles.modalBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmBtn, isReplacing && { opacity: 0.7 }]}
                    onPress={onConfirmBin}
                    disabled={isReplacing}
                  >
                    {isReplacing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.modalBtnText, styles.confirmText]}>Replace</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- Toggle Confirmation Modal ---------- */}
      {toggleConfirm && toggleConfirm.key === 'emergency' && (
        <Modal
          visible={!!toggleConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setToggleConfirm(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { alignItems: 'center', paddingTop: 24, backgroundColor: '#fff', borderRadius: 20, width: '85%' }] }>
              <MaterialCommunityIcons name="alert" size={32} color="#d32f2f" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', marginBottom: 12, textAlign: 'center' }}>
                Are you sure you want to activate the emergency?
              </Text>
              <Text style={{ color: '#d32f2f', fontSize: 14, marginBottom: 18, textAlign: 'center', fontWeight: '500' }}>
                This will notify all administrators.
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f0f4f8', marginRight: 8, paddingVertical: 10 }]} onPress={() => setToggleConfirm(null)}>
                  <Text style={{ fontWeight: '700', color: '#222', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#d32f2f', marginLeft: 8, paddingVertical: 10 }]} onPress={async () => { 
                  const newToggles = { ...toggles, emergency: true };
                  setToggles(newToggles);
                  
                  // Sauvegarder localement ET dans AWS
                  await saveComponentStatesLocally(newToggles, binReplaced, heaterStarted);
                  await saveDeviceStateToAWS(newToggles);
                  
                  setToggleConfirm(null); 
                }}>
                  <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Yes, Activate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ---------- Heater Confirmation Modal ---------- */}
      <Modal
        visible={heaterConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHeaterConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingTop: 24, backgroundColor: '#fff', borderRadius: 20, width: '85%' }] }>
            <MaterialCommunityIcons name="fire" size={32} color="#ff9800" style={{ marginBottom: 12 }} />
            {heaterStarted ? (
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#28a745', marginBottom: 12, textAlign: 'center' }}>Heater started!</Text>
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#16989d', marginBottom: 12, textAlign: 'center' }}>Are you sure you want to start the heater?</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f0f4f8', marginRight: 8, paddingVertical: 10 }]} onPress={() => setHeaterConfirmVisible(false)}>
                    <Text style={{ fontWeight: '700', color: '#222', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#16989d', marginLeft: 8, paddingVertical: 10 }]} onPress={async () => { 
                    const newHeaterStarted = true;
                    setHeaterStarted(newHeaterStarted); 
                    
                    // Sauvegarder localement ET dans AWS
                    await saveComponentStatesLocally(toggles, binReplaced, newHeaterStarted);
                    await saveDeviceStateToAWS(toggles, binReplaced, newHeaterStarted);
                    
                    setTimeout(() => { 
                      setHeaterStarted(false); 
                      setHeaterConfirmVisible(false); 
                    }, 1200); 
                  }}>
                    <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Yes, Start</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
/* ---------- Small components ---------- */
const ActionBtn = ({ icon, label, onPress }: { icon: MCIconName; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
    <MaterialCommunityIcons name={icon} size={22} color="#fff" />
    <Text style={styles.actionTxt}>{label}</Text>
  </TouchableOpacity>
);

const KPI = ({ value, unit, label }: { value: number; unit: string; label: string }) => (
  <View style={styles.kpiBox}>
    <Text style={styles.kpiVal}>{value}</Text>
    <Text style={styles.kpiUnit}>{unit}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 18 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e3e8ee',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  headerBtnLeft: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 160, height: 32 },
  toggleRow: { flexDirection: "row", justifyContent: "space-evenly", paddingVertical: 16 },
  toggleCard: {
    width: 100,
    borderRadius: 20,
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#81bec6ff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: "#e3e8ee",
    transitionProperty: 'backgroundColor',
    transitionDuration: '0.2s',
  },
  toggleCardOn: { backgroundColor: "#2ec4b6" },
  toggleLabel: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 8, letterSpacing: 0.2 },
  track: { width: 48, height: 24, borderRadius: 12, backgroundColor: "#fff6", marginTop: 10, padding: 2, borderWidth: 1, borderColor: "#e3e8ee" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2 },
  body: { paddingHorizontal: 24, paddingBottom: 64 },
  h1: { fontSize: 26, fontWeight: "800", color: "#2ec4b6", marginVertical: 18, letterSpacing: 0.3 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  actionBtn: {
    flex: 1,
    marginHorizontal: 6,
    backgroundColor: "#2ec4b6",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#e3e8ee",
    transitionProperty: 'backgroundColor',
    transitionDuration: '0.2s',
  },
  actionTxt: { color: "#fff", fontWeight: "700", marginTop: 6, fontSize: 14, letterSpacing: 0.2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#e3e8ee",
  },
  cardTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16, color: "#0c7a7e" },

  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flex: { flex: 1 },

  progressBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#e3e8ee", marginLeft: 14, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },

  newBinBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#0c7a7e", justifyContent: "center", alignItems: "center", marginLeft: 14, elevation: 2 },
  newBinTxt: { marginLeft: 8, fontWeight: "700", color: "#333", fontSize: 13 },
  timeTxt: { marginLeft: 8, fontWeight: "700", color: "#333", fontSize: 13 },

  kpiRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  kpiBox: { alignItems: "center", flex: 1 },
  kpiVal: { fontSize: 32, fontWeight: "800", color: "#222" },
  kpiUnit: { fontSize: 18, color: "#6c757d", marginTop: -4 },
  kpiLabel: { fontSize: 12, color: "#6c757d", marginTop: 2 },

  energyTodayVal: { fontSize: 42, fontWeight: "800", color: "#2ec4b6" },
  energyUnit: { fontSize: 20, color: "#6c757d", alignSelf: "flex-end" },
  energyLabel: { fontSize: 14, color: "#6c757d", marginBottom: 10 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "88%", backgroundColor: "#fff", borderRadius: 28, padding: 32, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 16, elevation: 8 },
  modalIcon: { marginBottom: 10, backgroundColor: '#e6f0f7', borderRadius: 32, padding: 14 },
  modalText: { fontSize: 15, fontWeight: "800", marginBottom: 24, textAlign: "center", color: "#0c7a7e", letterSpacing: 0.2 },
  modalButtons: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, marginHorizontal: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: "#f0f4f8" },
  confirmBtn: { backgroundColor: "#0c7a7e" },
  modalBtnText: { fontSize: 16, fontWeight: "700" },
  confirmText: { color: "#fff" },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 4,
    paddingBottom: 6,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 12,
    color: '#0c7a7e',
    fontWeight: '700',
    marginTop: 2,
  },
  // Styles pour la card modernisée
  rentalCard: {
    backgroundColor: '#f7fafb',
    borderRadius: 24,
    padding: 22,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  sectionBlock: { marginTop: 14 },
  sectionTitle: { fontWeight: '700', fontSize: 15, color: '#0c7a7e', marginBottom: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBgModern: { flex: 1, height: 12, borderRadius: 6, backgroundColor: '#e3e8ee', overflow: 'hidden' },
  progressFillModern: { height: '100%', borderRadius: 6 },
  actionBtnSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0c7a7e', justifyContent: 'center', alignItems: 'center', marginLeft: 10, elevation: 1 },
  actionBtnSmallTxt: { marginLeft: 6, fontWeight: '600', color: '#333', fontSize: 13 },
  timeTxtModern: { marginLeft: 8, fontWeight: '600', color: '#888', fontSize: 13, flexShrink: 0 },
  // HEADER MODERN
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
  logoModern: {
    width: 160,
    height: 32,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  profileBtnModern: {
    marginRight: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnModern: {
    marginLeft: 18,
    backgroundColor: 'rgba(12,122,126,0.07)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Uniformiser le style des lignes Solids Chamber et Heat Cycle
  solidsRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f7fafb',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 56,
  },
  heatRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f7fafb',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 56,
  },
});
