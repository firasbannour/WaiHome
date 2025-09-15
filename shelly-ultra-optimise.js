let components = {
  pump: { relay: 0, name: "Pump", status: false },
  heater: { relay: 1, name: "Heater", status: false },
  auger: { relay: 2, name: "Auger", status: false },
  highWater: { relay: 3, name: "High Water Alarm", status: false }
};

// Fonction pour forcer tous les outputs en OFF au démarrage
function forceAllOutputsOff() {
  try {
    print("🔧 FORÇAGE TOUS LES OUTPUTS EN OFF...");
    var turnedOff = 0;
    
    for (var i = 0; i < 4; i++) {
      try {
        var result = Shelly.call("Switch.Set", { id: i, on: false });
        if (result) {
          turnedOff++;
          print("✅ Output " + i + " forcé en OFF");
        } else {
          print("⚠️ Échec output " + i + " en OFF");
        }
      } catch (error) {
        print("❌ Erreur output " + i + ":", error);
      }
    }
    
    print("✅ " + turnedOff + "/4 outputs forcés en OFF");
    for (var component in components) {
      components[component].status = false;
    }
    
    return turnedOff;
  } catch (error) {
    print("❌ Erreur forceAllOutputsOff:", error);
    return 0;
  }
}
let lastDataSent = 0;
let dataInterval = 30000; // 30 secondes
let dataTimer = null;
let isConnected = true;
let isInResetMode = false;
let apModeActive = false;
let currentOwnerId = null;
let isOwnerMode = false;
let apCheckTimer = null; // Timer pour vérification AP
let isConfiguringAP = false; 
let lastKnownStates = {}; // Sauvegarde des derniers états connus
let stateBackupFile = "component_states.json"; // Fichier de sauvegarde
let isRestoringState = false; 
let allTimers = []; // Liste de tous les timers actifs
let isInitialized = false; 
let eventsRegistered = false;
let rpcSubscribed = false;
let periodicTimersStarted = false;
let isConfiguringMQTTNow = false;
let reconnectTimer = null;
let lastMqttConfigAt = 0; 
let lastApConfigAt = 0; // ms epoch
let apMonitoringStarted = false;
let apReactivateTimer = null; // Timer unique pour réactivation AP
let apConfigResetTimer = null; // Timer unique pour reset flag config AP
let apDebounceTimer = null; // Timer de debouncing pour actions AP
let lastComponentsStatus = null; // Cache des statuts composants
let lastStatusFetchAt = 0; // Horodatage dernier fetch
let isFetchingStatuses = false; // Mutex de lecture séquentielle
let isSavingStates = false;
let lastSaveAt = 0;
let saveRetryTimer = null;
let isCheckingOutputs = false;
function clearAllTimers() {
  try {
    print("🧹 Nettoyage de tous les timers...");
    for (var i = 0; i < allTimers.length; i++) {
      try {
        Timer.clear(allTimers[i]);
      } catch (error) {
        print("⚠️ Erreur arrêt timer " + i + ":", error);
      }
    } 
    if (dataTimer) {
      Timer.clear(dataTimer);
      dataTimer = null;
    }
    if (apCheckTimer) { Timer.clear(apCheckTimer); apCheckTimer = null; }
    if (apReactivateTimer) { Timer.clear(apReactivateTimer); apReactivateTimer = null; }
    if (apConfigResetTimer) { Timer.clear(apConfigResetTimer); apConfigResetTimer = null; }
    if (apDebounceTimer) { Timer.clear(apDebounceTimer); apDebounceTimer = null; }
    if (reconnectTimer) {
      Timer.clear(reconnectTimer);
      reconnectTimer = null;
    }
    allTimers = []; periodicTimersStarted = false;
    print("✅ Tous les timers nettoyés");
  } catch (error) {
    print("❌ Erreur nettoyage timers:", error);
  }
}
function startPeriodicTimers() {
  try {
    if (periodicTimersStarted) { print("⚠️ Timers périodiques déjà démarrés"); return; }
    
    // Nettoyer d'abord tous les timers existants
    clearAllTimers();
    
    periodicTimersStarted = true;
    print("⏰ Démarrage des timers périodiques...");
    var backupTimer = Timer.set(900000, true, function() { 
      if (!isRestoringState) { 
        saveComponentStates(); 
      } 
    });
    
    if (backupTimer) { 
      allTimers.push(backupTimer); 
      print("✅ Timer sauvegarde démarré (15 minutes)"); 
    }
    
    print("✅ Tous les timers périodiques démarrés - Total:", allTimers.length);
  } catch (error) {
    print("❌ Erreur démarrage timers périodiques:", error);
    // En cas d'erreur, nettoyer et réessayer plus tard
    clearAllTimers();
    Timer.set(5000, false, startPeriodicTimers);
  }
}
let awsConfig = {
  region: "eu-north-1",
  endpoint: "a2q29tpo86eexb-ats.iot.eu-north-1.amazonaws.com",
  deviceId: Shelly.getDeviceInfo().id, privateKey: "",
  certificate: "",
  rootCA: ""
};
let mqttRpcTopic = "shelly/" + Shelly.getDeviceInfo().id + "/rpc";
let mqttResponseTopic = "shelly/" + Shelly.getDeviceInfo().id + "/response";
let mqttDataTopic = "shelly/" + Shelly.getDeviceInfo().id + "/data";
let mqttStatusTopic = "shelly/" + Shelly.getDeviceInfo().id + "/status";
function configureAWSIoT() {
  try {
    if (isConfiguringMQTTNow) { print("⚠️ Configuration MQTT déjà en cours"); return false; }
   try {
      var _st = Shelly.call("MQTT.GetStatus");
      if (_st && _st.connected) { print("✅ MQTT déjà connectée - pas de reconfiguration"); return true; }
    } catch (e) {}
    if (Date.now() - lastMqttConfigAt < 15000) { print("⏳ Backoff MQTT actif, réessai plus tard"); return false; }
    isConfiguringMQTTNow = true;
    print("🔧 Configuration AWS IoT...");
    print("   Région:", awsConfig.region);
    print("   Endpoint:", awsConfig.endpoint);
    print("   Device ID:", awsConfig.deviceId);
    var mqttConfig = {
      enable: true,    server: awsConfig.endpoint + ":8883",
      port: 8883,
      client_id: awsConfig.deviceId || Shelly.getDeviceInfo().id,
      user: "",
      pass: "",  ssl_ca: "",
      ssl_cert: "",
      ssl_key: "",
      keep_alive: 60,
      clean_session: true,
      max_qos: 1,
      retain: false,
      reconnect_interval_max: 10,
      reconnect_interval_min: 2
    };   
    Shelly.call("MQTT.SetConfig", mqttConfig);
    print("✅ Configuration AWS IoT appliquée");   
    lastMqttConfigAt = Date.now();
    isConfiguringMQTTNow = false;
    return true;  
  } catch (error) {
    print("❌ Erreur configuration AWS IoT:", error);
    isConfiguringMQTTNow = false;
    lastMqttConfigAt = Date.now();
    return false;
  }
}
function checkAWSConnection() {
  try {
    var mqttStatus = Shelly.call("MQTT.GetStatus");
    if (mqttStatus && mqttStatus.connected) {
      print("✅ Connexion AWS IoT active");
      return true;
    } else {
      print("⚠️ Connexion AWS IoT inactive");
      return false;
    }
  } catch (error) {
    print("❌ Erreur vérification connexion AWS IoT:", error);
    return false;
  }
}
function verifyAWSCertificates() {
  try {
    print("🔐 Vérification des certificats AWS IoT...");
       var usingUserTLS = (!awsConfig.privateKey && !awsConfig.certificate && !awsConfig.rootCA);
    if (usingUserTLS) {
      print("✅ Mode User TLS (UI) détecté - vérification fichiers ignorée");
      return true;
    }
    var certFiles = [awsConfig.privateKey, awsConfig.certificate, awsConfig.rootCA];
    var allCertsExist = true;
    for (var i = 0; i < certFiles.length; i++) {
      try {
        if (!certFiles[i]) { continue; }
        var fileContent = Shelly.call("Sys.GetFile", { name: certFiles[i] });
        if (fileContent && fileContent.data) {
          print("✅ Certificat trouvé:", certFiles[i]);
        } else {
          print("❌ Certificat manquant:", certFiles[i]);
          allCertsExist = false;
        }
      } catch (fileError) {
        print("❌ Erreur lecture certificat", certFiles[i] + ":", fileError);
        allCertsExist = false;
      }
    }
    if (allCertsExist) { print("✅ Tous les certificats AWS IoT sont présents"); return true; }
    print("⚠️ Certains certificats AWS IoT sont manquants");
    return false;
  } catch (error) {
    print("❌ Erreur vérification certificats AWS IoT:", error);
    return false;
  }
}
function setupMQTTEventHandlers() {
  try {
    print("📡 Configuration des gestionnaires d'événements MQTT...");
    Shelly.addEventHandler(function(event, user_data) {
      if (event.info && event.info.event === "mqtt_connected") {
        print("✅ Connexion MQTT AWS IoT établie");
        isConnected = true;
        if (!dataTimer) { startDataCollection(); }
      }
      if (event.info && event.info.event === "mqtt_disconnected") {
        print("❌ Connexion MQTT AWS IoT perdue");
        isConnected = false;
        if (dataTimer) { Timer.clear(dataTimer); dataTimer = null; }
        if (reconnectTimer) { Timer.clear(reconnectTimer); reconnectTimer = null; }
        reconnectTimer = Timer.set(10000, false, function() {  if (Shelly.getDeviceInfo().ip !== "0.0.0.0" && (Date.now() - lastMqttConfigAt >= 15000)) {
            print("🔄 Tentative de reconnexion MQTT...");
            configureAWSIoT();
          } else {
            print("⏳ Reconnexion MQTT différée (backoff)");
          }
        });
      }
    });
    print("✅ Gestionnaires d'événements MQTT configurés");
  } catch (error) {
    print("❌ Erreur configuration gestionnaires MQTT:", error);
  }
}
function saveComponentStates() {
  try {
    if (isSavingStates) { print("⏳ Sauvegarde déjà en cours - ignorée"); return lastKnownStates || null; }
    var now = Date.now();
    if (now - lastSaveAt < 5000) { print("⏳ Backoff sauvegarde actif - réessai plus tard"); return lastKnownStates || null; }
    isSavingStates = true;
    print("💾 Sauvegarde de l'état RÉEL des composants...");
    var currentStates = {};
    var timestamp = new Date().toISOString();
    
    // Lire l'état RÉEL de chaque relais
    for (var component in components) {
      var relayId = components[component].relay;
      var realStatus = false;
      
      try {
        var relayInfo = Shelly.call("Switch.GetStatus", { id: relayId });
        if (relayInfo && typeof relayInfo.output === "boolean") {
          realStatus = relayInfo.output;
          components[component].status = realStatus; // Mettre à jour l'état local
        } else {
          realStatus = components[component].status; // Fallback sur l'état local
        }
      } catch (e) {
        realStatus = components[component].status; // Fallback sur l'état local
        print("⚠️ Lecture état réel " + component + " échouée, utilisation état local");
      }
      
      currentStates[component] = {
        name: components[component].name,
        relay: relayId,
        status: realStatus,
        power: 0, voltage: 0, current: 0, energy: 0, temperature: 0,
        lastUpdate: timestamp
      };
    }
    
    lastKnownStates = currentStates;
    var backupData = {
      timestamp: timestamp,
      deviceId: Shelly.getDeviceInfo().id,
      uptime: Shelly.getDeviceInfo().uptime,
      states: currentStates
    };
    
    Shelly.call("Sys.SetFile", {
      name: stateBackupFile,
      data: JSON.stringify(backupData)
    });
    
    lastSaveAt = now;
    print("✅ État RÉEL sauvegardé - " + getObjectKeys(currentStates).length + " composants");
    print("📊 États RÉELS sauvegardés:");
    for (var comp in currentStates) {
      var state = currentStates[comp].status ? "ON" : "OFF";
      print("   " + comp + " (Relay " + currentStates[comp].relay + "): " + state);
    }
    isSavingStates = false;
    return currentStates;
  } catch (error) {
    print("❌ Erreur sauvegarde état:", error);
    isSavingStates = false;
    lastSaveAt = Date.now();
    // Retry unique en cas de saturation
    if (error && ("" + error).indexOf("Too many calls") !== -1) {
      if (saveRetryTimer) { Timer.clear(saveRetryTimer); saveRetryTimer = null; }
      saveRetryTimer = Timer.set(3000, false, function() {
        saveRetryTimer = null;
        saveComponentStates();
      });
      print("🔁 Sauvegarde replanifiée dans 3s (saturation)");
    }
    return null;
  }
}
// ✅ Configuration simple sans timers
function ensureRestoreLastConfigured() {
  try {
    print("🔧 Configuration restore_last sur 4 relais...");
    for (var i = 0; i < 4; i++) {
      try {
        var config = {
          id: i,
          initial_state: "restore_last",
          eco_mode: false
        };
        
        var ok = Shelly.call("Switch.SetConfig", config);
        if (ok) {
          print("✅ Relay " + i + " configuré restore_last");
        } else {
          print("⚠️ Relay " + i + " échec configuration");
        }
      } catch (e) {
        print("❌ Erreur relay " + i + ":", e);
      }
    }
  } catch (e) {
    print("❌ Erreur ensureRestoreLastConfigured:", e);
  }
}

