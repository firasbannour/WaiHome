import React, { useEffect } from "react";
import { View, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Timer de 3 secondes avant de rediriger vers la page de connexion
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 3000);

    // Nettoyage du timer si le composant est démonté
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LinearGradient colors={["#f5fafd", "#b2d8e6"]} style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require("../assets/waihome_logo.png")} 
          style={styles.logo}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 320,
    height: 80,
    resizeMode: 'contain',
  },
});
