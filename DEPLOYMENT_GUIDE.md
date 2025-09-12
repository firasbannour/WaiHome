# Guide de Déploiement WaiHome - AWS

## Vue d'ensemble

Ce guide vous accompagne dans le déploiement complet du système WaiHome sur AWS, incluant :
- Gestion des comptes utilisateurs et administrateurs
- Sauvegarde des données sur DynamoDB
- Réception et traitement des données Shelly
- Interface d'administration

## Prérequis

### 1. Compte AWS
- Compte AWS actif
- Accès aux services : DynamoDB, EC2, IAM, Elastic Beanstalk
- Clés d'accès AWS configurées

### 2. Outils de développement
- Node.js 18+
- AWS CLI configuré
- Git

## Étapes de Déploiement

### Étape 1 : Configuration AWS

1. **Créer un utilisateur IAM pour l'application**
```bash
# Créer un utilisateur IAM
aws iam create-user --user-name waihome-backend-user

# Créer une politique d'accès
aws iam create-policy --policy-name WaiHomeBackendPolicy --policy-document file://iam-policy.json

# Attacher la politique à l'utilisateur
aws iam attach-user-policy --user-name waihome-backend-user --policy-arn arn:aws:iam::ACCOUNT_ID:policy/WaiHomeBackendPolicy

# Créer des clés d'accès
aws iam create-access-key --user-name waihome-backend-user
```

2. **Créer les tables DynamoDB**
```bash
cd WaiHome/backend
npm install
node scripts/create-tables.js
```

### Étape 2 : Configuration de l'Environnement

1. **Créer le fichier .env**
```bash
cp env.example .env
```

2. **Configurer les variables d'environnement**
```env
# Configuration AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Configuration JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Configuration du serveur
PORT=3000
NODE_ENV=production
```

### Étape 3 : Déploiement du Backend

1. **Préparer l'application**
```bash
cd WaiHome/backend
npm install
npm run build
```

2. **Déployer sur Elastic Beanstalk**
```bash
# Installer EB CLI
pip install awsebcli

# Initialiser l'application EB
eb init waihome-backend --platform node.js --region us-east-1

# Créer l'environnement
eb create waihome-backend-prod

# Déployer
eb deploy
```

### Étape 4 : Configuration des Applications

#### Application Utilisateur (WaiHome)

1. **Configurer l'API**
```javascript
// Dans services/api.js
const API_BASE_URL = 'https://your-eb-environment.elasticbeanstalk.com/api';
```

2. **Tester la connexion**
```bash
cd WaiHome
npm start
```

#### Application Admin (WaiHomeAdmin)

1. **Configurer l'API admin**
```javascript
// Dans services/api.js
const API_BASE_URL = 'https://your-eb-environment.elasticbeanstalk.com/api';
```

2. **Tester l'interface admin**
```bash
cd WaiHomeadmin
npm start
```

## Structure des Données

### Tables DynamoDB

#### 1. waihome-users
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user|admin",
  "password": "hashed_password",
  "createdAt": "2024-01-01T00:00:00Z",
  "lastLogin": "2024-01-01T00:00:00Z"
}
```

#### 2. waihome-sites
```json
{
  "userId": "uuid",
  "siteId": "uuid",
  "siteName": "Site 1",
  "siteType": "residential|commercial",
  "location": "Address",
  "status": "connected|disconnected|maintenance",
  "solidsLevel": 75.5,
  "notificationsEnabled": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "lastUpdate": "2024-01-01T00:00:00Z"
}
```

#### 3. waihome-shelly-data
```json
{
  "siteId": "uuid",
  "dataId": "uuid",
  "deviceId": "shelly_device_id",
  "sensorType": "solids|temperature|humidity",
  "value": 75.5,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription utilisateur
- `POST /api/auth/login` - Connexion
- `GET /api/auth/verify` - Vérification token
- `POST /api/auth/change-password` - Changement mot de passe

### Utilisateurs
- `GET /api/users/profile` - Profil utilisateur
- `PUT /api/users/profile` - Mise à jour profil
- `GET /api/users/sites` - Sites de l'utilisateur
- `POST /api/users/sites` - Créer un site
- `PUT /api/users/sites/:siteId` - Mettre à jour un site
- `DELETE /api/users/sites/:siteId` - Supprimer un site
- `GET /api/users/stats` - Statistiques utilisateur

### Données Shelly
- `POST /api/shelly/data` - Réception données Shelly
- `GET /api/shelly/site/:siteId` - Données d'un site
- `GET /api/shelly/site/:siteId/stats` - Statistiques d'un site
- `GET /api/shelly/site/:siteId/alerts` - Alertes d'un site

### Administration
- `GET /api/admin/users` - Tous les utilisateurs
- `GET /api/admin/stats` - Statistiques globales
- `GET /api/admin/sites` - Tous les sites
- `GET /api/admin/alerts` - Alertes globales
- `PATCH /api/admin/sites/:siteId/status` - Mettre à jour statut site
- `GET /api/admin/sites/:siteId/data` - Données d'un site (admin)
- `DELETE /api/admin/users/:userId` - Supprimer un utilisateur
- `GET /api/admin/logs` - Logs d'activité

## Sécurité

### 1. Authentification JWT
- Tokens valides 7 jours
- Vérification automatique sur toutes les routes protégées
- Rôles : `user` et `admin`

### 2. Autorisation
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Les admins ont accès à toutes les données
- Vérification des permissions sur chaque endpoint

### 3. Validation des données
- Validation des entrées utilisateur
- Sanitisation des données
- Protection contre les injections

## Monitoring et Logs

### 1. CloudWatch Logs
```bash
# Configurer les logs
aws logs create-log-group --log-group-name /aws/elasticbeanstalk/waihome-backend
```

### 2. Métriques importantes
- Nombre d'utilisateurs actifs
- Nombre de sites connectés
- Niveau moyen des solides
- Temps de réponse API

## Maintenance

### 1. Sauvegarde automatique
```bash
# Script de sauvegarde DynamoDB
aws dynamodb create-backup --table-name waihome-users --backup-name daily-backup
```

### 2. Mise à jour de l'application
```bash
# Déployer une nouvelle version
eb deploy
```

### 3. Monitoring des alertes
- Surveiller les niveaux de solides élevés
- Vérifier les sites déconnectés
- Contrôler les performances

## Dépannage

### Problèmes courants

1. **Erreur de connexion DynamoDB**
   - Vérifier les clés AWS
   - Contrôler les permissions IAM
   - Vérifier la région AWS

2. **Erreur JWT**
   - Vérifier JWT_SECRET
   - Contrôler l'expiration des tokens
   - Vérifier le format des tokens

3. **Problèmes de performance**
   - Vérifier les index DynamoDB
   - Optimiser les requêtes
   - Surveiller l'utilisation des ressources

## Support

Pour toute question ou problème :
1. Vérifier les logs CloudWatch
2. Consulter la documentation AWS
3. Contacter l'équipe de développement

---

**Note :** Ce guide suppose une configuration AWS standard. Adaptez les paramètres selon vos besoins spécifiques. 