# WaiHome Email Templates - Lambda Function

Ce dossier contient les templates d'email personnalisés pour AWS Cognito Lambda Triggers.

## Fichiers

- `lambda-function.js` - Fonction Lambda pour les emails de confirmation et de réinitialisation de mot de passe
- `confirmation-email.html` - Template HTML pour l'email de confirmation (version statique)
- `reset-password-email.html` - Template HTML pour l'email de réinitialisation de mot de passe (version statique)

## Configuration AWS Cognito

### 1. Créer la fonction Lambda

1. Allez dans la console AWS Lambda
2. Créez une nouvelle fonction avec le runtime Node.js 18.x
3. Copiez le contenu de `lambda-function.js` dans votre fonction
4. Configurez les permissions nécessaires pour Cognito

### 2. Configurer les triggers Cognito

1. Allez dans AWS Cognito User Pool
2. Dans "Messaging", activez "Custom message"
3. Sélectionnez votre fonction Lambda comme trigger

### 3. Permissions IAM

Votre fonction Lambda a besoin des permissions suivantes :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

## Fonctionnalités

### Email de Confirmation (`CustomMessage_SignUp`)

- Design moderne avec logo WaiHome
- Code de vérification mis en évidence
- Instructions étape par étape
- Section sécurité
- Footer avec liens utiles

### Email de Réinitialisation de Mot de Passe (`CustomMessage_ForgotPassword`)

- Bannière d'alerte urgente
- Code de réinitialisation sécurisé
- Instructions de sécurité renforcées
- Avertissement si la demande n'est pas initiée par l'utilisateur

## Personnalisation

### Couleurs
- Couleur principale : `#0c7a7e` (vert-bleu WaiHome)
- Couleur secondaire : `#0a5f63` (vert-bleu foncé)
- Couleur d'alerte : `#ff6b6b` (rouge pour les urgences)

### Logo
Le logo utilise l'URL : `https://i.imgur.com/2mPcGCX.png`

### Expiration des codes
- Confirmation : 1 heure
- Réinitialisation : 1 heure

## Test

Pour tester vos templates :

1. Déployez la fonction Lambda
2. Configurez le trigger dans Cognito
3. Créez un nouvel utilisateur ou demandez une réinitialisation de mot de passe
4. Vérifiez que l'email reçu correspond au design attendu

## Dépannage

### Problèmes courants

1. **Email non reçu** : Vérifiez les logs CloudWatch de votre fonction Lambda
2. **Design cassé** : Certains clients email peuvent ne pas supporter tous les styles CSS
3. **Code non remplacé** : Vérifiez que `{####}` est bien présent dans le template

### Logs utiles

La fonction log tous les événements reçus. Vérifiez CloudWatch pour :
- Les événements Cognito reçus
- Les erreurs de traitement
- Les templates générés

## Support

Pour toute question ou problème :
- Vérifiez les logs CloudWatch
- Testez avec différents clients email
- Consultez la documentation AWS Cognito
