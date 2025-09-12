# 🎯 Guide d'Intégration Shelly Pro 4PM

## 📋 Vue d'ensemble

Ce guide explique comment relier ton application React Native avec un Shelly Pro 4PM pour contrôler physiquement les sorties (Output 0-3) quand tu changes les toggles dans l'app.

## 🔧 Mapping des Sorties

```
Shelly Pro 4PM (Gen2) :
├── OUTPUT-0 (id: 0) → Pump (Pompe)
├── OUTPUT-1 (id: 1) → Auger (Vis sans fin)  
├── OUTPUT-2 (id: 2) → Heater (Chauffage)
└── OUTPUT-3 (id: 3) → High Water (Alarme niveau d'eau)
```

## 🚀 Étapes d'Installation

### 1. Configuration Réseau

#### A. Donner une IP fixe au Shelly
1. **Connecte le Shelly** à ton réseau Wi-Fi
2. **Va dans ton routeur** (ex: 192.168.1.1 ou 192.168.100.1)
3. **Trouve la section DHCP** → Réservation d'adresse
4. **Ajoute le Shelly** avec son MAC → IP fixe (ex: 192.168.100.62)
5. **Redémarre le Shelly** pour qu'il prenne la nouvelle IP

#### B. Vérifier la connectivité
```bash
# Test basique
curl http://192.168.100.62/shelly

# Test avec authentification si activée
curl -u admin:password http://192.168.100.62/shelly

# Récupérer les infos du device
curl http://192.168.100.62/rpc/Shelly.GetDeviceInfo
```

### 2. Test des Commandes Shelly

#### A. Allumer une sortie
```bash
# Pump ON
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":0,"on":true}'

# Auger ON  
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":1,"on":true}'

# Heater ON
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":2,"on":true}'

# High Water ON
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":3,"on":true}'
```

#### B. Éteindre une sortie
```bash
# Pump OFF
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":0,"on":false}'

# Auger OFF
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":1,"on":false}'

# Heater OFF
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":2,"on":false}'

# High Water OFF
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":3,"on":false}'
```

#### C. Vérifier l'état d'une sortie
```bash
# Vérifier Pump
curl -u user:pass http://192.168.100.62/rpc/Switch.GetStatus -d '{"id":0}'

# Vérifier Auger
curl -u user:pass http://192.168.100.62/rpc/Switch.GetStatus -d '{"id":1}'

# Vérifier Heater
curl -u user:pass http://192.168.100.62/rpc/Switch.GetStatus -d '{"id":2}'

# Vérifier High Water
curl -u user:pass http://192.168.100.62/rpc/Switch.GetStatus -d '{"id":3}'
```

### 3. Test Automatisé

Utilise le script de test pour vérifier que tout fonctionne :

```bash
# Installer axios si pas déjà fait
npm install axios

# Lancer le test (remplace par ton IP Shelly)
node backend/test-shelly-control.js 192.168.100.62
```

## 📱 Intégration dans l'Application

### 1. Fichiers Modifiés

Les fichiers suivants ont été mis à jour pour inclure le contrôle Shelly :

- ✅ `services/shellyControlService.js` - Service centralisé
- ✅ `app/DetailsPump.tsx` - Contrôle OUTPUT-0
- ✅ `app/DetailsAuger.tsx` - Contrôle OUTPUT-1
- ✅ `app/DetailsHeater.tsx` - Contrôle OUTPUT-2
- ✅ `app/DetailsHighWater.tsx` - Contrôle OUTPUT-3

### 2. Flux de Fonctionnement

1. **Utilisateur** : Touche le toggle Pump dans l'app
2. **App** : Affiche la modale de confirmation
3. **Utilisateur** : Confirme "Turn ON the pump?"
4. **App** : 
   - Met à jour l'état local (`pumpOn = true`)
   - Sauvegarde dans AWS DynamoDB
   - **NOUVEAU** : Envoie `Switch.Set` au Shelly (`id:0, on:true`)
5. **Shelly** : Reçoit la commande et allume OUTPUT-0
6. **Résultat** : Cercle vert sur OUTPUT-0 du Shelly + état sauvegardé dans AWS

### 3. Code d'Exemple

