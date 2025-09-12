import { Storage } from '@aws-amplify/storage';

export class PhotoService {
  static async uploadProfilePhoto(file, fileName) {
    try {
      console.log('🚀 Début upload photo vers S3:', fileName);
      
      // Upload vers S3
      const result = await Storage.put(fileName, file, {
        contentType: 'image/jpeg',
        level: 'public',
        metadata: {
          uploadedAt: new Date().toISOString(),
          type: 'profile-photo'
        }
      });
      
      console.log('✅ Photo uploadée avec succès:', result);
      
      // Construire l'URL publique directement
      const bucketName = 'waihome-profile-photos';
      const region = 'eu-north-1';
      const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/public/${fileName}`;
      
      console.log('🔗 URL publique construite:', publicUrl);
      
      return {
        success: true,
        data: publicUrl,
        key: fileName
      };
    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getProfilePhotoUrl(key) {
    try {
      // Construire l'URL publique directement
      const bucketName = 'waihome-profile-photos';
      const region = 'eu-north-1';
      const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/public/${key}`;
      
      return {
        success: true,
        data: publicUrl
      };
    } catch (error) {
      console.error('❌ Erreur récupération photo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async deleteProfilePhoto(key) {
    try {
      await Storage.remove(key, { level: 'public' });
      return {
        success: true,
        message: 'Photo supprimée avec succès'
      };
    } catch (error) {
      console.error('❌ Erreur suppression photo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async listUserPhotos(userId) {
    try {
      const photos = await Storage.list(`profile-${userId}-`, { level: 'public' });
      return {
        success: true,
        data: photos.results
      };
    } catch (error) {
      console.error('❌ Erreur liste photos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}