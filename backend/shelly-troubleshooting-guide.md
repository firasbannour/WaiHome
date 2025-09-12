# Guide de Dépannage - Connexion Shelly 🔧

## 🚨 **Problème Identifié**
L'appareil Shelly n'est pas accessible sur le réseau local.

## 🔍 **Diagnostic Effectué**
- ✅ Backend accessible
- ✅ Connexion internet OK
- ❌ Aucun appareil Shelly trouvé sur les IPs connues
- ❌ Timeouts sur les connexions

## 🛠️ **Solutions à Essayer**

### **1. Vérifier l'état physique de l'appareil Shelly**

#### Étape 1 : Vérification visuelle
- [ ] L'appareil Shelly est-il allumé ?
- [ ] Y a-t-il une LED qui clignote ?
- [ ] L'alimentation est-elle branchée ?

#### Étape 2 : Redémarrage
1. Débranchez l'alimentation de l'appareil Shelly
2. Attendez 10 secondes
3. Rebranchez l'alimentation
4. Attendez que l'appareil démarre (LED stable)

### **2. Vérifier la connexion Wi-Fi**

#### Étape 1 : Mode AP (Access Point)
1. L'appareil Shelly démarre en mode AP
2. Connectez-vous au réseau Wi-Fi "Shelly-XXXXXX"
3. Ouvrez un navigateur et allez sur `http://192.168.33.1`
4. Configurez la connexion Wi-Fi

#### Étape 2 : Configuration Wi-Fi
1. Dans l'interface Shelly, allez dans "Internet & Security"
2. Sélectionnez votre réseau Wi-Fi
3. Entrez le mot de passe
4. Sauvegardez la configuration

### **3. Trouver l'IP de l'appareil Shelly**

#### Méthode 1 : Interface web Shelly
1. Connectez-vous à l'interface web de votre routeur
2. Allez dans "DHCP" ou "Clients connectés"
3. Cherchez un appareil nommé "Shelly" ou avec une adresse MAC commençant par "08:3A:F2"

#### Méthode 2 : Scan réseau
```bash
# Sur Windows (PowerShell)
arp -a | findstr "192.168"

# Sur Mac/Linux
arp -a | grep "192.168"
```

#### Méthode 3 : Application Shelly
1. Téléchargez l'application Shelly sur votre téléphone
2. Scannez le réseau local
3. Notez l'IP de votre appareil

### **4. Tester la connexion manuellement**

#### Test avec curl
```bash
# Test de base
curl http://[IP_SHELLY]/shelly

# Test avec timeout
curl --connect-timeout 5 http://[IP_SHELLY]/status

# Test avec User-Agent
curl -H "User-Agent: WaiHome-App/1.0" http://[IP_SHELLY]/shelly
```

#### Test avec navigateur
1. Ouvrez un navigateur
2. Allez sur `http://[IP_SHELLY]`
3. Vous devriez voir l'interface Shelly

### **5. Vérifier les paramètres réseau**

#### Pare-feu
- [ ] Le pare-feu Windows n'empêche pas les connexions
- [ ] L'antivirus n'empêche pas les connexions
- [ ] Le routeur n'a pas de restrictions

#### Réseau
- [ ] L'appareil Shelly est sur le même réseau que votre ordinateur
- [ ] Pas de VLAN ou de réseau isolé
- [ ] Le DHCP fonctionne correctement

### **6. Mettre à jour l'IP dans l'application**

Une fois l'IP trouvée, mettez à jour votre application :

#### Dans AsyncStorage
```javascript
// Sauvegarder la nouvelle IP
await AsyncStorage.setItem('shellyIP', '192.168.100.XXX');
```

#### Dans les paramètres de l'app
1. Allez dans les paramètres de l'application
2. Mettez à jour l'IP de l'appareil Shelly
3. Testez la connexion

### **7. Script de test rapide**

Créez un fichier `test-shelly-ip.js` :

```javascript
const axios = require('axios');

async function testShellyIP(ip) {
  try {
    console.log(`🔍 Test de ${ip}...`);
    
    const response = await axios.get(`http://${ip}/shelly`, {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WaiHome-App/1.0'
      }
    });
    
    console.log(`✅ Shelly trouvé sur ${ip}!`);
    console.log('Données:', response.data);
    return true;
    
  } catch (error) {
    console.log(`❌ ${ip}: ${error.message}`);
    return false;
  }
}

// Testez votre IP
testShellyIP('192.168.100.XXX'); // Remplacez XXX par votre IP
```

## 🎯 **Prochaines Étapes**

1. **Redémarrez l'appareil Shelly**
2. **Vérifiez la configuration Wi-Fi**
3. **Trouvez la bonne IP**
4. **Testez la connexion manuellement**
5. **Mettez à jour l'application**

## 📞 **Support**

Si le problème persiste :
1. Vérifiez la documentation Shelly
2. Contactez le support Shelly
3. Vérifiez les forums Shelly

## 🔄 **Test Final**

Une fois l'IP trouvée, relancez le diagnostic :
```bash
node diagnose-shelly-connection.js
```

