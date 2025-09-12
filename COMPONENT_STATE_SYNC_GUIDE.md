# Guide de Synchronisation des États des Composants

## Vue d'ensemble

Ce guide explique le nouveau système de synchronisation des états des composants (pump, heater, auger, high water, bin replaced, emergency heater) avec DynamoDB.

## Problème résolu

Avant cette implémentation, quand vous changiez l'état d'un composant dans l'application :
- ✅ L'état était changé localement
- ✅ La sortie physique Shelly était contrôlée
- ❌ L'état n'était PAS sauvegardé dans DynamoDB
- ❌ L'état n'était PAS synchronisé entre les appareils

## Solution implémentée

### 1. Service de Synchronisation (`componentStateService.js`)

Le service `ComponentStateService` gère :
- Contrôle des sorties physiques Shelly
- Mise à jour des états locaux dans AsyncStorage
- Synchronisation avec DynamoDB
- Récupération des états depuis DynamoDB

### 2. Table DynamoDB (`WaiHomeComponentStates`)

Nouvelle table pour stocker les états des composants :
```json
{
  "componentId": "site123_pump_1703123456789",
  "siteId": "site123",
  "userId": "user456",
  "componentType": "pump",
  "state": true,
  "timestamp": "2023-12-21T10:30:45.123Z",
  "deviceId": "site123_pump",
  "lastUpdated": "2023-12-21T10:30:45.123Z"
}
```

### 3. Routes API Backend

Nouvelles routes dans `/api/shelly/` :
- `POST /component-state` - Sauvegarder un état
- `GET /component-states/:siteId` - Récupérer tous les états d'un site
- `PUT /component-state/:componentId` - Mettre à jour un état
- `GET /component-history/:siteId/:componentType` - Historique des états

### 4. Composant Générique (`ComponentControl.tsx`)

Composant réutilisable pour tous les types de composants avec :
- Interface utilisateur cohérente
- Gestion des états de chargement
- Messages d'avertissement personnalisés
- Synchronisation automatique

## Utilisation

### 1. Créer la table DynamoDB

```bash
cd backend/scripts
node create-component-states-table.js
```

### 2. Utiliser le service dans un composant

```typescript
import componentStateService from '../services/componentStateService';

// Mettre à jour l'état d'un composant
const result = await componentStateService.updateComponentState(
  siteId,
  'pump',
  true // nouvel état
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
  iconType="MaterialCommunityIcons"
/>
```

### 4. Récupérer les états

```typescript
// Récupérer l'état d'un composant
const state = await componentStateService.getComponentState(siteId, 'pump');

// Récupérer tous les états d'un site
const allStates = await componentStateService.getAllComponentStates(siteId);

// Synchroniser depuis DynamoDB
await componentStateService.syncFromDynamoDB(siteId);
```

## Types de Composants Supportés

- `pump` - Pompe
- `auger` - Vis sans fin
- `heater` - Chauffage
- `highWater` - Alarme niveau d'eau
- `binReplaced` - Bac remplacé
- `emergencyHeater` - Chauffage d'urgence

## Flux de Synchronisation

1. **Changement d'état utilisateur**
   - L'utilisateur change l'état d'un composant
   - Le composant affiche "Synchronizing with cloud..."

2. **Contrôle Shelly**
   - Le service envoie la commande à la sortie physique Shelly
   - Vérification du succès de l'opération

3. **Mise à jour locale**
   - L'état est mis à jour dans AsyncStorage
   - L'interface utilisateur est mise à jour

4. **Synchronisation DynamoDB**
   - L'état est sauvegardé dans DynamoDB
   - Horodatage et métadonnées ajoutés

5. **Confirmation**
   - L'utilisateur reçoit une confirmation
   - L'état est maintenant synchronisé sur tous les appareils

## Avantages

- ✅ **Synchronisation en temps réel** entre tous les appareils
- ✅ **Persistance des données** dans DynamoDB
- ✅ **Historique complet** des changements d'état
- ✅ **Interface utilisateur cohérente** pour tous les composants
- ✅ **Gestion d'erreurs robuste**
- ✅ **États de chargement** pour une meilleure UX
- ✅ **Messages d'avertissement** personnalisés

## Migration des Composants Existants

Pour migrer un composant existant vers le nouveau système :

1. **Remplacer l'import**
   ```typescript
   // Avant
   import { controlShellyComponent } from '../services/shellyControlService';
   
   // Après
   import componentStateService from '../services/componentStateService';
   ```

2. **Remplacer l'appel de contrôle**
   ```typescript
   // Avant
   const success = await controlShellyComponent(siteId, 'pump', newState);
   
   // Après
   const result = await componentStateService.updateComponentState(siteId, 'pump', newState);
   ```

3. **Utiliser le composant générique** (optionnel)
   ```typescript
   // Remplacer tout le code de contrôle par
   <ComponentControl
     siteId={siteId}
     componentType="pump"
     currentState={pumpState}
     onStateChange={setPumpState}
     title="Pump"
     icon="pump"
   />
   ```

## Dépannage

### Erreur de connexion DynamoDB
- Vérifier les credentials AWS
- Vérifier que la table `WaiHomeComponentStates` existe
- Vérifier les permissions IAM

### État non synchronisé
- Vérifier la connectivité réseau
- Vérifier les logs de l'application
- Utiliser `syncFromDynamoDB()` pour forcer la synchronisation

### Composant ne répond pas
- Vérifier que le Shelly est accessible
- Vérifier l'IP du Shelly dans les données du site
- Vérifier les logs Shelly

## Tests

Pour tester la synchronisation :

1. **Changer l'état sur un appareil**
2. **Vérifier dans DynamoDB** que l'état est sauvegardé
3. **Ouvrir l'app sur un autre appareil** et vérifier que l'état est synchronisé
4. **Vérifier l'historique** dans DynamoDB

## Structure de la Base de Données

### Table WaiHomeComponentStates

| Attribut | Type | Description |
|----------|------|-------------|
| componentId | String | Clé primaire (siteId_componentType_timestamp) |
| siteId | String | ID du site |
| userId | String | ID de l'utilisateur |
| componentType | String | Type de composant |
| state | Boolean | État (true = ON, false = OFF) |
| timestamp | String | Horodatage ISO |
| deviceId | String | ID du device |
| lastUpdated | String | Dernière mise à jour |

### Index Secondaires

- `siteId-componentType-index` - Pour récupérer les états par site et type
- `siteId-timestamp-index` - Pour l'historique par site
- `userId-siteId-index` - Pour les états par utilisateur et site
