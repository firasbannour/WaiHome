#!/usr/bin/env node

/**
 * Script de configuration AWS IoT pour WaiHome
 * Ce script vous aide à configurer la connexion AWS IoT MQTT
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Configuration AWS IoT pour WaiHome');
console.log('=====================================\n');

// Vérifier si le dossier certs existe
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir);
  console.log('✅ Dossier certs créé');
}

console.log('\n📋 Étapes pour configurer AWS IoT :\n');

console.log('1. 🌐 Allez sur AWS IoT Core Console');
console.log('   https://console.aws.amazon.com/iot/');

console.log('\n2. 🔐 Créez une "Thing" :');
console.log('   - Nom: waihome-backend');
console.log('   - Type: waihome-backend');

console.log('\n3. 📜 Générez des certificats X.509 :');
console.log('   - Créez un certificat');
console.log('   - Téléchargez les 3 fichiers :');
console.log('     * private-key.pem');
console.log('     * certificate.pem');
console.log('     * root-CA.crt');

console.log('\n4. 📁 Placez les fichiers dans le dossier certs/ :');
console.log(`   ${certsDir}/`);

console.log('\n5. 🔑 Attachez une politique au certificat :');
console.log('   - Créez une politique avec ces permissions :');
console.log(`
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect",
        "iot:Publish",
        "iot:Subscribe",
        "iot:Receive"
      ],
      "Resource": "*"
    }
  ]
}`);

console.log('\n6. 🌍 Récupérez votre endpoint AWS IoT :');
console.log('   - Allez dans "Settings"');
console.log('   - Copiez l\'endpoint (format: a1b2c3d4e5f6g7-ats.iot.eu-north-1.amazonaws.com)');

console.log('\n7. ⚙️ Modifiez le fichier aws-iot-config.js :');
console.log('   - Remplacez l\'endpoint par le vôtre');

console.log('\n8. 🚀 Redémarrez votre serveur :');
console.log('   node server.js');

console.log('\n✅ Une fois configuré, votre app mobile pourra communiquer avec Shelly via AWS IoT !');
console.log('\n📱 Test : Utilisez les boutons MQTT et commandes dans votre app mobile');
console.log('   - Les commandes seront envoyées via AWS IoT MQTT');
console.log('   - Vos Shelly recevront les commandes en temps réel');
console.log('   - Communication possible depuis n\'importe quel réseau (WiFi ou données mobiles)');
