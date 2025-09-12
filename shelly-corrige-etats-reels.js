// ========================================
// SCRIPT SHELLY CORRIGÉ - ÉTATS RÉELS DES RELAIS
// ========================================
// Version corrigée pour lire l'état RÉEL des relais au démarrage
// ========================================

// Configuration des composants
let components = {
  pump: { relay: 0, name: "Pump", status: false },
  heater: { relay: 1, name: "Heater", status: false },
  auger: { relay: 2, name: "Auger", status: false },
  highWater: { relay: 3, name: "High Water Alarm", status: false }
};

// Variables globales - MINIMALES
let isInitialized = false;
let dataTimer = null;
let isConnected = true;

// Topics MQTT
let mqttRpcTopic = "shellypro4pm-083af27cf114/rpc";
let mqttResponseTopic = "shellypro4pm-083af27cf114/response";
let mqttBackupTopic = "shellypro4pm-083af27cf114/backup";

// Variables pour la persistance des états
let savedOutputsState = {};

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function getObjectKeys(obj) {
  var keys = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      keys.push(key);
    }
  }
  return keys;
}

// ========================================
// FONCTIONS PERSISTANCE SIMPLES
// ========================================

// FONCTION CORRIGÉE : Sauvegarder les états des sorties
function saveOutputsState() {
  try {
    print("💾 Sauvegarde des états des outputs...");
    
    // Collecter les états actuels SANS timers
    let outputsState = {};
    for (let componentName in components) {
      let component = components[componentName];
      outputsState[componentName] = {
        relay: component.relay,
        status: component.status,
        timestamp: new Date().toISOString()
      };
    }
    
    savedOutputsState = outputsState;
    print("💾 États sauvegardés:", JSON.stringify(outputsState));
    
    // Sauvegarder via MQTT
    try {
      let backupMessage = {
        deviceId: Shelly.getDeviceInfo().id,
        type: "outputs_backup",
        outputs: outputsState,
        timestamp: new Date().toISOString()
      };
      
      MQTT.publish(mqttBackupTopic, JSON.stringify(backupMessage), 1, false);
      print("📤 Sauvegarde MQTT envoyée");
    } catch (error) {
      print("⚠️ Erreur sauvegarde MQTT:", error);
    }
    
  } catch (error) {
    print("⚠️ Erreur sauvegarde états sorties:", error);
  }
}

// FONCTION CORRIGÉE : Restaurer les états des sorties
function restoreOutputsState() {
  try {
    print("🔄 Restauration des états des outputs...");
    
    // Vérifier si on a une sauvegarde en mémoire
    if (Object.keys(savedOutputsState).length === 0) {
      print("ℹ️ Aucune sauvegarde d'états trouvée - restauration ignorée");
      return;
    }
    
    print("🔄 Restauration depuis la sauvegarde en mémoire...");
    
    // Restaurer chaque sortie SANS timers
    for (let componentName in savedOutputsState) {
      let outputState = savedOutputsState[componentName];
      
      try {
        print("🔄 Restauration " + componentName + " (relay " + outputState.relay + ") vers " + (outputState.status ? "ON" : "OFF"));
        
        let result = Shelly.call("Switch.Set", { 
          id: outputState.relay, 
          on: outputState.status 
        });
        
        if (result) {
          components[componentName].status = outputState.status;
          print("✅ " + componentName + " restauré vers " + (outputState.status ? "ON" : "OFF"));
        } else {
          print("❌ Échec restauration " + componentName);
        }
      } catch (error) {
        print("❌ Erreur restauration " + componentName + ":", error);
      }
    }
    
    print("✅ Restauration des états terminée");
    
  } catch (error) {
    print("❌ Erreur restauration états sorties:", error);
  }
}