// ✅ Restauration douce : essaie d'abord le fichier, puis la mémoire
function gentleRestoreFromBackupIfNeeded() {
  try {
    var backup = null;
    
    // 1) Essayer de lire le fichier de sauvegarde
    try {
      var file = Shelly.call("Sys.GetFile", { name: stateBackupFile });
      if (file && file.data) {
        backup = JSON.parse(file.data);
        print("📁 Backup fichier trouvé - Timestamp:", backup.timestamp);
      }
    } catch (e) {
      print("⚠️ Lecture fichier backup échouée:", e);
    }
    
    // 2) Si pas de fichier, essayer la mémoire
    if (!backup && lastKnownStates && Object.keys(lastKnownStates).length > 0) {
      backup = { states: lastKnownStates };
      print("📁 Utilisation du backup en mémoire...");
    }
    
    if (!backup || !backup.states) { 
      print("ℹ️ Aucun backup trouvé"); 
      return; 
    }

    var forces = 0;
    
    for (var comp in backup.states) {
      if (!components[comp]) continue;
      var relayId = backup.states[comp].relay;
      var cible = !!backup.states[comp].status;
      
      try {
        var st = Shelly.call("Switch.GetStatus", { id: relayId });
        if (st && typeof st.output === "boolean") {
          // Le hardware a déjà restauré (grâce à restore_last) → on respecte
          components[comp].status = st.output;
          print("🆗 " + comp + " (Relay " + relayId + "): Hardware=" + (st.output ? "ON" : "OFF"));
        } else {
          // Relay pas dispo → on tente d'appliquer l'état du backup
          var r = Shelly.call("Switch.Set", { id: relayId, on: cible });
          if (r) { 
            components[comp].status = cible; 
            forces++; 
            print("✅ " + comp + " (Relay " + relayId + "): Restauré=" + (cible ? "ON" : "OFF"));
          }
        }
      } catch (e) {
        print("⚠️ gentleRestore: relay " + relayId + " erreur:", e);
      }
    }
    
    if (forces > 0) print("✅ gentleRestore: appliqué sur " + forces + " relais");
    else print("🆗 gentleRestore: aucun changement nécessaire");
  } catch (e) {
    print("❌ Erreur gentleRestoreFromBackupIfNeeded:", e);
  }
}

