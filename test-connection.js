// Test de connexion pour WaiHome
import api from './services/api.js';

async function testWaiHomeConnection() {
  console.log('🧪 Testing WaiHome connection to backend...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing Health Check...');
    const health = await api.health.check();
    console.log('✅ Health check successful!');
    console.log(`   Status: ${health.status}`);
    console.log(`   Users: ${health.users}`);
    console.log(`   Sites: ${health.sites}\n`);

    // Test 2: Créer un utilisateur
    console.log('2️⃣ Testing User Registration...');
    const userData = {
      email: 'waihome-test@example.com',
      password: 'test123',
      name: 'WaiHome Test User',
      role: 'user'
    };
    
    const registerResult = await api.auth.register(userData);
    console.log('✅ User registration successful!');
    console.log(`   User ID: ${registerResult.user.userId}\n`);

    // Test 3: Se connecter
    console.log('3️⃣ Testing User Login...');
    const loginResult = await api.auth.login({
      email: 'waihome-test@example.com',
      password: 'test123'
    });
    
    const token = loginResult.token;
    console.log('✅ Login successful!\n');

    // Test 4: Obtenir le profil
    console.log('4️⃣ Testing Get Profile...');
    const profile = await api.user.getProfile(token);
    console.log('✅ Profile retrieved successfully!');
    console.log(`   Name: ${profile.user.name}\n`);

    // Test 5: Créer un site
    console.log('5️⃣ Testing Site Creation...');
    const siteData = {
      siteName: 'WaiHome Test Site',
      siteType: 'residential',
      location: 'Test Address'
    };
    
    const siteResult = await api.user.createSite(token, siteData);
    console.log('✅ Site created successfully!');
    console.log(`   Site ID: ${siteResult.site.siteId}\n`);

    // Test 6: Obtenir les sites
    console.log('6️⃣ Testing Get Sites...');
    const sites = await api.user.getSites(token);
    console.log('✅ Sites retrieved successfully!');
    console.log(`   Number of sites: ${sites.sites.length}\n`);

    console.log('🎉 WaiHome connection test completed successfully!');
    console.log('✅ WaiHome is properly connected to the backend!');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running');
    console.log('2. Check if the API URL is correct');
    console.log('3. Verify network connectivity');
  }
}

// Exécuter le test
testWaiHomeConnection(); 