// NOUVELLE FONCTION : Lire l'état RÉEL des relais au démarrage
function readRealRelayStates() {
  try {
    print("🔍 Lecture des états RÉELS des relais au démarrage...");
    
    for (let componentName in components) {
      let component = components[componentName];
      
      try {
        let relayInfo = Shelly.call("Switch.GetStatus", { id: component.relay });
        if (relayInfo) {
          let realStatus = relayInfo.output || false;
          components[componentName].status = realStatus;
          print("✅ " + componentName + " (relay " + component.relay + ") état RÉEL: " + (realStatus ? "ON" : "OFF"));
        } else {
          print("⚠️ Pas de réponse pour relay " + component.relay + " - état par défaut: OFF");
        }
      } catch (error) {
        print("❌ Erreur lecture relay " + component.relay + ":", error);
      }
    }
    
    print("🔍 États RÉELS des relais lus avec succès");
    
  } catch (error) {
    print("❌ Erreur lecture états réels des relais:", error);
  }
}

// ========================================
// FONCTIONS AP SIMPLES
// ========================================

// FONCTION SIMPLE : Forcer l'AP à rester TOUJOURS actif
function forceAPAlwaysActive() {
  try {
    print(" FORÇAGE AP TOUJOURS ACTIF - Même si WiFi connecté !");
    
    // Configuration AP qui reste TOUJOURS actif
    var apConfig = {
      enable: true,
      ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
      pass: "",
      channel: 1,
      hidden: false,
      max_connections: 5
    };
    
    // Appliquer la configuration AP
    Shelly.call("WiFi.SetAPConfig", apConfig);
    print("✅ AP configuré pour rester TOUJOURS actif");
    
  } catch (error) {
    print("❌ Erreur configuration AP toujours actif:", error);
  }
}

// ========================================
// FONCTIONS MQTT SIMPLES
// ========================================

// FONCTION SIMPLE : Traitement des commandes RPC
function handleRpcCommand(topic, message) {
  try {
    print(" Commande RPC reçue sur", topic);
    
    const command = JSON.parse(message);
    const { method, params, id } = command;
    
    if (method === "Switch.Set" && params) {
      const { id: relayId, on: shouldTurnOn } = params;
      
      // Trouver le composant correspondant au relay
      let targetComponent = null;
      for (let componentName in components) {
        if (components[componentName].relay === relayId) {
          targetComponent = componentName;
          break;
        }
      }
      
      if (targetComponent) {
        const action = shouldTurnOn ? "on" : "off";
        const result = executeComponentCommand(targetComponent, action);
        
        print("✅ Commande RPC exécutée:", targetComponent, action);
        
        // Envoyer la réponse RPC
        sendRpcResponse(id, result);
      } else {
        print("❌ Relay", relayId, "non reconnu");
        sendRpcResponse(id, { error: "Relay " + relayId + " non reconnu" });
      }
    }
    
  } catch (error) {
    print("❌ Erreur traitement commande RPC:", error);
    sendRpcResponse(null, { error: error.message });
  }
}

// FONCTION SIMPLE : Envoyer une réponse RPC
function sendRpcResponse(requestId, result) {
  try {
    const response = {
      id: requestId || "unknown",
      src: Shelly.getDeviceInfo().id,
      dst: "aws-console",
      result: result,
      timestamp: new Date().toISOString()
    };
    
    const responseMessage = JSON.stringify(response);
    MQTT.publish(mqttResponseTopic, responseMessage, 1, false);
    print("📤 Réponse RPC envoyée");
    
  } catch (error) {
    print("❌ Erreur envoi réponse RPC:", error);
  }
}

