# 🔧 Guide de Configuration AWS Cognito - Templates Email Séparés

## 📋 Vue d'ensemble

Ce guide vous explique comment configurer AWS Cognito pour utiliser des templates d'email distincts pour :
- **Confirmation de compte** (création de compte)
- **Réinitialisation de mot de passe** (oubli de mot de passe)

## 🎯 Problème résolu

Par défaut, AWS Cognito utilise le même template pour tous les emails. Cette configuration permet d'avoir :
- Des emails visuellement différents selon le contexte
- Une meilleure expérience utilisateur
- Une sécurité renforcée avec des couleurs d'alerte

## 🚀 Configuration étape par étape

### **Étape 1 : Accéder à AWS Cognito**

1. Connectez-vous à la [Console AWS](https://console.aws.amazon.com/)
2. Recherchez "Cognito" dans la barre de recherche
3. Cliquez sur **Amazon Cognito**
4. Sélectionnez **User Pools**
5. Cliquez sur votre pool d'utilisateurs WaiHome

### **Étape 2 : Configurer le Template de Confirmation de Compte**

#### **2.1 Accéder aux Templates de Messages**
1. Dans le menu de gauche, cliquez sur **Message templates**
2. Sélectionnez **Verification message**
3. Cliquez sur **Edit**

#### **2.2 Configurer le Template**
1. **Message subject** : `Confirmez votre compte WaiHome - Code de vérification`
2. **Message** : Copiez tout le contenu du fichier `confirmation-email.html`
3. Cliquez sur **Save changes**

### **Étape 3 : Configurer le Template de Réinitialisation de Mot de Passe**

#### **3.1 Méthode 1 : Utiliser le Template d'Invitation (Recommandé)**
1. Dans le menu de gauche, cliquez sur **Message templates**
2. Sélectionnez **Invitation message**
3. Cliquez sur **Edit**
4. **Message subject** : `Réinitialisation de mot de passe WaiHome - Action requise`
5. **Message** : Copiez tout le contenu du fichier `reset-password-email.html`
6. Cliquez sur **Save changes**

#### **3.2 Méthode 2 : Configuration Avancée avec Lambda Triggers**
Si vous voulez un contrôle total, vous pouvez utiliser des Lambda triggers :

1. **Créer une fonction Lambda** pour personnaliser les emails
2. **Configurer le trigger** `CustomMessage` dans Cognito
3. **Modifier le code Lambda** pour envoyer différents templates selon le contexte

### **Étape 4 : Configuration des Adresses Email**

#### **4.1 Email de Confirmation**
1. Dans **Message templates** > **Verification message**
2. **From email address** : `noreply@votre-domaine.com`
3. **From sender name** : `WaiHome - Confirmation`
4. **Reply-to email address** : `support@votre-domaine.com`

#### **4.2 Email de Réinitialisation**
1. Dans **Message templates** > **Invitation message**
2. **From email address** : `security@votre-domaine.com`
3. **From sender name** : `WaiHome - Sécurité`
4. **Reply-to email address** : `support@votre-domaine.com`

### **Étape 5 : Configuration des Paramètres de Sécurité**

#### **5.1 Expiration des Codes**
1. Dans **General settings** > **Password policy**
2. **Temporary password validity** : `1` (pour réinitialisation)
3. **Verification message validity** : `24` (pour confirmation)

#### **5.2 Limites de Tentatives**
1. Dans **Sign-in experience** > **User account recovery**
2. **Recovery method** : `Email`
3. **Maximum attempts** : `3` (recommandé)

## 🔧 Configuration Avancée avec Lambda

### **Créer une Fonction Lambda**

```javascript
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Déterminer le type d'email
    const triggerSource = event.triggerSource;
    
    if (triggerSource === 'CustomMessage_AdminCreateUser') {
        // Email de confirmation de compte
        event.response.emailSubject = 'Confirmez votre compte WaiHome - Code de vérification';
        event.response.emailMessage = getConfirmationEmailTemplate(event.request.codeParameter);
    } else if (triggerSource === 'CustomMessage_ForgotPassword') {
        // Email de réinitialisation de mot de passe
        event.response.emailSubject = 'Réinitialisation de mot de passe WaiHome - Action requise';
        event.response.emailMessage = getResetPasswordEmailTemplate(event.request.codeParameter);
    }
    
    return event;
};

function getConfirmationEmailTemplate(code) {
    // Retourner le template HTML de confirmation
    return `<!DOCTYPE html>...`; // Contenu de confirmation-email.html
}

function getResetPasswordEmailTemplate(code) {
    // Retourner le template HTML de réinitialisation
    return `<!DOCTYPE html>...`; // Contenu de reset-password-email.html
}
```

### **Configurer le Trigger Lambda**

1. Dans **User Pool properties** > **Lambda triggers**
2. Sélectionnez votre fonction Lambda pour **Custom message**
3. Cliquez sur **Save changes**

## 🧪 Tests et Validation

### **Test de Confirmation de Compte**

1. **Créer un compte de test**
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id YOUR_USER_POOL_ID \
     --username test@example.com \
     --temporary-password TempPass123! \
     --user-attributes Name=email,Value=test@example.com
   ```

2. **Vérifier l'email reçu**
   - Design bleu-vert
   - Sujet : "Confirmez votre compte WaiHome"
   - Code de vérification visible

### **Test de Réinitialisation de Mot de Passe**

1. **Demander une réinitialisation**
   ```bash
   aws cognito-idp forgot-password \
     --client-id YOUR_CLIENT_ID \
     --username test@example.com
   ```

2. **Vérifier l'email reçu**
   - Design rouge
   - Sujet : "Réinitialisation de mot de passe WaiHome"
   - Badge "Action requise"
   - Code de réinitialisation visible

## ⚠️ Points d'Attention

### **Limitations AWS Cognito**

1. **Templates HTML** : Support limité dans certains cas
2. **Variables** : Seules les variables Cognito standard sont supportées
3. **Images** : Doivent être hébergées publiquement
4. **CSS** : Support variable selon les clients email

### **Bonnes Pratiques**

1. **Testez sur plusieurs clients email** (Gmail, Outlook, Apple Mail)
2. **Vérifiez la délivrabilité** avec des outils comme Mail Tester
3. **Surveillez les taux de rebond** dans AWS SES
4. **Mettez à jour les templates** régulièrement

### **Sécurité**

1. **Ne jamais inclure de mots de passe** dans les templates
2. **Utiliser HTTPS** pour tous les liens
3. **Valider les adresses email** avant envoi
4. **Limiter les tentatives** de réinitialisation

## 🔍 Dépannage

### **Problèmes Courants**

#### **Email non reçu**
1. Vérifiez les paramètres SES dans AWS
2. Contrôlez les quotas d'envoi
3. Vérifiez les filtres anti-spam

#### **Template non appliqué**
1. Vérifiez que le HTML est valide
2. Contrôlez les variables Cognito
3. Testez avec un template simple

#### **Couleurs incorrectes**
1. Vérifiez le support CSS du client email
2. Utilisez des couleurs hexadécimales
3. Testez en mode texte

### **Logs et Monitoring**

1. **CloudWatch Logs** : Surveillez les erreurs Lambda
2. **SES Metrics** : Contrôlez les taux de délivrabilité
3. **Cognito Events** : Surveillez les tentatives d'authentification

## 📊 Métriques de Succès

### **Indicateurs à Surveiller**

1. **Taux de confirmation** : > 80%
2. **Taux de réinitialisation** : > 70%
3. **Temps de délivrance** : < 30 secondes
4. **Taux de rebond** : < 2%

### **Amélioration Continue**

1. **A/B Testing** : Testez différents designs
2. **Feedback utilisateur** : Collectez les retours
3. **Analytics** : Surveillez les comportements
4. **Optimisation** : Améliorez les templates

## 🎯 Résultat Final

Avec cette configuration, vous aurez :

✅ **Deux templates d'email distincts** avec des designs différents
✅ **Reconnaissance immédiate** du type d'email par l'utilisateur
✅ **Sécurité renforcée** avec des couleurs d'alerte
✅ **Expérience utilisateur améliorée** avec des instructions claires
✅ **Professionnalisme** avec des emails cohérents avec votre marque

---

**Support** : Si vous rencontrez des problèmes, consultez la [documentation AWS Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/) ou contactez le support AWS.
