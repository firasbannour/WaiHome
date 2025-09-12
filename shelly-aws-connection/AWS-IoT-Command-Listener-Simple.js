// AWS-IoT-Command-Listener-Simple.js
// Version simplifiée pour Shelly Pro 4PM

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
    print("📥 Commande reçue: " + message);
    
    let command = JSON.parse(message);
    let component = command.component;
    let action = command.action;
    
    print("🔍 Composant: " + component + ", Action: " + action);
    
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
      
      print("🔧 " + component + " -> " + (shouldTurnOn ? "ON" : "OFF") + " (Output " + outputId + ")");
      
      // Exécuter la commande
      Shelly.call("Switch.Set", {
        id: outputId,
        on: shouldTurnOn
      }, function(result, error_code, error_message) {
        if (error_code === 0) {
          print("✅ " + component + " " + (shouldTurnOn ? "activé" : "désactivé"));
          
          // Confirmation
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
          print("❌ Erreur: " + error_message);
        }
      });
      
    } else {
      print("❌ Composant non reconnu: " + component);
    }
    
  } catch (e) {
    print("❌ Erreur: " + e);
  }
}

// S'abonner au topic de commandes
print("📡 Abonnement au topic: " + commandTopic);
Shelly.call("MQTT.Subscribe", {
  topic: commandTopic
}, function(result, error_code, error_message) {
  if (error_code === 0) {
    print("✅ Abonné avec succès");
  } else {
    print("❌ Erreur abonnement: " + error_message);
  }
});

// Message de démarrage
print("🚀 Script démarré - En attente de commandes sur: " + commandTopic);
print("🔧 Composants: " + Object.keys(componentMapping).join(", "));

// Test de publication pour vérifier que MQTT fonctionne
Timer.set(2000, false, function() {
  print("🧪 Test de publication MQTT...");
  Shelly.call("MQTT.Publish", {
    topic: "shelly/shelly-waihome-002/status",
    payload: JSON.stringify({
      message: "Script prêt",
      timestamp: new Date().toISOString()
    })
  });
});
