# Guide de Test - Synchronisation AWS DynamoDB ✅ RÉSOLU

## 🎯 **Problème Résolu**

**AVANT** : 3+ éléments créés pour un seul appareil
**MAINTENANT** : **1 seul appareil** mis à jour en place

## 🧪 Test de la Synchronisation

### 1. **Préparation**
- ✅ Serveur backend démarré (`node server.js`)
- ✅ Application React Native démarrée
- ✅ Connexion AWS DynamoDB active
- ✅ **1 seul appareil** dans DynamoDB

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
🔄 Mise à jour de l'appareil existant: userId_deviceId_siteId
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
- ✅ **1 seul élément** : votre appareil principal
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
- ✅ **Le même élément** est mis à jour
- ✅ **AUCUN nouvel élément** n'est créé

### 8. **Dépannage**

#### Si vous voyez plus d'un élément :
- ❌ Problème avec l'ID stable
- ✅ Relancez le script de nettoyage

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
🔄 Mise à jour de l'appareil existant: userId_deviceId_siteId
✅ État pump sauvegardé dans AWS avec succès
```

### 10. **Structure des Données DynamoDB**

```json
{
  "id": "userId_deviceId_siteId",  // ID stable (sans timestamp)
  "userId": "c04cc9ac-60b1-70fd-b8c3-5ab5d6b60925",
  "deviceId": "shelly-192-168-100-62",
  "siteId": "1755503422808",
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
3. ✅ Les états sont mis à jour dans l'élément existant
4. ✅ Le bouton "Refresh from AWS" recharge les états
5. ✅ Tous les composants peuvent être modifiés
6. ✅ **AUCUN nouvel élément** n'est créé lors des changements

## 🎯 **Résultat Final**

- **AVANT** : 3+ éléments créés pour un appareil
- **MAINTENANT** : **1 seul appareil** stable, mis à jour en place

## 🚀 **Prêt à Utiliser !**

Votre application est maintenant prête. Chaque changement d'état met à jour le même appareil dans DynamoDB.
