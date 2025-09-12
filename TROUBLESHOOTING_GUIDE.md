# Guide de Résolution des Problèmes - Synchronisation AWS

## Problèmes Corrigés

### 1. ❌ Erreur AsyncStorage
**Problème :** `AsyncStorage.getItem is not a function (it is undefined)`

**Cause :** Import incorrect d'AsyncStorage dans les pages de détails

**Solution :** 
```javascript
// ❌ Incorrect
const AsyncStorage = require('@react-native-async-storage/async-storage');

// ✅ Correct
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
```

**Fichiers corrigés :**
- `app/DetailsPump.tsx`
- `app/DetailsAuger.tsx`
- `app/DetailsHeater.tsx`
- `app/DetailsHighWater.tsx`

### 2. 🔄 Boucle Infinie de Vérification
**Problème :** Spam de logs de vérification de connexion toutes les 5 secondes

**Cause :** Intervalle de vérification trop fréquent

**Solution :** 
```javascript
// ❌ Trop fréquent (5 secondes)
const interval = setInterval(checkSitesConnectionStatus, 5000);

// ✅ Moins fréquent (30 secondes)
const interval = setInterval(checkSitesConnectionStatus, 30000);
```

**Fichier corrigé :** `app/MainPage.tsx`

### 3. 📝 Logs Excessifs
**Problème :** Trop de logs de vérification de connexion

**Cause :** Logs détaillés pour chaque tentative de connexion

**Solution :** Suppression des logs de debug pour éviter le spam

**Fichier corrigé :** `app/MainPage.tsx`

## Comment Tester la Synchronisation

### 1. Test Simple
```bash
cd backend
node test-sync-simple.js
```

### 2. Test Complet
```bash
cd backend
node test-aws-sync.js
```

### 3. Test dans l'Application
1. Ouvrir l'application
2. Aller dans **SiteDetails**
3. Cliquer sur un composant (Pump, Auger, etc.)
4. Changer l'état avec le switch
5. Confirmer le changement
6. Vérifier les logs dans la console

## Logs Attendus

### ✅ Logs de Succès
```
🔧 handlePumpChange appelé avec: true
💾 Début sauvegarde locale (pump)...
🔄 Sauvegarde du changement pump dans AWS...
✅ État pump sauvegardé dans AWS avec succès
```

### ❌ Logs d'Erreur (à éviter)
```
❌ Erreur lors de la sauvegarde AWS: [TypeError: AsyncStorage.getItem is not a function]
```

## Vérification de la Synchronisation

### 1. Dans l'Application
- Les états changent immédiatement dans l'interface
- Pas d'erreurs dans la console
- Bouton "Refresh from AWS" fonctionne

### 2. Dans AWS DynamoDB
- Les données sont sauvegardées avec le bon format
- Timestamp `lastUpdated` est mis à jour
- Composants contiennent les bons états

### 3. Structure des Données AWS
```json
{
  "deviceId": "shelly-device-123",
  "siteId": "site-456",
  "siteName": "Home",
  "components": {
    "pump": true,
    "auger": false,
    "heater": true,
    "highWaterAlarm": false,
    "emergency": false,
    "binReplaced": false,
    "heaterStarted": false
  },
  "lastUpdated": "2025-08-18T07:16:45.649Z"
}
```

## Prévention des Problèmes

### 1. Gestion des Erreurs
- Toujours utiliser try/catch pour les opérations AWS
- Sauvegarder localement même si AWS échoue
- Logs d'erreur détaillés pour le debugging

### 2. Performance
- Vérification de connexion toutes les 30 secondes (pas 5)
- Logs réduits pour éviter le spam
- Timeout de 3 secondes pour les requêtes réseau

### 3. Fiabilité
- Double sauvegarde : Local + AWS
- Synchronisation bidirectionnelle
- Gestion des cas d'erreur réseau

## Support

En cas de problème persistant :
1. Vérifiez les logs dans la console
2. Exécutez les scripts de test
3. Vérifiez la connexion internet
4. Vérifiez les permissions AWS DynamoDB
5. Redémarrez l'application si nécessaire

