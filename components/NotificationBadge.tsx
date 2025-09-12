// NotificationBadge.tsx
import React, { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NotificationContext } from "../context/NotificationContext";

interface NotificationBadgeProps {
  notificationType?: "medicament" | "rendezvous" | "message";
}

export const NotificationBadge = ({ notificationType = "medicament" }: NotificationBadgeProps) => {
  const { hasNewMedicament, hasNewRendezvous, hasNewMessage } = useContext(NotificationContext);
  
  const showBadge = notificationType === "medicament"
    ? hasNewMedicament
    : notificationType === "rendezvous"
    ? hasNewRendezvous
    : hasNewMessage;

  if (!showBadge) return null;

  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name="bell-ring" size={16} color="white" />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -5,
    right: -10,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center"
  }
});
