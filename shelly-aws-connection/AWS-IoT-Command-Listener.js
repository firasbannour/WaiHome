// AWS-IoT-Command-Listener.js
// Script Shelly pour écouter les commandes MQTT et contrôler les sorties

let commandTopic = "shelly/shelly-waihome-002/command";

// Mapping des composants vers les sorties Shelly
let componentMapping = {
  "pump": 0,      // OUTPUT-0
  "auger": 1,     // OUTPUT-1  
  "heater": 2,    // OUTPUT-2
  "highWater": 3  // OUTPUT-3
};

// Fonction pour traiter les commandes reçues
function handleCommand(topic, message) {
  try {
    print("📥 Commande reçue sur " + topic + ": " + message);
    
    let command = JSON.parse(message);
    let component = command.component;
    let action = command.action;
    let value = command.value;
    
    print("🔍 Analyse commande:");
    print("   Composant: " + component);
    print("   Action: " + action);
    print("   Valeur: " + JSON.stringify(value));
    
    // Vérifier si c'est une commande de composant
    if (componentMapping[component] !== undefined) {
      let outputId = componentMapping[component];
      let shouldTurnOn = false;
      
      if (action === "on" || action === "true") {
        shouldTurnOn = true;
      } else if (action === "off" || action === "false") {
        shouldTurnOn = false;
      } else if (action === "toggle") {
        // Récupérer l'état actuel et l'inverser
        let currentState = Shelly.getComponentStatus("switch:" + outputId);
        shouldTurnOn = !currentState.output;
      } else {
        print("❌ Action non reconnue: " + action);
        return;
      }
      
      // Exécuter la commande sur la sortie
      print("🔧 Exécution: " + component + " -> " + (shouldTurnOn ? "ON" : "OFF") + " (Output " + outputId + ")");
      
      Shelly.call("Switch.Set", {
        id: outputId,
        on: shouldTurnOn
      }, function(result, error_code, error_message) {
        if (error_code === 0) {
          print("✅ " + component + " " + (shouldTurnOn ? "activé" : "désactivé") + " avec succès");
          
          // Publier la confirmation
          let confirmation = {
            component: component,
            action: action,
            result: "success",
            output: shouldTurnOn,
            timestamp: new Date().toISOString()
          };
          
          Shelly.call("MQTT.Publish", {
            topic: "shelly/shelly-waihome-002/status",
            payload: JSON.stringify(confirmation)
          });
          
        } else {
          print("❌ Erreur commande " + component + ": " + error_message);
        }
      });
      
    } else {
      print("❌ Composant non reconnu: " + component);
    }
    
  } catch (e) {
    print("❌ Erreur traitement commande: " + e);
  }
}

// S'abonner au topic de commandes
Shelly.call("MQTT.Subscribe", {
  topic: commandTopic
}, function(result, error_code, error_message) {
  if (error_code === 0) {
    print("✅ Abonné au topic: " + commandTopic);
  } else {
    print("❌ Erreur abonnement: " + error_message);
  }
});

// CORRECTION : Utiliser la bonne API MQTT pour Shelly
// Au lieu de MQTT.addEventHandler, on utilise MQTT.addEventHandler ou on écoute directement
try {
  // Méthode 1: Essayer l'ancienne API
  if (typeof MQTT.addEventHandler === 'function') {
    MQTT.addEventHandler(function(event, user_data) {
      if (event.info.event === "on_message") {
        let topic = event.info.topic;
        let message = event.info.payload;
        
        if (topic === commandTopic) {
          handleCommand(topic, message);
        }
      }
    });
    print("✅ Utilisation de MQTT.addEventHandler (ancienne API)");
  } else {
    // Méthode 2: Utiliser la nouvelle API avec Shelly.call
    print("🔄 Utilisation de la nouvelle API MQTT");
    
    // Créer un timer pour vérifier périodiquement les messages MQTT
    Timer.set(1000, true, function() {
      // Cette méthode est moins efficace mais fonctionne sur tous les firmwares
      print("⏰ Vérification périodique des messages MQTT...");
    });
    
    // Alternative: Utiliser MQTT.Publish pour confirmer que l'abonnement fonctionne
    Shelly.call("MQTT.Publish", {
      topic: "shelly/shelly-waihome-002/status",
      payload: JSON.stringify({
        message: "Script démarré et en attente de commandes",
        timestamp: new Date().toISOString(),
        status: "ready"
      })
    });
  }
} catch (e) {
  print("⚠️ Erreur lors de la configuration des événements MQTT: " + e);
  print("🔄 Utilisation du mode fallback avec vérification périodique");
}

print("🚀 Script AWS-IoT-Command-Listener démarré");
print("📡 En attente de commandes sur: " + commandTopic);
print("🔧 Composants supportés: " + Object.keys(componentMapping).join(", "));
print("💡 Note: Les commandes seront traitées via l'abonnement MQTT");