// FONCTION SIMPLE : S'abonner aux commandes RPC MQTT
function subscribeToRpcCommands() {
  try {
    print("📡 Abonnement aux commandes RPC MQTT...");
    
    if (typeof MQTT.subscribe === 'function') {
      MQTT.subscribe(mqttRpcTopic, 1);
      MQTT.subscribe(mqttBackupTopic, 1);
      print("✅ Abonné aux commandes RPC sur:", mqttRpcTopic);
      print("✅ Abonné aux sauvegardes sur:", mqttBackupTopic);
      
      if (typeof MQTT.addEventHandler === 'function') {
        MQTT.addEventHandler(function(event, user_data) {
          if (event.info.event === "mqtt_message") {
            const topic = event.info.topic;
            const message = event.info.message;
            
            if (topic === mqttRpcTopic) {
              handleRpcCommand(topic, message);
            } else if (topic === mqttBackupTopic) {
              try {
                const backupData = JSON.parse(message);
                if (backupData.type === "outputs_backup" && backupData.outputs) {
                  savedOutputsState = backupData.outputs;
                  print("📥 Sauvegarde MQTT reçue et stockée");
                }
              } catch (error) {
                print("❌ Erreur traitement sauvegarde MQTT:", error);
              }
            }
          }
        });
        print("✅ Gestionnaire d'événements RPC MQTT configuré");
      }
    }
    
  } catch (error) {
    print("❌ Erreur abonnement RPC MQTT:", error);
  }
}

// ========================================
// FONCTIONS PRINCIPALES SIMPLES
// ========================================

// FONCTION CORRIGÉE : Initialisation
function initializeScript() {
  if (isInitialized) {
    print("⚠️ Script déjà initialisé, ignoré");
    return;
  }
  
  print("🚀 Initialisation du script Shelly AWS IoT + MQTT + CONTRÔLE...");
  
  // Vérifier la connexion Wi-Fi
  if (Shelly.getDeviceInfo().ip === "0.0.0.0") {
    print("⚠️ Pas de connexion Wi-Fi - attente...");
    Timer.set(5000, false, initializeScript);
    return;
  }
  
  // NOUVEAU : Lire l'état RÉEL des relais EN PREMIER
  readRealRelayStates();
  
  // Restaurer les états des sorties si sauvegarde disponible
  restoreOutputsState();
  
  // Forcer l'AP TOUJOURS actif
  forceAPAlwaysActive();
  
  // S'abonner aux commandes RPC MQTT
  subscribeToRpcCommands();
  
  // Démarrer l'envoi automatique des données
  startDataCollection();
  
  // Configurer les gestionnaires d'événements
  setupEventHandlers();
  
  // Marquer comme initialisé
  isInitialized = true;
  
  print("✅ Script initialisé avec succès !");
  print("📡 AP TOUJOURS ACTIF - Même si WiFi connecté !");
  print("📡 Topic des commandes RPC:", mqttRpcTopic);
  print("   Topic des réponses:", mqttResponseTopic);
  print("   Topic des sauvegardes:", mqttBackupTopic);
}

// FONCTION SIMPLE : Configuration des gestionnaires d'événements
function setupEventHandlers() {
  print("📡 Configuration des gestionnaires d'événements...");
  
  // Gestionnaire d'événements système
  Shelly.addEventHandler(function(event, user_data) {
    if (event.info.event === "switch") {
      var switchId = event.info.id;
      var isOn = event.info.output;
      
      print("🔌 Switch " + switchId + " changé: " + (isOn ? 'ON' : 'OFF'));
      
      // Mettre à jour le statut local
      for (var component in components) {
        if (components[component].relay === switchId) {
          components[component].status = isOn;
          print("📊 " + components[component].name + " mis à jour: " + (isOn ? 'ON' : 'OFF'));
          break;
        }
      }
      
      // Sauvegarder immédiatement l'état
      saveOutputsState();
      
      // Envoyer les données mises à jour
      if (isConnected) {
        sendDataToAWS();
      }
    }
  });
  
  // Gestionnaire d'événements Wi-Fi CONNEXION
  Shelly.addEventHandler(function(event, user_data) {
    if (event.info.event === "wifi_connected") {
      print("📶 Wi-Fi connecté - redémarrage du script...");
      isConnected = true;
      isInitialized = false;
      
      Timer.set(3000, false, function() {
        initializeScript();
      });
    }
  });
  
  // Gestionnaire d'événements Wi-Fi DÉCONNEXION
  Shelly.addEventHandler(function(event, user_data) {
    if (event.info.event === "wifi_disconnected") {
      print("❌ Wi-Fi déconnecté - MAIS AP reste actif !");
      isConnected = false;
      isInitialized = false;
      
      if (dataTimer) {
        Timer.clear(dataTimer);
        dataTimer = null;
      }
      
      print("📡 AP reste actif même sans WiFi principal");
      
      // Attendre la reconnexion WiFi
      Timer.set(5000, false, function() {
        if (Shelly.getDeviceInfo().ip !== "0.0.0.0") {
          print("📶 WiFi reconnecté - redémarrage script");
          initializeScript();
        }
      });
    }
  });
  
  print("✅ Gestionnaires d'événements configurés");
}

