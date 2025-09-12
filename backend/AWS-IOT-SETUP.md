# 🔗 Configuration AWS IoT MQTT pour WaiHome

Ce guide vous explique comment configurer une **vraie connexion AWS IoT MQTT** entre votre application mobile et vos appareils Shelly.

## 🎯 **Objectif**

Permettre à votre application mobile de communiquer avec vos appareils Shelly **depuis n'importe quel réseau** (WiFi différent, données mobiles, etc.) via AWS IoT Core.

## 📋 **Prérequis**

- Compte AWS actif
- Appareils Shelly configurés avec des scripts MQTT
- Serveur backend WaiHome en cours d'exécution

## 🚀 **Étapes de configuration**

### **Étape 1 : AWS IoT Core Console**

1. Allez sur [AWS IoT Core Console](https://console.aws.amazon.com/iot/)
2. Assurez-vous d'être dans la bonne région (eu-north-1)

### **Étape 2 : Créer une "Thing"**

1. Dans le menu de gauche, cliquez sur **"Manage"** → **"Things"**
2. Cliquez sur **"Create things"**
3. Choisissez **"Create single thing"**
4. Nom : `waihome-backend`
5. Type : `waihome-backend`
6. Cliquez sur **"Next"**

### **Étape 3 : Créer des certificats**

1. Dans **"Security"**, cliquez sur **"Create certificate"**
2. Choisissez **"Create with CSR"** ou **"Create certificate"**
3. Téléchargez les 3 fichiers :
   - `private-key.pem`
   - `certificate.pem` 
   - `root-CA.crt`
4. **IMPORTANT** : Cliquez sur **"Activate"** pour activer le certificat

### **Étape 4 : Créer une politique**

1. Dans **"Security"** → **"Policies"**, cliquez sur **"Create policy"**
2. Nom : `waihome-backend-policy`
3. Contenu de la politique :

```json
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
}
```

4. Cliquez sur **"Create policy"**

### **Étape 5 : Attacher la politique au certificat**

1. Retournez dans **"Security"** → **"Certificates"**
2. Cliquez sur votre certificat
3. Dans **"Policies"**, cliquez sur **"Attach policy"**
4. Sélectionnez `waihome-backend-policy`
5. Cliquez sur **"Attach policy"**

### **Étape 6 : Récupérer l'endpoint**

1. Dans le menu de gauche, cliquez sur **"Settings"**
2. Copiez l'endpoint (format : `a1b2c3d4e5f6g7-ats.iot.eu-north-1.amazonaws.com`)

### **Étape 7 : Configurer le backend**

1. Placez les 3 fichiers de certificats dans le dossier `certs/`
2. Modifiez `aws-iot-config.js` avec votre endpoint
3. Redémarrez le serveur : `node server.js`

## 🔧 **Structure des topics MQTT**

```
shelly/{device-id}/data      ← Shelly envoie des données
shelly/{device-id}/command   ← App mobile envoie des commandes
shelly/{device-id}/status    ← Shelly envoie des statuts
```

## 📱 **Test de la configuration**

1. **Vérifiez la connexion MQTT** :
   - Bouton vert dans l'app mobile
   - Devrait afficher "MQTT connecté à [votre-endpoint]"

2. **Testez les commandes à distance** :
   - Bouton orange dans l'app mobile
   - Les commandes devraient être publiées sur AWS IoT

3. **Vérifiez dans AWS IoT Console** :
   - Allez dans **"Test"** → **"MQTT test client"**
   - Abonnez-vous au topic `shelly/+/command`
   - Envoyez une commande depuis l'app mobile

## 🎉 **Résultat attendu**

- ✅ Communication bidirectionnelle entre app mobile et Shelly
- ✅ Commandes envoyées depuis n'importe quel réseau
- ✅ Données Shelly reçues en temps réel
- ✅ Sécurité AWS IoT (certificats X.509)

## 🆘 **Dépannage**

### **Erreur "MQTT non connecté"**
- Vérifiez que les certificats sont dans le dossier `certs/`
- Vérifiez que l'endpoint est correct
- Vérifiez que la politique est attachée au certificat

### **Erreur de connexion**
- Vérifiez que le certificat est activé
- Vérifiez les permissions de la politique
- Vérifiez la région AWS

## 📞 **Support**

Si vous rencontrez des problèmes, vérifiez :
1. Les logs du serveur backend
2. La console AWS IoT Core
3. Les certificats et politiques
