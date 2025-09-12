# Guide Final - Synchronisation AWS DynamoDB ✅ RÉSOLU

## 🎯 **Problème Résolu**

**AVANT** : L'application créait un nouvel élément à chaque changement
**MAINTENANT** : **1 seul appareil** mis à jour en place avec identifiants stables

## 🔧 **Corrections Apportées**

1. **ID Stable** : `userId_shelly-main-device_main-site` (sans timestamp)
2. **Normalisation des Identifiants** : Tous les "unknown" → identifiants stables
3. **Logique de Mise à Jour** : Vérification si l'appareil existe → mise à jour
4. **Nettoyage** : 1 seul appareil dans DynamoDB

## 🧪 **Test de la Synchronisation**

### 1. **Préparation**
- ✅ Serveur backend démarré (`node server.js`)
- ✅ Application React Native démarrée
- ✅ **1 seul appareil** dans DynamoDB avec ID stable

### 2. **Test dans l'Application**

#### Étape 1 : Ouvrir l'application
1. Lancez l'application React Native
2. Connectez-vous avec votre compte
3. Allez dans la page principale (MainPage)

#### Étape 2 : Accéder aux détails d'un site
1. Cliquez sur un site (ex: "Home", "Home2", "Home 3")
2. Vous arrivez dans `SiteDetails`

#### Étape 3 : Tester un composant
1. Cliquez sur **Pump** (ou Auger/Heater/High Water)
2. Vous arrivez dans la page de détails du composant
3. Changez l'état avec le switch (ON/OFF)
4. Cliquez sur **Confirm**

### 3. **Vérification des Logs**

#### Dans le terminal du serveur backend :
```
📥 POST /api/shelly/devices
🔍 Components reçus: { pump: true, auger: false, ... }
📤 Données à sauvegarder dans DynamoDB: { components: { ... } }
🔄 Mise à jour de l'appareil existant: userId_shelly-main-device_main-site
✅ Appareil Shelly mis à jour avec succès
```

#### Dans la console de l'application :
```
🔄 Sauvegarde du changement pump dans AWS...
📤 Données à envoyer vers AWS: { deviceId: "...", components: { ... } }
✅ État pump sauvegardé dans AWS avec succès
```

### 4. **Vérification dans DynamoDB**

#### Étape 1 : Ouvrir DynamoDB
1. Allez dans la console AWS
2. Ouvrez DynamoDB
3. Sélectionnez la table `WaiHomeShellyDevices`

#### Étape 2 : Rafraîchir les données
1. Cliquez sur **"Exécuter"** pour faire un scan
2. Vous devriez voir **1 seul appareil** ✅

#### Étape 3 : Vérifier les changements
- ✅ **1 seul élément** : ID = `userId_shelly-main-device_main-site`
- ✅ `lastUpdated` : doit être mis à jour (timestamp récent)
- ✅ `components` : doit contenir vos nouveaux états
- ✅ `pump`/`auger`/`heater`/`highWaterAlarm` : doit refléter votre changement

### 5. **Test de Rechargement**

#### Dans SiteDetails :
1. Cliquez sur **"Refresh from AWS"**
2. Les états doivent se recharger depuis DynamoDB
3. Vérifiez que l'état affiché correspond à ce que vous avez changé

### 6. **Test de Tous les Composants**

Testez chaque composant :
- ✅ **Pump** : ON/OFF
- ✅ **Auger** : ON/OFF  
- ✅ **Heater** : ON/OFF
- ✅ **High Water Alarm** : ON/OFF

### 7. **Vérification - Un Seul Appareil**

**IMPORTANT** : Après chaque changement, vérifiez dans DynamoDB que :
- ✅ **1 seul élément** reste dans la table
- ✅ **ID stable** : `userId_shelly-main-device_main-site`
- ✅ **Le même élément** est mis à jour
- ✅ **AUCUN nouvel élément** n'est créé

### 8. **Dépannage**

#### Si vous voyez plus d'un élément :
- ❌ Problème avec la normalisation des identifiants
- ✅ Relancez le script `fix-single-device.js`

#### Si les logs montrent `🆕 Création d'un nouvel appareil` :
- ❌ L'appareil n'existe pas encore
- ✅ Normal pour le premier changement

#### Si les logs montrent `🔄 Mise à jour de l'appareil existant` :
- ✅ **PARFAIT** ! L'appareil est mis à jour

### 9. **Logs Attendus**

#### Succès (Mise à jour) :
```
🔧 handlePumpChange appelé avec: true
🔄 Sauvegarde du changement pump dans AWS...
📤 Données à envoyer vers AWS: { components: { pump: true, ... } }
🔄 Mise à jour de l'appareil existant: userId_shelly-main-device_main-site
✅ État pump sauvegardé dans AWS avec succès
```

### 10. **Structure des Données DynamoDB**

```json
{
  "id": "c04cc9ac-60b1-70fd-b8c3-5ab5d6b60925_shelly-main-device_main-site",
  "userId": "c04cc9ac-60b1-70fd-b8c3-5ab5d6b60925",
  "deviceId": "shelly-main-device",
  "siteId": "main-site",
  "siteName": "Home",
  "components": {
    "pump": true,
    "auger": false,
    "heater": false,
    "highWaterAlarm": false,
    "emergency": false,
    "binReplaced": false,
    "heaterStarted": false
  },
  "lastUpdated": "2025-08-18T08:30:45.123Z"
}
```

## ✅ Validation Finale

La synchronisation fonctionne parfaitement si :
1. ✅ Les logs montrent `🔄 Mise à jour de l'appareil existant`
2. ✅ DynamoDB garde **1 seul appareil**
3. ✅ L'ID est stable : `userId_shelly-main-device_main-site`
4. ✅ Les états sont mis à jour dans l'élément existant
5. ✅ Le bouton "Refresh from AWS" recharge les états
6. ✅ Tous les composants peuvent être modifiés
7. ✅ **AUCUN nouvel élément** n'est créé lors des changements

## 🎯 **Résultat Final**

- **AVANT** : 5+ éléments créés (un par changement)
- **MAINTENANT** : **1 seul appareil** stable, mis à jour en place

## 🚀 **Prêt à Utiliser !**

Votre application est maintenant prête. Chaque changement d'état met à jour le même appareil dans DynamoDB avec des identifiants stables.

## 📋 **Commandes Utiles**

```bash
# Vérifier l'état actuel
node test-sync-simple.js

# Nettoyer et créer un seul appareil
node fix-single-device.js

# Démarrer le serveur
node server.js
```