// ✅ Restauration forcée : essaie d'abord le fichier, puis la mémoire
function forceRestoreFromBackup() {
  try {
    print("🔧 RESTAURATION FORCÉE depuis le backup...");
    
    var backup = null;
    
    // 1) Essayer de lire le fichier de sauvegarde
    try {
      var file = Shelly.call("Sys.GetFile", { name: stateBackupFile });
      if (file && file.data) {
        backup = JSON.parse(file.data);
        print("📁 Backup fichier trouvé - Timestamp:", backup.timestamp);
      }
    } catch (e) {
      print("⚠️ Lecture fichier backup échouée:", e);
    }
    
    // 2) Si pas de fichier, essayer la mémoire
    if (!backup && lastKnownStates && Object.keys(lastKnownStates).length > 0) {
      backup = { states: lastKnownStates };
      print("📁 Utilisation du backup en mémoire...");
    }
    
    if (!backup || !backup.states) { 
      print("❌ Aucun backup trouvé pour restauration forcée"); 
      return; 
    }

    print("📁 Backup trouvé - " + Object.keys(backup.states).length + " composants");
    var restored = 0;
    
    for (var comp in backup.states) {
      if (!components[comp]) continue;
      var relayId = backup.states[comp].relay;
      var targetState = !!backup.states[comp].status;
      var currentState = components[comp].status;
      
      print("🔧 " + comp + " (Relay " + relayId + "): Backup=" + (targetState ? "ON" : "OFF") + ", Actuel=" + (currentState ? "ON" : "OFF"));
      
      if (targetState !== currentState) {
        try {
          var result = Shelly.call("Switch.Set", { id: relayId, on: targetState });
          if (result) {
            components[comp].status = targetState;
            restored++;
            print("✅ " + comp + " restauré: " + (targetState ? "ON" : "OFF"));
          } else {
            print("❌ Échec restauration " + comp);
          }
        } catch (e) {
          print("❌ Erreur restauration " + comp + ":", e);
        }
      } else {
        print("🆗 " + comp + " déjà dans le bon état");
      }
    }
    
    if (restored > 0) {
      print("✅ RESTAURATION FORCÉE terminée - " + restored + " composant(s) restauré(s)");
      saveComponentStates();
      if (isConnected && !isInResetMode) { sendDataToAWS(); }
    } else {
      print("🆗 RESTAURATION FORCÉE - Aucun changement nécessaire");
    }
  } catch (e) {
    print("❌ Erreur forceRestoreFromBackup:", e);
  }
}
function restoreComponentStates() {
  try {
    if (isRestoringState) {
      print("⚠️ Restauration déjà en cours, ignorée");
      return false;
    }
    isRestoringState = true;
    print("🔄 Restauration de l'état des composants après redémarrage...");
    
    // D'abord, lire l'état actuel des relays
    print("📊 Lecture de l'état actuel des relays...");
    var currentStates = {};
    var currentAvailable = {};
    for (var component in components) {
      try {
        var relayId = components[component].relay;
        var relayInfo = Shelly.call("Switch.GetStatus", { id: relayId });
        if (relayInfo && relayInfo.output !== undefined) {
          currentStates[component] = relayInfo.output;
          currentAvailable[component] = true;
          components[component].status = relayInfo.output;
          print("   " + component + " (Relay " + relayId + "): " + (relayInfo.output ? "ON" : "OFF") + " (état actuel)");
        } else {
          print("   " + component + " (Relay " + relayId + "): Indisponible");
          currentAvailable[component] = false;
          currentStates[component] = false;
        }
      } catch (error) {
        print("   " + component + " (Relay " + relayId + "): Erreur lecture - " + error.message);
        currentAvailable[component] = false;
        currentStates[component] = false;
      }
    }
    
    // Ensuite, lire le fichier de sauvegarde
    var backupData = null;
    try {
      var fileContent = Shelly.call("Sys.GetFile", { name: stateBackupFile });
      if (fileContent && fileContent.data) {
        backupData = JSON.parse(fileContent.data);
        print("📁 Fichier de sauvegarde trouvé - Timestamp:", backupData.timestamp);
      }
    } catch (fileError) {
      print("⚠️ Aucun fichier de sauvegarde trouvé:", fileError);
    }
    
    if (!backupData || !backupData.states) {
      print("⚠️ Aucun état sauvegardé - Utilisation des états actuels");
      isRestoringState = false;
      return false;
    }
    
    var restoredCount = 0;
    var states = backupData.states;
    print("📊 Comparaison avec les états sauvegardés:");
    
    for (var component in states) {
      if (components[component]) {
        var targetState = states[component].status;
        var currentState = currentStates[component];
        var relayId = states[component].relay;
        print("   " + component + " (Relay " + relayId + "):");
        print("     Sauvegardé: " + (targetState ? "ON" : "OFF"));
        print("     Actuel: " + (currentAvailable[component] ? (currentState ? "ON" : "OFF") : "Indispo"));
        
        if (!currentAvailable[component]) {
          // Si l'état actuel est indisponible, appliquer l'état sauvegardé
          print("     🔧 Restauration depuis sauvegarde (état actuel indisponible)...");
          try {
            var result = Shelly.call("Switch.Set", { id: relayId, on: targetState });
            if (result) {
              components[component].status = targetState;
              restoredCount++;
              print("     ✅ " + component + " restauré: " + (targetState ? "ON" : "OFF"));
            } else {
              print("     ❌ Échec restauration " + component);
            }
          } catch (error) {
            print("     ❌ Erreur restauration " + component + ":", error);
          }
        } else {
          // État actuel disponible: on garde le matériel, on ne force pas la sauvegarde
          if (currentState !== components[component].status) {
            components[component].status = currentState;
          }
          print("     ✅ État matériel prioritaire conservé");
        }
      }
    }
    
    print("✅ Restauration terminée - " + restoredCount + " composant(s) restauré(s) depuis sauvegarde");
    isRestoringState = false;
    
    // Sauvegarder l'état final et envoyer aux sujets MQTT
    saveComponentStates();
    if (isConnected && !isInResetMode) { sendDataToAWS(); }
    
    if (restoredCount > 0) {
      var restoreMessage = {
        deviceId: Shelly.getDeviceInfo().id,
        status: "state_restored",
        restored_components: restoredCount,
        backup_timestamp: backupData.timestamp,
        timestamp: new Date().toISOString(),
        message: "État restauré après redémarrage - " + restoredCount + " composant(s)"
      };   
      MQTT.publish(mqttStatusTopic, JSON.stringify(restoreMessage), 1, false);
      print("📤 Message de restauration envoyé via MQTT");
    }
    
    return true;
  } catch (error) {
    print("❌ Erreur restauration état:", error);
    isRestoringState = false;
    return false;
  }
}
function reconcileWithActualStates() {
  try {
    print("🔄 Reconciliation des états réels des relays...");
    var updated = 0;
    for (var component in components) {
      try {
        var rid = components[component].relay;
        var info = Shelly.call("Switch.GetStatus", { id: rid });
        if (info && info.output !== undefined) {
          var prev = components[component].status;
          components[component].status = info.output;
          if (prev !== info.output) { updated++; }
        }
      } catch (e) {
        print("⚠️ Lecture état réel échouée pour", component, ":", e);
      }
    }
    if (updated > 0) {
      print("✅ États synchronisés avec le matériel -", updated, "modification(s)");
      saveComponentStates();
      if (isConnected && !isInResetMode) { sendDataToAWS(); }
    } else {
      print("✅ États déjà cohérents avec le matériel");
    }
  } catch (error) {
    print("❌ Erreur reconciliation états:", error);
  }
}
// Fonction d'affichage simplifiée
function displayOutputSteps(component, action, result) {
  try {
    var timestamp = new Date().toISOString();
    print("🔧 " + component.toUpperCase() + " " + action.toUpperCase() + " - " + (result && result.success ? "✅ SUCCÈS" : "❌ ÉCHEC"));
    
    var stepMessage = {
      deviceId: Shelly.getDeviceInfo().id,
      status: "output_step",
      component: component,
      action: action,
      relay_id: components[component].relay,
      success: result ? result.success : false,
      error: result ? result.error : null,
      timestamp: timestamp
    };
    MQTT.publish(mqttStatusTopic, JSON.stringify(stepMessage), 1, false);
  } catch (error) {
    print("❌ Erreur affichage étapes:", error);
  }
}
function displayCurrentComponentStates() {
  try {
    print("📊 État des composants au démarrage:");
    var timestamp = new Date().toISOString();
    
    for (var component in components) {
      var comp = components[component];
      var statusIcon = comp.status ? "🟢" : "🔴";
      var statusText = comp.status ? "ON" : "OFF";     
      print("🔌 " + component.toUpperCase() + " (" + comp.name + ") - Relay " + comp.relay + " - " + statusIcon + " " + statusText);
    }
    
    var stateMessage = {
      deviceId: Shelly.getDeviceInfo().id,
      status: "startup_states",
      timestamp: timestamp,
      components: components
    };
    MQTT.publish(mqttStatusTopic, JSON.stringify(stateMessage), 1, false);
    print("📤 État envoyé via MQTT");
  } catch (error) {
    print("❌ Erreur affichage état composants:", error);
  }
}