```javascript
// Dans DetailsPump.tsx
import { controlShellyComponent } from '../services/shellyControlService';

const handleConfirm = async (ok: boolean) => {
  if (ok) {
    const newPumpState = pendingValue;
    setPumpOn(newPumpState);
    
    // Notifier SiteDetails du changement
    if (onPumpChange) {
      onPumpChange(newPumpState);
    }
    
    // NOUVEAU : Contrôler la sortie physique Shelly
    const success = await controlShellyComponent(siteId, 'pump', newPumpState);
    if (success) {
      console.log('✅ Sortie Shelly Pump contrôlée avec succès');
    } else {
      console.error('❌ Erreur lors du contrôle de la sortie Shelly Pump');
    }
  }
  setConfirmVisible(false);
};
```

## 🔍 Dépannage

### Problèmes Courants

#### 1. Erreur de Connectivité
```
❌ Erreur contrôle Shelly: Network request failed
```

**Solutions :**
- Vérifier que le Shelly et le téléphone sont sur le même réseau
- Vérifier l'IP du Shelly dans les données du site
- Tester manuellement : `curl http://IP_SHELLY/shelly`

#### 2. Erreur 401 Unauthorized
```
❌ Erreur Shelly Output 0 - Status: 401
```

**Solutions :**
- Vérifier si l'authentification HTTP est activée sur le Shelly
- Ajouter les credentials dans le service `shellyControlService.js`

#### 3. Erreur 404 Not Found
```
❌ Erreur Shelly Output 0 - Status: 404
```

**Solutions :**
- Vérifier que le Shelly Pro 4PM supporte les commandes RPC
- Vérifier l'URL de l'API Shelly

#### 4. IP Shelly Non Trouvée
```
❌ IP Shelly non trouvée dans les données du site
```

**Solutions :**
- Vérifier que le site a été créé avec les bonnes coordonnées Shelly
- Utiliser le bouton "Récupérer coordonnées" dans SiteDetails
- Vérifier que l'IP est correcte dans AsyncStorage

### Tests de Diagnostic

#### A. Test de Connectivité
```bash
# Test basique
ping 192.168.100.62

# Test HTTP
curl -v http://192.168.100.62/shelly
```

#### B. Test des Sorties
```bash
# Test complet d'une sortie
curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":0,"on":true}'
# → Cercle vert sur OUTPUT-0

curl -u user:pass http://192.168.100.62/rpc/Switch.Set -d '{"id":0,"on":false}'
# → Cercle rouge sur OUTPUT-0
```

#### C. Vérification des Logs
```bash
# Voir les logs Shelly
curl http://192.168.100.62/logs
```

## 📊 Monitoring et Logs

### Logs de l'Application

L'application génère des logs détaillés pour le contrôle Shelly :

```
🔧 Contrôle Shelly Output 0 -> ON
📡 Envoi commande à Shelly 192.168.100.62
📤 URL: http://192.168.100.62/rpc/Switch.Set
📤 Payload: {"id":0,"on":true}
✅ Shelly Output 0 ON - Réponse: {"id":0,"source":"http","output":true}
```

### Logs Shelly

Le Shelly enregistre aussi les commandes reçues dans ses logs internes.

## 🔒 Sécurité

### Recommandations

1. **Authentification HTTP** : Active l'authentification sur le Shelly
2. **Réseau Sécurisé** : Utilise un réseau Wi-Fi sécurisé
3. **IP Fixe** : Donne une IP fixe au Shelly pour éviter les changements
4. **Firewall** : Limite l'accès au Shelly depuis le réseau local uniquement

### Configuration d'Authentification

Si tu actives l'authentification HTTP sur le Shelly, modifie le service :

```javascript
// Dans shellyControlService.js
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${btoa('user:password')}` // Ajouter cette ligne
  },
  body: JSON.stringify(payload)
});
```

## 🎯 Résultat Final

Avec cette intégration, tu auras :

- ✅ **App ON** → Cercle vert sur Shelly
- ✅ **App OFF** → Cercle rouge sur Shelly  
- ✅ **AWS synchronisé** → État sauvegardé dans DynamoDB
- ✅ **Temps réel** → Changement immédiat sur le device physique
- ✅ **Logs complets** → Traçabilité des commandes
- ✅ **Gestion d'erreurs** → Robustesse en cas de problème

## 🚀 Prochaines Étapes

1. **Tester** : Lance le script de test pour vérifier la connectivité
2. **Configurer** : Donne une IP fixe au Shelly
3. **Intégrer** : Les modifications de code sont déjà faites
4. **Valider** : Teste chaque composant dans l'application
5. **Monitorer** : Surveille les logs pour détecter les problèmes

Tu as maintenant une vraie télécommande qui contrôle physiquement ton Shelly Pro 4PM ! 🎉