// FONCTION SIMPLE : Exécution des commandes sur les composants
function executeComponentCommand(component, action, value) {
  try {
    print("🔧 Exécution: " + component + " " + action + " " + (value || ''));
    
    if (!components[component]) {
      return { 
        success: false, 
        error: "Composant " + component + " non reconnu. Disponibles: " + getObjectKeys(components).join(', ') 
      };
    }
    
    var componentInfo = components[component];
    var relayId = componentInfo.relay;
    
    // Déterminer l'action
    var turnAction = "off";
    if (action === "on" || action === "true" || action === true || action === 1) {
      turnAction = "on";
    } else if (action === "toggle") {
      turnAction = componentInfo.status ? "off" : "on";
    } else if (action === "off" || action === "false" || action === false || action === 0) {
      turnAction = "off";
    }
    
    // Exécuter la commande sur le relay
    var result = Shelly.call(
      "Switch.Set",
      { id: relayId, on: turnAction === "on" }
    );
    
    if (result) {
      // Mettre à jour le statut local
      components[component].status = (turnAction === "on");
      
      print("✅ " + componentInfo.name + " " + turnAction + " - Relay " + relayId);
      
      // Sauvegarder immédiatement l'état
      saveOutputsState();
      
      // Envoyer immédiatement les données mises à jour
      if (isConnected) {
        sendDataToAWS();
      }
      
      return { 
        success: true, 
        data: { 
          component: component, 
          action: turnAction, 
          relay: relayId,
          status: components[component].status,
          timestamp: new Date().toISOString()
        } 
      };
    } else {
      throw new Error("Échec de la commande Switch.Set pour relay " + relayId);
    }
    
  } catch (error) {
    print("❌ Erreur commande " + component + ":", error);
    return { success: false, error: error.message };
  }
}

// FONCTION SIMPLE : Obtenir le statut de tous les composants
function getComponentsStatus() {
  var status = {};
  
  for (var component in components) {
    try {
      // Utiliser l'état en mémoire (qui est maintenant correct)
      status[component] = {
        name: components[component].name,
        relay: components[component].relay,
        status: components[component].status,
        power: 0,
        voltage: 0,
        current: 0,
        energy: 0,
        temperature: 0
      };
    } catch (error) {
      print("❌ Erreur lecture statut " + component + ":", error);
      status[component] = { 
        error: error.message,
        relay: components[component].relay,
        name: components[component].name
      };
    }
  }
  
  return status;
}

