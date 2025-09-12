# 🚀 Guide de Démarrage Rapide - Synchronisation des Composants

## 📋 Prérequis

1. **AWS Credentials configurés** dans le fichier `.env` du backend
2. **Node.js** installé
3. **Serveur backend** accessible

## 🔧 Installation et Configuration

### 1. Créer la table DynamoDB

```bash
cd backend/scripts
node create-component-states-table.js
```

**Résultat attendu :**
```
🔄 Création de la table WaiHomeComponentStates...
✅ Table WaiHomeComponentStates créée avec succès!
🎉 Table WaiHomeComponentStates prête à être utilisée!
```

### 2. Démarrer le système complet

```bash
cd backend/scripts
node start-component-sync.js
```

**Résultat attendu :**
```
🚀 Démarrage du système de synchronisation des composants

📋 Création de la table DynamoDB WaiHomeComponentStates...
✅ Création de la table DynamoDB WaiHomeComponentStates terminé avec succès

🔄 Démarrage du serveur backend...

📋 Test de synchronisation des composants...
✅ Test de synchronisation des composants terminé avec succès

🎉 Système de synchronisation prêt!

📱 Vous pouvez maintenant:
   • Changer l'état des composants dans l'app
   • Voir les états synchronisés dans DynamoDB
   • Tester la synchronisation entre appareils

🛑 Pour arrêter le serveur, appuyez sur Ctrl+C
```

## 🧪 Tests Manuels

### Test 1: Vérifier la table DynamoDB

1. Aller dans la console AWS DynamoDB
2. Vérifier que la table `WaiHomeComponentStates` existe
3. Vérifier les index secondaires

### Test 2: Tester les API

```bash
# Test de sauvegarde d'état
curl -X POST http://192.168.100.193:8080/api/shelly/component-state \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "siteId": "test-site-123",
    "userId": "test-user-456",
    "componentType": "pump",
    "state": true
  }'

# Test de récupération d'états
curl -X GET "http://192.168.100.193:8080/api/shelly/component-states/test-site-123?userId=test-user-456" \
  -H "Authorization: Bearer test-token"
```

### Test 3: Utiliser dans l'application

1. **Ouvrir l'application React Native**
2. **Aller dans un site**
3. **Changer l'état d'un composant** (pump, heater, etc.)
4. **Vérifier dans DynamoDB** que l'état est sauvegardé

## 🔍 Dépannage

### Erreur: "ValidationException: Some index key attributes are not defined"

**Solution :** L'attribut `userId` manquait dans la définition de la table. Corrigé dans la version actuelle.

### Erreur: "Cannot find module"

**Solution :** Vérifier que vous êtes dans le bon dossier :
```bash
cd backend/scripts
```

### Erreur: "AWS credentials not found"

**Solution :** Vérifier le fichier `.env` dans le dossier backend :
```env
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### Erreur: "Connection refused"

**Solution :** Vérifier que le serveur backend est démarré :
```bash
cd backend
node server.js
```

## 📱 Utilisation dans l'Application

### 1. Importer le service

```typescript
import componentStateService from '../services/componentStateService';
```

### 2. Mettre à jour un état

```typescript
const result = await componentStateService.updateComponentState(
  siteId,
  'pump',
  true
);

if (result.success) {
  console.log('État synchronisé avec succès');
}
```

### 3. Utiliser le composant générique

```typescript
import ComponentControl from '../components/ComponentControl';

<ComponentControl
  siteId={siteId}
  componentType="pump"
  currentState={pumpState}
  onStateChange={setPumpState}
  title="Pump"
  icon="pump"
/>
```

## ✅ Vérification du Fonctionnement

1. **Changer l'état d'un composant** dans l'app
2. **Vérifier les logs** dans la console
3. **Vérifier DynamoDB** pour voir l'état sauvegardé
4. **Ouvrir l'app sur un autre appareil** et vérifier la synchronisation

## 🎯 Composants Supportés

- ✅ `pump` - Pompe
- ✅ `auger` - Vis sans fin
- ✅ `heater` - Chauffage
- ✅ `highWater` - Alarme niveau d'eau
- ✅ `binReplaced` - Bac remplacé
- ✅ `emergencyHeater` - Chauffage d'urgence

## 📞 Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs** dans la console
2. **Vérifier la connectivité** avec DynamoDB
3. **Vérifier les permissions** AWS
4. **Consulter le guide complet** : `COMPONENT_STATE_SYNC_GUIDE.md`
