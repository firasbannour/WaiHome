# 🔧 Configuration du Bucket S3 pour les Images de Profil

## 🚨 Problème actuel
L'erreur `403 Forbidden` indique que le bucket S3 `waihome-profile-photos` n'est pas configuré pour l'accès public aux images.

## ✅ Solution : Configuration du Bucket S3

### 1. **Accéder à la console AWS S3**
- Allez sur [AWS S3 Console](https://console.aws.amazon.com/s3/)
- Sélectionnez votre région : `eu-north-1`

### 2. **Sélectionner le bucket**
- Cliquez sur le bucket : `waihome-profile-photos`

### 3. **Configurer les permissions publiques**

#### Étape A : Désactiver le blocage d'accès public
1. Allez dans l'onglet **"Permissions"**
2. Dans la section **"Block public access (bucket settings)"**
3. Cliquez sur **"Edit"**
4. **Décochez** toutes les options :
   - ❌ Block all public access
   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public access to buckets and objects granted through any public bucket or access point policies
5. Cliquez sur **"Save changes"**

#### Étape B : Ajouter une politique de bucket
1. Dans l'onglet **"Permissions"**
2. Cliquez sur **"Bucket policy"**
3. Cliquez sur **"Edit"**
4. Ajoutez cette politique :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::waihome-profile-photos/public/*"
        }
    ]
}
```

5. Cliquez sur **"Save changes"**

### 4. **Vérifier la structure des dossiers**
Assurez-vous que les images sont uploadées dans le dossier `public/` :
```
waihome-profile-photos/
└── public/
    ├── profile-user1-timestamp1.jpg
    ├── profile-user2-timestamp2.jpg
    └── ...
```

### 5. **Tester l'accès**
Après la configuration, testez l'URL :
```
https://waihome-profile-photos.s3.eu-north-1.amazonaws.com/public/profile-test.jpg
```

## 🔒 **Sécurité recommandée**

### Option 1 : Accès public (actuel)
- ✅ Simple à configurer
- ✅ Pas de signature requise
- ❌ Moins sécurisé

### Option 2 : Accès privé avec signature (recommandé)
Si vous voulez plus de sécurité, modifiez le service pour utiliser des URLs signées :

```javascript
// Dans photoService.js
const imageUrl = await Storage.get(fileName, { 
  level: 'public',
  expires: 3600 // URL valide 1 heure
});
```

## 🧪 **Test après configuration**

1. **Rechargez l'application**
2. **Sélectionnez une nouvelle image**
3. **Vérifiez les logs** :
   ```
   🔗 URL publique construite: https://waihome-profile-photos.s3.eu-north-1.amazonaws.com/public/filename.jpg
   🖼️ Image chargée avec succès: [URL]
   ```

## 📝 **Notes importantes**

- Les changements de permissions peuvent prendre quelques minutes à se propager
- Si l'erreur persiste, vérifiez que l'image existe bien dans le dossier `public/`
- Assurez-vous que votre région AWS est bien `eu-north-1`

## 🆘 **En cas de problème**

Si vous ne pouvez pas modifier les permissions du bucket :
1. Créez un nouveau bucket avec les bonnes permissions
2. Mettez à jour le nom du bucket dans `photoService.js`
3. Ou utilisez CloudFront pour servir les images