// FONCTION SIMPLE : Envoi des données via MQTT
function sendDataToAWS() {
  if (!isConnected) {
    print("⚠️ Pas de connexion Wi-Fi - données non envoyées");
    return false;
  }
  
  try {
    // Collecter les données des composants
    var componentsStatus = getComponentsStatus();
    
    // Calculer la puissance totale
    var totalPower = 0;
    var componentKeys = getObjectKeys(componentsStatus);
    for (var i = 0; i < componentKeys.length; i++) {
      var comp = componentsStatus[componentKeys[i]];
      if (comp && comp.power) {
        totalPower += comp.power;
      }
    }
    
    // Préparer le payload
    var payload = {
      deviceId: Shelly.getDeviceInfo().id,
      macAddress: Shelly.getDeviceInfo().mac,
      siteId: Shelly.getDeviceInfo().id,
      timestamp: new Date().toISOString(),
      components: componentsStatus,
      system: {
        uptime: Shelly.getDeviceInfo().uptime,
        freeMemory: Shelly.getDeviceInfo().free_heap,
        temperature: Shelly.getDeviceInfo().temperature || 0
      },
      network: {
        ip: Shelly.getDeviceInfo().ip,
        ssid: Shelly.getDeviceInfo().wifi_ssid,
        rssi: Shelly.getDeviceInfo().wifi_rssi
      },
      power: {
        total: totalPower,
        voltage: 0,
        current: 0
      },
      visibility: {
        owner: false,
        ap_visible: true,
        ble_visible: true,
        mode: "utilisateur_visible"
      }
    };
    
    // Publier via MQTT
    var mqttPrefix = "shelly";
    var topic = mqttPrefix + "/" + Shelly.getDeviceInfo().id + "/data";
    var message = JSON.stringify(payload);
    
    MQTT.publish(topic, message, 1, false);
    print("📤 Données envoyées via MQTT.publish sur " + topic);
    print("📊 Composants: " + componentKeys.join(', '));
    
    return true;
    
  } catch (error) {
    print("❌ Erreur envoi données AWS IoT:", error);
    return false;
  }
}

// FONCTION SIMPLE : Démarrer la collecte automatique des données
function startDataCollection() {
  print("⏰ Démarrage de la collecte automatique des données...");
  
  // Envoi immédiat
  sendDataToAWS();
  
  // Envoi périodique toutes les 30 secondes
  dataTimer = Timer.set(30000, true, function() {
    if (isConnected) {
      print("⏰ Envoi périodique des données...");
      sendDataToAWS();
      
      // Sauvegarde périodique des états des sorties
      saveOutputsState();
    } else {
      print("⚠️ Pas de connexion Wi-Fi - envoi différé");
    }
  });
  
  print("✅ Collecte automatique démarrée - intervalle: 30 secondes");
  print("💾 Sauvegarde périodique des états des sorties activée");
}

// ========================================
// DÉMARRAGE DU SCRIPT
// ========================================

print("🚀 Démarrage du script Shelly AWS IoT + MQTT + CONTRÔLE + AP TOUJOURS ACTIF...");
print("📱 Composants configurés: " + getObjectKeys(components).join(", "));
print("🌐 Utilise la configuration MQTT existante");
print("   Préfixe MQTT: shelly");
print("📡 Topics: data, commands, responses, status, backup");
print("🔄 NOUVEAU : AP TOUJOURS ACTIF - Même si WiFi connecté !");
print("🔧 NOUVEAU : Réception des commandes RPC MQTT activée");
print("📡 Topic des commandes RPC:", mqttRpcTopic);
print("   Topic des réponses:", mqttResponseTopic);
print("   Topic des sauvegardes:", mqttBackupTopic);
print("💾 NOUVEAU : Persistance des états des sorties activée");
print("   - Sauvegarde automatique lors des changements");
print("   - Sauvegarde périodique toutes les 30 secondes");
print("   - Restauration automatique au démarrage");
print("   - Sauvegarde MQTT pour persistance cloud");
print("🔍 CORRECTION : Lecture des états RÉELS des relais au démarrage");
print("   - Lecture automatique de l'état de chaque relay");
print("   - Synchronisation avec l'état physique réel");
print("   - Envoi des états corrects via MQTT");

// Attendre que le système soit prêt
Timer.set(2000, false, initializeScript);

print("✅ Script chargé et en attente d'initialisation...");