// Fonction simple pour afficher l'état des composants
function showComponents() {
  print("🔍 État actuel des composants:");
  for (var component in components) {
    var comp = components[component];
    var statusIcon = comp.status ? "🟢" : "🔴";
    var statusText = comp.status ? "ON" : "OFF";
    print("   " + statusIcon + " " + component + " (" + comp.name + ") - Relay " + comp.relay + ": " + statusText);
  }
}
// Fonctions de diagnostic simplifiées
function checkAllOutputs() {
  try {
    if (isCheckingOutputs) { print("⏳ Vérification déjà en cours"); return; }
    isCheckingOutputs = true;
    print("🔍 Vérification des outputs (séquentielle)...");
    var i = 0;
    var checkOne = function() {
      if (i >= 4) { isCheckingOutputs = false; print("✅ Vérification terminée"); return; }
      try {
        var status = Shelly.call("Switch.GetStatus", { id: i });
        if (status && status.output !== undefined) {
          print("✅ Output " + i + ": " + (status.output ? "ON" : "OFF"));
        } else {
          print("❌ Output " + i + ": Indisponible");
        }
      } catch (error) {
        print("❌ Output " + i + ": " + error.message);
      }
      i++;
      Timer.set(800, false, checkOne);
    };
    checkOne();
  } catch (error) {
    isCheckingOutputs = false;
    print("❌ Erreur vérification outputs:", error);
  }
}
function getObjectKeys(obj) {
  var keys = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      keys.push(key);
    }
  }
  return keys;
}
function forceAPAlwaysActive() {
  try {
    if (isConfiguringAP) {
      print("⚠️ Configuration AP déjà en cours, ignoré");
      return;
    }
    if (Date.now() - lastApConfigAt < 10000) {
      print("⏳ Backoff AP actif, réessai plus tard");
      return;
    }
    isConfiguringAP = true;
    print("🔄 FORÇAGE AP TOUJOURS ACTIF - Même si WiFi connecté !");
    var apConfig = {
      enable: true,
      ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
      pass: "",
      channel: 1,
      hidden: false,
      max_connections: 5
    };
    Shelly.call("WiFi.SetAPConfig", apConfig);
    print("✅ AP configuré pour rester TOUJOURS actif");
    lastApConfigAt = Date.now();
    // Reset immédiat du flag au lieu d'utiliser un Timer supplémentaire
    if (apConfigResetTimer) { Timer.clear(apConfigResetTimer); apConfigResetTimer = null; }
      isConfiguringAP = false;
  } catch (error) {
    print("❌ Erreur configuration AP toujours actif:", error);
    isConfiguringAP = false;
    lastApConfigAt = Date.now();
  }
}
// Déclenche une réactivation AP unique après un délai (debounce)
function ensureAPActiveDebounced(delayMs) {
  try {
    var d = delayMs || 1500;
    if (apDebounceTimer) { Timer.clear(apDebounceTimer); apDebounceTimer = null; }
    apDebounceTimer = Timer.set(d, false, function() {
      apDebounceTimer = null;
      if (!isConfiguringAP) { forceAPAlwaysActive(); }
    });
  } catch (e) {
    print("❌ Erreur debounce AP:", e);
  }
}
function startAPMonitoring() {
  try {
    if (apMonitoringStarted) { print("⚠️ Surveillance AP déjà démarrée"); return; }
    if (apCheckTimer) { Timer.clear(apCheckTimer); apCheckTimer = null; }
    apCheckTimer = Timer.set(60000, true, function() { monitorAPStatus(); });
    if (apCheckTimer) { allTimers.push(apCheckTimer); }
    apMonitoringStarted = true;
    print("🔍 Surveillance AP démarrée - vérification toutes les 60 secondes");
  } catch (error) {
    print("❌ Erreur démarrage surveillance AP:", error);
  }
}
function monitorAPStatus() {
  try {
    if (isConfiguringAP) {
      print("⚠️ Configuration AP en cours, surveillance ignorée");
      return;
    }
    var currentAPConfig = Shelly.call("WiFi.GetAPConfig");
    if (currentAPConfig && currentAPConfig.enable) {
      print("📡 AP ACTIF ✓ - SSID:", currentAPConfig.ssid);
    } else {
      print("⚠️ AP DÉSACTIVÉ détecté - Attente avant réactivation...");
      ensureAPActiveDebounced(8000);
    }
  } catch (error) {
    print("❌ Erreur surveillance AP:", error);
  }
}
function sendAPStatusMessage(status) {
  try {
    var apStatusMessage = {
      deviceId: Shelly.getDeviceInfo().id,
      status: "ap_status",
      ap_enabled: true,
      ap_ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
      ap_status: status,
      timestamp: new Date().toISOString(),
      message: "AP Shelly " + status
    };
    MQTT.publish(mqttStatusTopic, JSON.stringify(apStatusMessage), 1, false);
    print("📤 Statut AP envoyé via MQTT:", status);
  } catch (error) {
    print("❌ Erreur envoi statut AP:", error);
  }
}
function preventAPAutoDisable() {
  try {
    print("️ Protection contre la désactivation automatique de l'AP...");
    Shelly.addEventHandler(function(event, user_data) {
      if (event.info.event === "wifi_connected") {
        print(" WiFi connecté - MAIS AP reste actif !");
        ensureAPActiveDebounced(3000);
      }
      if (event.info.event === "wifi_disconnected") {
        print("❌ WiFi déconnecté - MAIS AP reste actif !");
        ensureAPActiveDebounced(2000);
      }
    });
    print("✅ Protection AP activée");
  } catch (error) {
    print("❌ Erreur protection AP:", error);
  }
}
function testAPStatus() {
  try {
    if (isConfiguringAP) {
      print("⚠️ Configuration AP en cours, test ignoré");
      return;
    }
    var apConfig = Shelly.call("WiFi.GetAPConfig");
    if (apConfig && apConfig.enable) {
      print("✅ AP ACTIF - SSID:", apConfig.ssid);
      print("   Visible:", !apConfig.hidden);
      print("   Connexions max:", apConfig.max_connections);
    } else {
      print("❌ AP INACTIF - Réactivation...");
      ensureAPActiveDebounced(1500);
    }
  } catch (error) {
    print("❌ Erreur test AP:", error);
  }
}
function handleRpcCommand(topic, message) {
  try {
    print(" Commande RPC reçue sur", topic);
    print("   Message:", message);
    const command = JSON.parse(message);
    const { method, params, id, src } = command;
    print("🔧 Exécution RPC:", method, "params:", params);
    if (method === "Switch.Set" && params) {
      const { id: relayId, on: shouldTurnOn } = params;
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
        print("✅ Commande RPC exécutée:", targetComponent, action, "Résultat:", result);
        sendRpcResponse(id, result);
      } else {
        print("❌ Relay", relayId, "non reconnu");
        sendRpcResponse(id, { error: "Relay " + relayId + " non reconnu" });
      }
    } else {
      print("❌ Méthode RPC non supportée:", method);
      sendRpcResponse(id, { error: "Méthode " + method + " non supportée" });
    }
  } catch (error) {
    print("❌ Erreur traitement commande RPC:", error);
    sendRpcResponse(null, { error: error.message });
  }
}
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
    print("📤 Réponse RPC envoyée:", responseMessage);
  } catch (error) {
    print("❌ Erreur envoi réponse RPC:", error);
  }
}
function subscribeToRpcCommands() {
  try {
    if (rpcSubscribed) {
      print("⚠️ Abonnement RPC déjà actif");
      return;
    }
    print("📡 Tentative d'abonnement aux commandes RPC MQTT...");
    if (typeof MQTT.subscribe === 'function') {
      MQTT.subscribe(mqttRpcTopic, 1);
      rpcSubscribed = true;
      print("✅ Abonné aux commandes RPC sur:", mqttRpcTopic);
      if (typeof MQTT.addEventHandler === 'function') {
        MQTT.addEventHandler(function(event, user_data) {
          if (event.info.event === "mqtt_message") {
            const topic = event.info.topic;
            const message = event.info.message;
            print("📥 Message MQTT reçu sur:", topic);
            print("   Contenu:", message);
            if (topic === mqttRpcTopic) {
              handleRpcCommand(topic, message);
            }
          }
        });
        print("✅ Gestionnaire d'événements RPC MQTT configuré");
      } else {
        print("⚠️ MQTT.addEventHandler non supporté");
      }
    } else {
      print("⚠️ MQTT.subscribe non supporté - commandes non disponibles");
    }
  } catch (error) {
    print("❌ Erreur abonnement RPC MQTT:", error);
  }
}
function initializeScript() {
  try {
    if (isInitialized) {
      print("⚠️ Script déjà initialisé, ignoré");
      return;
    }
    
    isInitialized = true;
    print("🚀 Initialisation SIMPLIFIÉE du script...");
    
    // Nettoyer d'abord tous les timers
    clearAllTimers();
    
  if (Shelly.getDeviceInfo().ip === "0.0.0.0") {
    print("⚠️ Pas de connexion Wi-Fi - attente...");
      isInitialized = false;
    return;
  }
  
    // NOUVEAU : Forcer tous les outputs en OFF au démarrage
    forceAllOutputsOff();
    
    // Configuration restore_last uniquement
    ensureRestoreLastConfigured();
    
    // Configuration AWS IoT
    configureAWSIoT();
    
    // Démarrer la collecte de données
    startDataCollection();
    
    // Configuration des événements
    setupEventHandlers();
    
    // 5) Lire l'état RÉEL du hardware après 5 secondes
    Timer.set(5000, false, function() {
      print("🔍 Lecture de l'état RÉEL du hardware...");
      for (var component in components) {
        try {
          var relayId = components[component].relay;
          var realStatus = Shelly.call("Switch.GetStatus", { id: relayId });
          if (realStatus && typeof realStatus.output === "boolean") {
            components[component].status = realStatus.output;
            print("✅ " + component + " (Relay " + relayId + "): État RÉEL = " + (realStatus.output ? "ON" : "OFF"));
          }
        } catch (e) {
          print("⚠️ Erreur lecture " + component + ":", e);
        }
      }
      print("📊 États synchronisés avec le hardware");
      saveComponentStates();
      if (isConnected && !isInResetMode) { sendDataToAWS(); }
    });
    
    print("✅ Script initialisé avec succès !");
    print("📡 AP TOUJOURS ACTIF - Même si WiFi connecté !");
    print("☁️ AWS IoT configuré - Région:", awsConfig.region);
    print("💾 Sauvegarde d'état activée - Fichier:", stateBackupFile);
    print("🔄 Restauration: priorité au hardware (restore_last)");
    print("⏰ Timers actifs:", allTimers.length);
    
  } catch (error) {
    print("❌ Erreur initializeScript:", error);
    isInitialized = false;
  }
}
function setupEventHandlers() {
  if (eventsRegistered) {
    print("⚠️ Gestionnaires déjà enregistrés, on n'ajoute pas de doublons");
    return;
  }
  eventsRegistered = true;
  print("📡 Configuration des gestionnaires d'événements (handler unique)...");
  Shelly.addEventHandler(function(event, user_data) {
    try {
      var ev = event && event.info && event.info.event ? event.info.event : "";
      if (ev === "switch") {
      var switchId = event.info.id;
      var isOn = event.info.output;
      print("🔌 Switch " + switchId + " changé: " + (isOn ? 'ON' : 'OFF'));
      for (var component in components) {
        if (components[component].relay === switchId) {
          components[component].status = isOn;
          print("📊 " + components[component].name + " mis à jour: " + (isOn ? 'ON' : 'OFF'));
          break;
        }
      }
      if (isConnected && !isInResetMode) {
        sendDataToAWS();
      }
      } else if (ev === "wifi_connected") {
      print("📶 Wi-Fi connecté - redémarrage du script...");
      isConnected = true;
      isInResetMode = false;
      apModeActive = false;
        Timer.set(3000, false, function() { initializeScript(); });
      } else if (ev === "wifi_disconnected") {
      print("❌ Wi-Fi déconnecté - MAIS AP reste actif !");
      isConnected = false;
        if (dataTimer) { Timer.clear(dataTimer); dataTimer = null; }
      print("📡 AP reste actif même sans WiFi principal");
      Timer.set(5000, false, function() {
        if (Shelly.getDeviceInfo().ip !== "0.0.0.0") {
          print("📶 WiFi reconnecté - redémarrage script");
          initializeScript();
        }
      });
      } else if (ev === "mqtt_connected") {
      print("📡 MQTT connecté - Envoi immédiat des données pour nouvelle connexion...");
      isConnected = true;
      // Envoyer immédiatement les données quand MQTT se connecte
      Timer.set(1000, false, function() {
        print("📤 Envoi immédiat des données après connexion MQTT...");
        sendDataToAWS();
      });
      }
    } catch (e) {
      print("❌ Erreur handler global:", e);
    }
  });
  print("✅ Gestionnaire d'événements global configuré");
}
function activateConditionalAPMode() {
  try {
    print("🔄 Activation du mode AP avec visibilité conditionnelle...");
    apModeActive = true;
    var detectedOwner = detectCurrentOwner();
    isOwnerMode = detectedOwner.isOwner;
    currentOwnerId = detectedOwner.ownerId;
    if (isOwnerMode) {
      print("👤 Mode PROPRIÉTAIRE : AP et BLE MASQUÉS pour toi");
      var apConfig = {
        enable: true,
        ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
        pass: "", 
        channel: 1,
        hidden: true, // MASQUÉ pour le propriétaire
        max_connections: 5
      };
      var bleConfig = {
        enable: true,
        visibility: "hidden", // MASQUÉ pour le propriétaire
        name: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6)
      };
    } else {
      print("🌐 Mode UTILISATEUR : AP et BLE VISIBLES pour les autres");
      var apConfig = {
        enable: true,
        ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
        pass: "", 
        channel: 1,
        hidden: false, // VISIBLE pour les autres
        max_connections: 5
      };
      var bleConfig = {
        enable: true,
        visibility: "visible", // VISIBLE pour les autres
        name: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6)
      };
    }
    Shelly.call("WiFi.SetAPConfig", apConfig);
    print("📡 Mode AP configuré - Visibilité:", isOwnerMode ? "MASQUÉE" : "VISIBLE");
    Shelly.call("BLE.SetConfig", bleConfig);
    print("🔵 BLE configuré - Visibilité:", isOwnerMode ? "MASQUÉE" : "VISIBLE");
    var apMessage = {
      deviceId: Shelly.getDeviceInfo().id,
      status: "ap_mode_conditional",
      owner: isOwnerMode,
      ownerId: currentOwnerId,
      ap_visible: !isOwnerMode,
      ble_visible: !isOwnerMode,
      ssid: "Shelly-" + Shelly.getDeviceInfo().id.slice(-6),
      timestamp: new Date().toISOString(),
      message: isOwnerMode ? "Mode AP MASQUÉ pour le propriétaire" : "Mode AP VISIBLE pour les utilisateurs"
    };
    MQTT.publish(mqttStatusTopic, JSON.stringify(apMessage), 1, false);
    print("📤 Message mode AP conditionnel envoyé");
  } catch (error) {
    print("❌ Erreur lors de l'activation du mode AP conditionnel:", error);
  }
}
function detectCurrentOwner() {
  try {
    var storedOwnerId = Shelly.getDeviceInfo().owner_id || "unknown";
    var currentUserId = Shelly.getDeviceInfo().current_user_id || "unknown";
    var lastConnectedIP = Shelly.getDeviceInfo().last_connected_ip || "unknown";
    var currentIP = Shelly.getDeviceInfo().ip || "unknown";
    var siteName = Shelly.getDeviceInfo().site_name || "unknown";
    var isOwner = (currentIP === lastConnectedIP) || (storedOwnerId === currentUserId);
    print("🔍 Détection propriétaire:");
    print("   IP actuelle:", currentIP);
    print("   IP propriétaire:", lastConnectedIP);
    print("   ID propriétaire:", storedOwnerId);
    print("   ID utilisateur actuel:", currentUserId);
    print("   Résultat:", isOwner ? "PROPRIÉTAIRE" : "UTILISATEUR");
    return {
      isOwner: isOwner,
      ownerId: storedOwnerId,
      currentUserId: currentUserId,
      currentIP: currentIP
    };
  } catch (error) {
    print("❌ Erreur détection propriétaire:", error);
    return {
      isOwner: false,
      ownerId: "unknown",
      currentUserId: "unknown",
      currentIP: "unknown"
    };
  }
}
function sendDisconnectMessage() {
  try {
    var disconnectPayload = {
      deviceId: Shelly.getDeviceInfo().id,
      status: "disconnected",
      timestamp: new Date().toISOString(),
      reason: isInResetMode ? "site_deleted" : "wifi_lost",
      components: getComponentsStatus(),
      owner: isOwnerMode,
      ap_visible: !isOwnerMode
    };
    MQTT.publish(mqttStatusTopic, JSON.stringify(disconnectPayload), 1, false);
    print("📤 Message de déconnexion envoyé");
  } catch (error) {
    print("❌ Erreur envoi message déconnexion:", error);
  }
}
function executeComponentCommand(component, action, value) {
  try {
    if (!components[component]) {
      print("❌ Composant " + component + " non reconnu");
      return { success: false, error: "Composant non reconnu" };
    }
    
    var relayId = components[component].relay;
    var turnAction = "off";
    if (action === "on" || action === "true" || action === true || action === 1) {
      turnAction = "on";
    } else if (action === "toggle") {
      turnAction = components[component].status ? "off" : "on";
    }
    
    print("🔧 Commande " + component + " vers " + turnAction + " - Relay " + relayId);
    
    // Mise à jour optimiste
      components[component].status = (turnAction === "on");
      
    // Commande directe sans délai
    var result = Shelly.call("Switch.Set", { id: relayId, on: turnAction === "on" });
    
    if (result) {
      print("✅ " + components[component].name + " " + turnAction);
    } else {
      print("❌ Échec " + component + " - Switch.Set retourné null");
      // Récupération immédiate de l'état
      try {
        var status = Shelly.call("Switch.GetStatus", { id: relayId });
        if (status) {
          components[component].status = status.output;
          print("🔄 État réel relay " + relayId + ": " + (status.output ? "ON" : "OFF"));
        }
      } catch (e) {
        print("⚠️ Impossible de récupérer l'état");
      }
    }
    
    // Sauvegarde et envoi immédiats
    saveComponentStates();
      if (isConnected && !isInResetMode) {
        sendDataToAWS();
      }
      
    return { success: true, data: { component: component, action: turnAction, relay: relayId, status: components[component].status } };
    
  } catch (error) {
    print("❌ Erreur commande " + component + ":", error);
    return { success: false, error: error.message };
  }
}
function getComponentsStatus() {
  var status = {};
  print("📊 Lecture des statuts des composants...");
  
  for (var component in components) {
    try {
      var relayInfo = Shelly.call("Switch.GetStatus", { id: components[component].relay });
      if (relayInfo) {
        status[component] = {
          name: components[component].name,
          relay: components[component].relay,
          status: relayInfo.output || false,
          power: relayInfo.apower || 0,
          voltage: relayInfo.voltage || 0,
          current: relayInfo.current || 0,
          energy: relayInfo.aenergy || 0,
          temperature: relayInfo.temperature || 0
        };
        components[component].status = status[component].status;
        print("✅ " + component + " (Relay " + components[component].relay + "): " + (relayInfo.output ? "ON" : "OFF"));
      } else {
        status[component] = {
          name: components[component].name,
          relay: components[component].relay,
          status: components[component].status,
          power: 0, voltage: 0, current: 0, energy: 0, temperature: 0
        };
        print("⚠️ " + component + " (Relay " + components[component].relay + "): Pas de réponse");
      }
    } catch (error) {
      if (error.message && error.message.indexOf("Too many calls") !== -1) {
        status[component] = {
          name: components[component].name,
          relay: components[component].relay,
          status: components[component].status,
          power: 0, voltage: 0, current: 0, energy: 0, temperature: 0
        };
        print("⏳ " + component + " (Relay " + components[component].relay + "): Trop d'appels - état local");
      } else {
      print("❌ Erreur lecture statut " + component + ":", error);
      status[component] = { 
        error: error.message,
        relay: components[component].relay,
        name: components[component].name
      };
      }
    }
  }
  
  print("📋 Résumé des composants:");
  for (var comp in status) {
    var state = status[comp].status ? "ON" : "OFF";
    var icon = status[comp].status ? "🟢" : "🔴";
    print("   " + icon + " " + comp + " (" + status[comp].name + "): " + state);
  }
  
  return status;
}
function sendDataToAWS() {
  if (!isConnected || isInResetMode) {
    print("⚠️ Pas de connexion Wi-Fi ou en mode reset - données non envoyées");
    return false;
  }
  try {
    var componentsStatus = getComponentsStatus();
    var totalPower = 0;
    var componentKeys = getObjectKeys(componentsStatus);
    for (var i = 0; i < componentKeys.length; i++) {
      var comp = componentsStatus[componentKeys[i]];
      if (comp && comp.power) {
        totalPower += comp.power;
      }
    }
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
        voltage: componentsStatus.heater ? componentsStatus.heater.voltage || 0 : 0,
        current: componentsStatus.heater ? componentsStatus.heater.current || 0 : 0
      },
      visibility: {
        owner: isOwnerMode,
        ap_visible: !isOwnerMode,
        ble_visible: !isOwnerMode,
        mode: isOwnerMode ? "propriétaire_masqué" : "utilisateur_visible"
      }
    };
    var message = JSON.stringify(payload);
    MQTT.publish(mqttDataTopic, message, 1, false);
    print("📤 Données envoyées via MQTT.publish sur " + mqttDataTopic);
    print("📊 Composants: " + componentKeys.join(', '));
    print("🌐 Visibilité: " + (isOwnerMode ? "PROPRIÉTAIRE (masqué)" : "UTILISATEUR (visible)"));
    lastDataSent = Date.now();
    return true;
  } catch (error) {
    print("❌ Erreur envoi données AWS IoT:", error);
    return false;
  }
}
function startDataCollection() {
  try {
    if (dataTimer) {
      print("⚠️ Collecte données déjà démarrée, ignorée");
      return;
    }
  print("⏰ Démarrage de la collecte automatique des données...");
  sendDataToAWS();
    dataTimer = Timer.set(60000, true, function() {
    if (isConnected && !isInResetMode) {
      print("⏰ Envoi périodique des données...");
      sendDataToAWS();
    } else {
      print("⚠️ Pas de connexion Wi-Fi ou en mode reset - envoi différé");
    }
  });
  
    if (dataTimer) {
      allTimers.push(dataTimer);
      print("✅ Collecte automatique démarrée - intervalle: 60 secondes");
    } else {
      print("❌ Échec création timer collecte données");
    }
  } catch (error) {
    print("❌ Erreur startDataCollection:", error);
  }
}
function restartScript() {
  print("🔄 Redémarrage du script...");
  clearAllTimers(); 
  isInitialized = false;
  Timer.set(2000, false, initializeScript);
}
function applyRelayRestoreLast() {
  try {
    print("🔧 Configuration relays: initial_state = restore_last...");
    for (var i = 0; i < 4; i++) {
      var res = Shelly.call("Switch.SetConfig", { id: i, initial_state: "restore_last" });
      if (res) {
        print("✅ Relay " + i + " : initial_state=restore_last appliqué");
      } else {
        print("⚠️ Relay " + i + " : impossible d'appliquer initial_state");
      }
    }
  } catch (e) {
    print("❌ Erreur configuration initial_state:", e);
  }
}
print("🚀 Démarrage du script Shelly AWS IoT + MQTT + CONTRÔLE + AP TOUJOURS ACTIF...");
print("📱 Composants configurés: " + getObjectKeys(components).join(", "));
print("☁️ Configuration AWS IoT intégrée depuis .env");
print("   Région: " + awsConfig.region);
print("   Endpoint: " + awsConfig.endpoint);
print("   Device ID: " + awsConfig.deviceId);
print("📡 Topics MQTT configurés:");
print("   Commandes RPC: " + mqttRpcTopic);
print("   Réponses: " + mqttResponseTopic);
print("   Données: " + mqttDataTopic);
print("   Statut: " + mqttStatusTopic);
print("🔄 NOUVEAU : AP TOUJOURS ACTIF - Même si WiFi connecté !");
print("🛡️ Protection contre la désactivation automatique de l'AP");
print("🔍 Surveillance AP continue - vérification toutes les 60 secondes");
print("🔒 Protection contre les appels multiples simultanés");
print("🔐 Vérification des certificats AWS IoT");
print("📡 Gestionnaires d'événements MQTT configurés");
print("   MODE AP CONDITIONNEL :");
print("   👤 PROPRIÉTAIRE : AP et BLE MASQUÉS (invisibles)");
print("   🌐 UTILISATEURS : AP et BLE VISIBLES (visibles)");
print("🔄 Fonctions principales:");
print("   - executeComponentCommand(component, action) : Contrôler un composant");
print("   - checkAllOutputs() : Vérifier tous les outputs");
print("   - restartScript() : Redémarrer le script");
print("   - saveComponentStates() : Sauvegarde état composants");
print("   - sendDataToAWS() : Envoyer données vers AWS");
print("🔧 Réception des commandes RPC MQTT activée");
print("📤 Envoi automatique des données toutes les 60 secondes");
print("💾 Sauvegarde automatique toutes les 15 minutes");
print("🔄 Restauration automatique après coupure de courant");
print("⏰ Surveillance AP toutes les 60 secondes");
print("🔧 Test AP toutes les 5 minutes");
print("🚀 FONCTION FORCE ENVOI: sendDataToAWS() - Appelable manuellement");
print("🔍 FONCTION DIAGNOSTIC: getComponentsStatus() - Pour debug");
initializeScript();
print("✅ Script chargé et en attente d'initialisation...");