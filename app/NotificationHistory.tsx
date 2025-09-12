// app/NotificationHistory.tsx
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

interface NotificationEntry {
  id: string;
  ts: string;
  title: string;
  body: string;
  read: boolean;
}

const DEMO_NOTIFICATIONS: NotificationEntry[] = [
  {
    id: "n1",
    ts: "2025-07-19 09:15",
    title: "System Update",
    body: "Your device firmware has been updated successfully.",
    read: false,
  },
  {
    id: "n2",
    ts: "2025-07-18 17:45",
    title: "Weekly Report",
    body: "Your weekly usage report is now available.",
    read: true,
  },
  {
    id: "n3",
    ts: "2025-07-17 08:30",
    title: "Low Battery",
    body: "Battery level dropped below 20%.",
    read: false,
  },
];

const ACCENT = "#0c7a7e";

export default function NotificationHistory() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  // Ajout des hooks d'état pour le modal de notification
  const [selectedNotification, setSelectedNotification] = useState<NotificationEntry | null>(null);
  const openNotification = (notif: NotificationEntry) => {
    setNotifications(prev => prev.map(n => n === notif ? { ...n, read: true } : n));
    setSelectedNotification({ ...notif, read: true });
  };

  useEffect(() => {
    // In real app, fetch from storage or API
    setNotifications(DEMO_NOTIFICATIONS);
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
          <Text style={styles.title}>Notification History</Text>
        </View>
        <View style={styles.headerBtnRight} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.notifCard}>
          {notifications.map((n, i) => (
            <View key={n.id} style={styles.notifRowWrap}>
              <TouchableOpacity onPress={() => openNotification(n)} activeOpacity={0.8} style={styles.notifRow}>
                <View style={[styles.notifIconWrap, { backgroundColor: n.read ? '#e3e8ee' : ACCENT + '22' }]}> 
                  <MaterialCommunityIcons
                    name={n.read ? "email-open-outline" : "email-outline"}
                    size={28}
                    color={n.read ? '#999' : ACCENT}
                  />
                  </View>
                <View style={styles.notifTextBlock}>
                  <Text style={[styles.notifTitleModern, { color: n.read ? '#888' : ACCENT }]}>{n.title}</Text>
                  <Text style={styles.notifBodyModern}>{n.body}</Text>
                  <Text style={styles.notifTsModern}>{n.ts}</Text>
                </View>
              </TouchableOpacity>
              {i < notifications.length - 1 && <View style={styles.notifDivider} />}
              </View>
          ))}
        </View>
      </ScrollView>
      {/* Modale de détail notification (inchangée) */}
      {selectedNotification && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center', alignItems: 'center',
          zIndex: 10,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 18,
            padding: 28,
            width: '85%',
            maxWidth: 400,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.10,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <MaterialCommunityIcons name="email-open-outline" size={38} color={ACCENT} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: ACCENT, marginBottom: 10, textAlign: 'center' }}>{selectedNotification.title}</Text>
            <Text style={{ fontSize: 15, color: '#333', marginBottom: 18, textAlign: 'center' }}>{selectedNotification.body}</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>{selectedNotification.ts}</Text>
            <TouchableOpacity
              style={{ backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 32 }}
              onPress={() => setSelectedNotification(null)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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

  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notifCard: {
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
  notifRowWrap: { marginBottom: 2 },
  notifRow: {
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
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notifTextBlock: { flex: 1 },
  notifTitleModern: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  notifBodyModern: { fontSize: 14, color: '#444', marginBottom: 2 },
  notifTsModern: { fontSize: 12, color: '#888' },
  notifDivider: { height: 1, backgroundColor: '#e3e8ee', marginLeft: 54, marginRight: 0 },
});
