import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Modal,
  Animated,
  ActivityIndicator
} from "react-native";
import { useNavigation } from '@react-navigation/native';
import { AuthService } from '../services/authService';
import { PhotoService } from '../services/photoService';
import { ShellyService } from '../services/shellyService';
import { FontAwesome, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Pour la nouvelle API, essayer d'importer MediaType directement si besoin
// import { MediaType } from 'expo-image-picker';

/**
 * Profile Screen using a cohesive modern interface.
 * Allows display and editing of user information in English.
 */
export default function ProfileScreen() {
  const navigation = useNavigation();

  // Default profile (for reset)
  const defaultUser = {
    id: "USER12345",
    name: "User Test",
    email: "user@test.com",
    address: "123 Main St, Tunis",
    postalCode: "1001",
    dateOfBirth: "1990-01-01",
    phoneNumber: "", // Phone number is optional
    picture: null as string | null, // Image de profil
  };

  // User state
  const [user, setUser] = useState(defaultUser);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [address, setAddress] = useState(user.address);
  const [postalCode, setPostalCode] = useState(user.postalCode);
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);

  // Image de profil
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State for custom error modal
  const [validationError, setValidationError] = useState<string | null>(null);

  // State for user's sites
  const [sites, setSites] = useState<any[]>([]);

  // Fonction pour choisir et uploader une image
  const pickProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow gallery access to choose an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      console.log('ImagePicker result:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        console.log('Image URI set:', imageUri);
        
        // Upload vers AWS S3
        await uploadImageToS3(imageUri);
      } else {
        Alert.alert('Error', "Unable to retrieve the selected image.");
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Unable to select the image.');
    }
  };

  // Charger les sites de l'utilisateur
  const loadUserSites = async () => {
    try {
      console.log('🏠 Chargement des sites utilisateur...');
      const sitesData = await AsyncStorage.getItem('sites');
      console.log('💾 Sites récupérés:', sitesData);
      
      if (sitesData) {
        const parsedSites = JSON.parse(sitesData);
        console.log('📋 Sites parsés:', parsedSites);
        setSites(parsedSites);
      } else {
        console.log('📭 Aucun site trouvé dans le stockage local');
        setSites([]);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des sites:', error);
      setSites([]);
    }
  };

  // Fonction pour uploader l'image vers AWS S3
  const uploadImageToS3 = async (imageUri: string) => {
    try {
      setIsUploading(true);
      console.log('🚀 Début de l\'upload vers S3...');
      
      // Créer un nom de fichier unique
      const timestamp = Date.now();
      const fileName = `profile-${user.id}-${timestamp}.jpg`;
      
      // Convertir l'URI en blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      console.log('📦 Image convertie en blob, taille:', blob.size, 'bytes');
      
      // Upload vers S3
      const result = await PhotoService.uploadProfilePhoto(blob, fileName);
      
      if (result.success) {
        console.log('✅ Photo uploadée vers S3:', result.data);
        
        Alert.alert('Success', 'Profile photo saved successfully!');
        
        // Sauvegarder l'URL dans le profil utilisateur
        await saveImageUrlToProfile(result.data);
      } else {
        console.error('❌ Erreur upload S3:', result.error);
        Alert.alert('Error', 'Unable to save photo: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload:', error);
      Alert.alert('Error', 'Error saving photo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Fonction pour sauvegarder l'URL de l'image dans le profil
  const saveImageUrlToProfile = async (imageUrl: string) => {
    try {
      console.log('💾 Sauvegarde de l\'URL de l\'image dans le profil...');
      console.log('🖼️ URL de l\'image à sauvegarder:', imageUrl);
      
      // Sauvegarder l'URL dans les attributs Cognito
      const result = await AuthService.updateUserProfile({
        name: user.name,
        email: user.email,
        address: user.address,
        birthdate: user.dateOfBirth,
        phoneNumber: user.phoneNumber,
        picture: imageUrl, // Ajouter l'URL de l'image
      });
      
      if (result.success) {
        console.log('✅ URL de l\'image sauvegardée dans Cognito');
        // Mettre à jour l'état local avec la nouvelle image
        setProfileImage(imageUrl);
        console.log('🔄 profileImage mis à jour avec:', imageUrl);
        // Mettre à jour l'utilisateur local
        setUser(prevUser => {
          const updatedUser = {
            ...prevUser,
            picture: imageUrl
          };
          console.log('🔄 user.picture mis à jour avec:', updatedUser.picture);
          return updatedUser;
        });
      } else {
        console.error('❌ Erreur lors de la sauvegarde dans Cognito:', result.error);
        Alert.alert('Warning', 'Photo uploaded but profile update failed. Please try again.');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde de l\'URL:', error);
      Alert.alert('Error', 'Failed to save photo URL to profile.');
    }
  };

  // Fonctions de validation
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePostalCode = (code: string) => /^\d{4,}$/.test(code); // Minimum 4 chiffres
  const validatePhone = (phone: string) => true; // Validation téléphone désactivée - accepte tout format
  const validateDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
  const isNotEmpty = (val: string) => val.trim().length > 0;

  const startEditing = () => {
    setName(user.name);
    setEmail(user.email);
    setAddress(user.address);
    setPostalCode(user.postalCode);
    setDateOfBirth(user.dateOfBirth);
    setPhoneNumber(user.phoneNumber);
    setIsEditing(true);
  };
  const cancelEditing = () => setIsEditing(false);

  const saveChanges = async () => {
    if (!isNotEmpty(name)) {
      setValidationError('Name is required.');
      return;
    }
    if (!validateEmail(email)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
          if (!validatePostalCode(postalCode)) {
        setValidationError('Please enter a valid postal code (minimum 4 digits).');
        return;
      }
      // Validation téléphone désactivée - accepte tout format
    if (!validateDate(dateOfBirth)) {
      setValidationError('Please enter a valid date of birth (YYYY-MM-DD).');
      return;
    }
    // Update attributes in Cognito
    const result = await AuthService.updateUserProfile({
      name,
      email,
      address,
      birthdate: dateOfBirth,
      phoneNumber: phoneNumber.trim() || undefined, // Only send if not empty
      picture: user.picture || undefined, // Conserver l'image de profil existante
    });
    if (result.success && result.data) {
      const p = result.data as any;
      setUser({
        id: p.id || user.id,
        name: p.name || '',
        email: p.email || '',
        address: p.address || '',
        postalCode, // keep local field
        dateOfBirth: p.birthdate || dateOfBirth,
        phoneNumber: p.phoneNumber || phoneNumber,
        picture: p.picture || user.picture, // Conserver l'image de profil
      });
      setIsEditing(false);
    } else {
      Alert.alert('Update failed', result.error || 'Unable to update profile');
    }
  };

  // Reset form fields to current user values
  const resetForm = () => {
    setName(user.name);
    setEmail(user.email);
    setAddress(user.address);
    setPostalCode(user.postalCode);
    setDateOfBirth(user.dateOfBirth);
    setPhoneNumber(user.phoneNumber);
  };

  // Reset entire system/profile
  const systemReset = () => {
    setUser(defaultUser);
    setIsEditing(false);
    setProfileImage(null);
  };

  const [showResetModal, setShowResetModal] = useState(false);

  // Load profile from Cognito on mount
  useEffect(() => {
    (async () => {
      console.log('🔄 useEffect - Chargement du profil et des appareils...');
      
      const res = await AuthService.getUserProfile();
      if (res.success && res.data) {
        const p = res.data as any;
        const loaded = {
          id: p.id || defaultUser.id,
          name: p.name || '',
          email: p.email || '',
          address: p.address || '',
          postalCode: defaultUser.postalCode,
          dateOfBirth: p.birthdate || '',
          phoneNumber: p.phoneNumber || '', // Phone number is optional
          picture: p.picture || null, // Charger l'image de profil
        };
        setUser(loaded);
        setName(loaded.name);
        setEmail(loaded.email);
        setAddress(loaded.address);
        setPostalCode(loaded.postalCode);
        setDateOfBirth(loaded.dateOfBirth);
        setPhoneNumber(loaded.phoneNumber);
        
        // Charger l'image de profil si elle existe
        if (loaded.picture) {
          setProfileImage(loaded.picture);
          console.log('🖼️ Image de profil chargée:', loaded.picture);
        }
      }
      
      // Charger les sites de l'utilisateur
      console.log('🏠 useEffect - Appel de loadUserSites...');
      await loadUserSites();
      console.log('✅ useEffect - loadUserSites terminé');
    })();
  }, []);

  // Log pour déboguer l'affichage de l'image
  console.log('🔄 Rendu - profileImage:', profileImage);
  console.log('🔄 Rendu - user.picture:', user.picture);
  console.log('🔄 Rendu - URL finale:', profileImage || user.picture);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <LinearGradient
        colors={["#0c7a7e", "#81bec6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerModern}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnModern}>
          <MaterialIcons name="arrow-back" size={26} color="#0c7a7e" />
        </TouchableOpacity>
        {/* Bouton reset systeme en haut à droite */}
        <TouchableOpacity
          style={styles.resetHeaderBtn}
          onPress={() => setShowResetModal(true)}
        >
          <MaterialIcons name="refresh" size={22} color="#8B0000" />
        </TouchableOpacity>
        {/* Modal custom pour reset */}
        <Modal
          visible={!!showResetModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowResetModal(false)}
        >
          <View style={styles.modalOverlay}> 
            <View style={styles.modalContent}> 
              <MaterialIcons name="warning" size={44} color="#d9534f" style={{alignSelf:'center', marginBottom: 12}} />
              <Text style={styles.modalTitle}>Reset Profile</Text>
              <Text style={styles.modalTextCenter}>Are you sure you want to reset your profile?{"\n"}This action cannot be undone.</Text>
              <View style={styles.modalButtonsRow}> 
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowResetModal(false)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.resetBtn]} onPress={() => { setShowResetModal(false); systemReset(); }}>
                  <Text style={[styles.modalBtnText, styles.resetBtnText]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* Modal for validation error */}
        <Modal
          visible={!!validationError}
          transparent
          animationType="fade"
          onRequestClose={() => setValidationError(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 28, width: 320 }] }>
              <MaterialIcons name="error-outline" size={44} color="#d32f2f" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#d32f2f', marginBottom: 10, textAlign: 'center' }}>Validation Error</Text>
              <Text style={{ fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 22 }}>{validationError}</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#0c7a7e', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 38, alignItems: 'center', width: '80%' }}
                onPress={() => setValidationError(null)}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <View style={styles.avatarBoxModern}>
          <View style={styles.avatarCircleModern}>
            {(profileImage || user.picture) ? (
              <Image 
                source={{ uri: profileImage || user.picture }} 
                style={styles.avatarImg}
                onLoad={() => console.log('🖼️ Image chargée avec succès:', profileImage || user.picture)}
                onError={(error) => console.error('❌ Erreur de chargement de l\'image:', error)}
              />
            ) : (
              <FontAwesome name="user-circle" size={90} color="#fff" />
            )}
            {/* Bouton + pour changer l'image */}
            <TouchableOpacity
              style={[styles.avatarAddBtn, isUploading && styles.avatarAddBtnDisabled]}
              onPress={pickProfileImage}
              activeOpacity={0.7}
              disabled={isUploading}
            >
              {isUploading ? (
                <MaterialIcons name="cloud-upload" size={20} color="#666" />
              ) : (
                <MaterialIcons name="add" size={24} color="#0c7a7e" />
              )}
            </TouchableOpacity>
            {/* Indicateur de chargement */}
            {isUploading && (
              <View style={styles.uploadIndicator}>
                <Text style={styles.uploadText}>Uploading...</Text>
              </View>
            )}
          </View>
          {!isEditing && (
            <>
              <Text style={styles.avatarNameModern}>{user.name}</Text>
              <Text style={styles.userIdTxtModern}>ID: {user.id}</Text>
            </>
          )}
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.contentModern}>
        <View style={styles.cardModern}>
          {/* Titre Profile Settings */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="person" size={24} color="#0c7a7e" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0c7a7e', letterSpacing: 0.2 }}>Profile Settings</Text>
            </View>
            {!isEditing && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 22,
                  paddingVertical: 9,
                  paddingHorizontal: 20,
                  backgroundColor: 'transparent',
                  shadowColor: '#0c7a7e',
                  shadowOpacity: 0.13,
                  shadowRadius: 6,
                  elevation: 3,
                  overflow: 'hidden',
                }}
                onPress={startEditing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#0c7a7e", "#81bec6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 22,
                  }}
                />
                <MaterialIcons name="edit" size={18} color="#fff" style={{ marginRight: 7, zIndex: 1 }} />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, zIndex: 1 }}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {isEditing ? (
            <>
              {/* Full Name */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <FontAwesome name="user" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor="#9FA5AA"
                />
              </View>
              {/* Email Address */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <FontAwesome name="envelope" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email Address"
                  placeholderTextColor="#9FA5AA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              {/* Address */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <FontAwesome name="map-marker" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Address"
                  placeholderTextColor="#9FA5AA"
                />
              </View>
              {/* Postal Code */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <MaterialIcons name="badge" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="Postal Code (min 4 digits)"
                  placeholderTextColor="#9FA5AA"
                  keyboardType="numeric"
                />
              </View>
              {/* Date of Birth */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <FontAwesome name="birthday-cake" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  placeholderTextColor="#9FA5AA"
                />
              </View>
              {/* Phone Number */}
              <View style={[styles.inputWrapperModern, { backgroundColor: '#f0f7fa' }] }>
                <FontAwesome name="phone" size={20} color="#0c7a7e" />
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Phone Number (optional)"
                  placeholderTextColor="#9FA5AA"
                  keyboardType="phone-pad"
                />
              </View>
              {/* Action Buttons */}
              <View style={styles.actionRowModern}>
                <TouchableOpacity style={styles.saveBtnModern} onPress={saveChanges}>
                  <Text style={styles.saveTxtModern}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtnModern} onPress={cancelEditing}>
                  <Text style={styles.cancelTxtModern}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Display Fields */}
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <FontAwesome name="user" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>{user.name}</Text>
              </View>
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <FontAwesome name="envelope" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>{user.email}</Text>
              </View>
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <FontAwesome name="map-marker" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>{user.address}</Text>
              </View>
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <MaterialIcons name="badge" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>Postal Code: {user.postalCode}</Text>
              </View>
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <FontAwesome name="birthday-cake" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>{user.dateOfBirth}</Text>
              </View>
              <View style={[styles.fieldRowModern, { backgroundColor: '#f0f7fa', borderRadius: 10, marginBottom: 10, paddingVertical: 10 }]}>
                <FontAwesome name="phone" size={20} color="#0c7a7e" />
                <Text style={styles.fieldTxt}>{user.phoneNumber || 'Not provided'}</Text>
              </View>
              {/* Aucun bouton Edit ou Logout ici */}
            </>
          )}
        </View>
        {/* Device Settings Section - Nouvelle section pour afficher tous les sites */}
        <View style={styles.cardModern}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <MaterialIcons name="router" size={24} color="#0c7a7e" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0c7a7e', letterSpacing: 0.2 }}>Device Settings</Text>
            </View>
          
          {sites && sites.length > 0 ? (
            sites.map((site, index) => (
              <View key={site.id} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <MaterialIcons 
                    name="router" 
                    size={24} 
                    color="#0c7a7e" 
                    style={styles.deviceIcon}
                  />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{site.name}</Text>
                    <Text style={styles.deviceStatus}>
                      Status: {site.status === "Connected" ? "Connecté" : site.status}
                    </Text>
          </View>
              </View>
                
                {site.deviceInfo && (
                  <View style={styles.deviceDetails}>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>Appareil:</Text> {site.deviceInfo.deviceName || 'N/A'}
                    </Text>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>Connexion:</Text> {site.deviceInfo.connectionType || 'N/A'}
                    </Text>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>MAC:</Text> {site.deviceInfo.macAddress || 'N/A'}
                    </Text>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>IP:</Text> {site.deviceInfo.ipAddress || 'N/A'}
                    </Text>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>Solides:</Text> {site.solids}%
                    </Text>
                    <Text style={styles.deviceDetail}>
                      <Text style={styles.detailLabel}>Notifications:</Text> {site.notificationsEnabled ? 'Activées' : 'Désactivées'}
                    </Text>
              </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.noDevicesContainer}>
              <MaterialIcons name="router" size={48} color="#CCC" />
              <Text style={styles.noDevicesText}>Aucun appareil connecté</Text>
              <Text style={styles.noDevicesSubtext}>
                Connectez des appareils depuis la page principale pour les voir ici
              </Text>
                </View>
          )}
        </View>
        {/* Logout button moderne en bas de page */}
        <TouchableOpacity
          activeOpacity={0.65}
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 32,
            marginTop: 28,
            marginBottom: 28,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderWidth: 1.2,
            borderColor: '#b71c1c',
            borderRadius: 22,
            shadowColor: '#b71c1c',
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          }}
                      onPress={async () => {
                        await AuthService.signOut();
                        (navigation as any).navigate('login');
                      }}
        >
          <MaterialIcons name="logout" size={23} color="#b71c1c" style={{ marginRight: 10 }} />
          <Text style={{ color: '#b71c1c', fontSize: 17, fontWeight: '600', letterSpacing: 0.3, textTransform: 'lowercase' }}>logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ================================= STYLES ==================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F0F4F7" },
  headerModern: {
    height: 200,
    justifyContent: "flex-end",
    paddingBottom: 18,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 8 }
    })
  },
  backBtnModern: { position: "absolute", top: Platform.OS === "ios" ? 52 : 24, left: 20, backgroundColor: '#fff', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  avatarBoxModern: { alignItems: "center", marginTop: 10 },
  avatarCircleModern: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0c7a7e', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 4, borderColor: '#fff' },
  avatarNameModern: { marginTop: 8, fontSize: 22, fontWeight: "700", color: "#fff" },
  userIdTxtModern: { fontSize: 14, color: "#fff", opacity: 0.8, marginTop: 2 },
  contentModern: { paddingHorizontal: 20, paddingTop: 32 },
  cardModern: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  fieldRowModern: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E4E8EB"
  },
  inputWrapperModern: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D8DB",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    height: 52,
    backgroundColor: '#f7fafb',
  },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: "#333" },
  actionRowModern: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  editBtnModern: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0c7a7e",
    paddingVertical: 14,
    borderRadius: 14,
    marginRight: 8
  },
  editTxtModern: { color: "#FFF", fontSize: 16, fontWeight: "600", marginLeft: 6 },
  saveBtnModern: { flex: 1, backgroundColor: "#0c7a7e", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginRight: 8 },
  saveTxtModern: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  cancelBtnModern: { flex: 1, backgroundColor: "#A0A8AB", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginLeft: 8 },
  cancelTxtModern: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  logoutBtnModern: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#C95454",
    paddingVertical: 14,
    borderRadius: 14,
    marginLeft: 8
  },
  logoutTxtModern: { color: "#FFF", fontSize: 16, fontWeight: "600", marginLeft: 6 },
  systemResetBtnModern: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#8B0000",
    paddingVertical: 14,
    borderRadius: 14,
    marginHorizontal: 24,
    marginBottom: 24
  },
  systemResetTxtModern: { color: "#FFF", fontSize: 16, fontWeight: "600", marginLeft: 6 },
  fieldTxt: { marginLeft: 14, fontSize: 16, color: "#333" },
  avatarAddBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    resizeMode: 'cover',
  },
  resetHeaderBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 10,
  },
  // Modal custom styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d9534f',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTextCenter: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 22,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelBtn: {
    backgroundColor: '#A0A8AB',
  },
  resetBtn: {
    backgroundColor: '#d9534f',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  uploadIndicator: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarAddBtnDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  deviceCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0c7a7e',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 14,
    color: '#666',
  },
  deviceDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  deviceDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#333',
  },
  noDevicesContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noDevicesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
    marginBottom: 8,
  },
  noDevicesSubtext: {
    fontSize: 14,
    color: '#BBB',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
