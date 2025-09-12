# Guide de Synchronisation AWS des États des Composants

## Vue d'ensemble

Ce guide explique comment les états des composants (Pump, Auger, Heater, High Water Alarm) sont maintenant synchronisés automatiquement avec AWS DynamoDB.

## Fonctionnalités

### 1. Synchronisation Automatique
- ✅ Les changements d'état dans les pages de détails sont automatiquement sauvegardés dans AWS
- ✅ Les états sont chargés depuis AWS au démarrage de l'application
- ✅ Synchronisation bidirectionnelle : Local ↔ AWS

### 2. Pages de Détails Modifiées
- **DetailsPump.tsx** - État de la pompe
- **DetailsAuger.tsx** - État de la vis sans fin
- **DetailsHeater.tsx** - État du chauffage
- **DetailsHighWater.tsx** - État de l'alarme de niveau d'eau

### 3. Fonctionnalités Ajoutées

#### Dans SiteDetails.tsx
- **Bouton "Refresh from AWS"** : Recharge manuellement les états depuis AWS
- **Indicateurs de chargement** : Montre quand les données sont en cours de synchronisation
- **Synchronisation automatique** : Met à jour les états locaux avec ceux d'AWS

#### Dans les Pages de Détails
- **Sauvegarde automatique** : Chaque changement d'état est sauvegardé dans AWS
- **Gestion d'erreurs** : Logs détaillés en cas de problème de synchronisation
- **Mise à jour locale** : Les états sont aussi mis à jour localement

## Comment Utiliser

### 1. Changer l'État d'un Composant
1. Allez dans **SiteDetails** → Cliquez sur un composant (Pump, Auger, etc.)
2. Dans la page de détails, utilisez le switch pour activer/désactiver
3. Confirmez le changement dans la modale
4. ✅ L'état est automatiquement sauvegardé dans AWS

### 2. Vérifier la Synchronisation
1. Dans **SiteDetails**, regardez la section "Device Coordinates"
2. Utilisez le bouton **"Refresh from AWS"** pour recharger les états
3. Vérifiez les logs dans la console pour voir les détails

### 3. Tester la Synchronisation
```bash
# Exécuter le script de test
node test-aws-sync.js
```

## Structure des Données AWS

### Format des Composants
```json
{
  "components": {
    "pump": false,
    "auger": true,
    "heater": false,
    "highWaterAlarm": true,
    "emergency": false,
    "binReplaced": false,
    "heaterStarted": false
  }
}
```

### Champs Sauvegardés
- `deviceId` : Identifiant unique de l'appareil
- `siteId` : Identifiant du site
- `siteName` : Nom du site
- `components` : États de tous les composants
- `lastUpdated` : Timestamp de la dernière mise à jour
- `status` : Statut de connexion de l'appareil

## Logs et Debugging

### Logs de Synchronisation
- `🔄 Sauvegarde du changement [composant] dans AWS...`
- `✅ État [composant] sauvegardé dans AWS avec succès`
- `❌ Erreur lors de la sauvegarde AWS: [erreur]`

### Logs de Chargement
- `🔄 Chargement des états des composants depuis AWS...`
- `✅ États des composants trouvés dans AWS: [états]`
- `🔄 États des composants chargés depuis AWS et synchronisés`

## Gestion des Erreurs

### Erreurs Courantes
1. **Utilisateur non connecté** : Vérifiez l'authentification
2. **Problème réseau** : Vérifiez la connexion internet
3. **Erreur AWS** : Vérifiez les permissions DynamoDB

### Solutions
- Les données sont sauvegardées localement même si AWS échoue
- Utilisez le bouton "Refresh from AWS" pour réessayer
- Vérifiez les logs dans la console pour plus de détails

## Avantages

### 1. Persistance des Données
- Les états sont sauvegardés de manière permanente
- Synchronisation entre différents appareils
- Sauvegarde de secours en cas de problème

### 2. Temps Réel
- Changements immédiats dans l'interface
- Synchronisation automatique en arrière-plan
- Indicateurs visuels de l'état de synchronisation

### 3. Fiabilité
- Double sauvegarde : Local + AWS
- Gestion d'erreurs robuste
- Logs détaillés pour le debugging

## Support Technique

En cas de problème :
1. Vérifiez les logs dans la console
2. Utilisez le script de test : `node test-aws-sync.js`
3. Vérifiez la connexion internet
4. Vérifiez les permissions AWS DynamoDB

