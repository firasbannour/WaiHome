// Configuration AWS IoT Core
module.exports = {
  // Endpoint AWS IoT Core (remplacez par votre vrai endpoint)
  endpoint: 'a2q29tpo86eexb-ats.iot.eu-north-1.amazonaws.com',
  
  // Chemins vers les certificats (corrigés vers shelly-aws-connection)
  certificates: {
    privateKey: '../shelly-aws-connection/shelly-waihome-002.private.key',
    certificate: '../shelly-aws-connection/shelly-waihome-002.cert.pem',
    rootCA: '../shelly-aws-connection/root-CA.crt'
  },
  
  // Configuration MQTT
  mqtt: {
    clientId: `waihome-backend-${Date.now()}`,
    port: 8883,
    keepAlive: 30,
    reconnectPeriod: 5000,
    connectTimeout: 10000
  },
  
  // Topics MQTT pour Shelly
  topics: {
    shellyData: 'shelly/+/data',           // Données reçues de Shelly
    shellyCommand: 'shelly/+/command',     // Commandes envoyées à Shelly
    shellyStatus: 'shelly/+/status'        // Statuts de Shelly
  }
};
