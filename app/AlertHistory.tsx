// app/AlertHistory.tsx
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";

interface AlertEntry {
  id: string;
  ts: string;
  msg: string;
  level: "info" | "warn" | "crit";
}

const DEMO_ALERTS: AlertEntry[] = [
  { id: "a1", ts: "2025-07-18 08:20", msg: "High solids level (85 %)", level: "warn" },
  { id: "a2", ts: "2025-07-17 22:05", msg: "Device re-connected",       level: "info" },
  { id: "a3", ts: "2025-07-16 14:10", msg: "Heater fault",              level: "crit" },
];

const ACCENT = "#0c7a7e";

export default function AlertHistory() {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  useEffect(() => {
    setAlerts(DEMO_ALERTS);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtnLeft} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={26} color={ACCENT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Alert History</Text>
        </View>
        <View style={styles.headerBtnRight} />
      </View>

      {/* Contenu */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.alertCard}>
          {alerts.map((a, i) => {
            const color =
              a.level === "crit" ? "#d9534f"
              : a.level === "warn" ? "#f6c343"
              : ACCENT;
            const iconName = a.level === "crit" ? "alert" : "alert-circle";
            return (
              <View key={a.id} style={styles.alertRowWrap}>
                <View style={styles.alertRow}>
                  <View style={[styles.alertIconWrap, { backgroundColor: color + '22' }]}> 
                    <MaterialCommunityIcons
                      name={iconName}
                      size={28}
                      color={color}
                    />
                  </View>
                  <View style={styles.alertTextBlock}>
                    <Text style={[styles.alertMsg, { color }]}>{a.msg}</Text>
                    <Text style={styles.alertTs}>{a.ts}</Text>
                  </View>
                </View>
                {i < alerts.length - 1 && <View style={styles.alertDivider} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT,
  },
  alertCard: {
    backgroundColor: '#f7fafb',
    borderRadius: 18,
    padding: 10,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  alertRowWrap: { marginBottom: 2 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  alertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  alertTextBlock: { flex: 1 },
  alertMsg: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  alertTs: { fontSize: 12, color: '#888' },
  alertDivider: { height: 1, backgroundColor: '#e3e8ee', marginLeft: 54, marginRight: 0 },

  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  icon: {
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  msg: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  ts: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
});
