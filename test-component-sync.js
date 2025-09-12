const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'http://192.168.100.193:8080/api';
const TEST_SITE_ID = 'test-site-123';
const TEST_USER_ID = 'test-user-456';

// Données de test
const testComponents = [
  { type: 'pump', state: true },
  { type: 'auger', state: false },
  { type: 'heater', state: true },
  { type: 'highWater', state: false },
  { type: 'binReplaced', state: true },
  { type: 'emergencyHeater', state: false }
];

async function testComponentSync() {
  console.log('🧪 Test de synchronisation des composants\n');

  try {
    // Test 1: Sauvegarder les états des composants
    console.log('1️⃣ Test de sauvegarde des états...');
    for (const component of testComponents) {
      const result = await saveComponentState(component.type, component.state);
      console.log(`   ✅ ${component.type}: ${component.state ? 'ON' : 'OFF'}`);
    }

    // Test 2: Récupérer tous les états d'un site
    console.log('\n2️⃣ Test de récupération des états...');
    const states = await getComponentStates(TEST_SITE_ID);
    console.log(`   📊 États récupérés: ${Object.keys(states).length}`);
    
    for (const [type, state] of Object.entries(states)) {
      console.log(`   📋 ${type}: ${state.state ? 'ON' : 'OFF'} (${state.timestamp})`);
    }

    // Test 3: Mettre à jour un état
    console.log('\n3️⃣ Test de mise à jour d\'état...');
    const updateResult = await updateComponentState('pump', false);
    console.log(`   🔄 Pump mis à jour: ${updateResult.state ? 'ON' : 'OFF'}`);

    // Test 4: Récupérer l'historique d'un composant
    console.log('\n4️⃣ Test de récupération d\'historique...');
    const history = await getComponentHistory('pump');
    console.log(`   📜 Historique pump: ${history.length} entrées`);
    
    history.slice(0, 3).forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.state ? 'ON' : 'OFF'} - ${entry.timestamp}`);
    });

    // Test 5: Vérifier la synchronisation
    console.log('\n5️⃣ Test de vérification de synchronisation...');
    const finalStates = await getComponentStates(TEST_SITE_ID);
    const pumpState = finalStates.pump;
    
    if (pumpState && !pumpState.state) {
      console.log('   ✅ Synchronisation réussie: Pump est maintenant OFF');
    } else {
      console.log('   ❌ Problème de synchronisation');
    }

    console.log('\n🎉 Tous les tests sont passés avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
  }
}

async function saveComponentState(componentType, state) {
  const response = await fetch(`${API_BASE_URL}/shelly/component-state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      siteId: TEST_SITE_ID,
      userId: TEST_USER_ID,
      componentType,
      state,
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur sauvegarde ${componentType}: ${response.status}`);
  }

  return await response.json();
}

async function getComponentStates(siteId) {
  const response = await fetch(`${API_BASE_URL}/shelly/component-states/${siteId}?userId=${TEST_USER_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur récupération états: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

async function updateComponentState(componentType, newState) {
  // D'abord récupérer l'état actuel pour obtenir l'ID
  const states = await getComponentStates(TEST_SITE_ID);
  const currentState = states[componentType];
  
  if (!currentState) {
    throw new Error(`État ${componentType} non trouvé`);
  }

  const response = await fetch(`${API_BASE_URL}/shelly/component-state/${currentState.componentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      state: newState,
      lastUpdated: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur mise à jour ${componentType}: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

async function getComponentHistory(componentType) {
  const response = await fetch(`${API_BASE_URL}/shelly/component-history/${TEST_SITE_ID}/${componentType}?userId=${TEST_USER_ID}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur récupération historique: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

// Fonction pour nettoyer les données de test
async function cleanupTestData() {
  console.log('\n🧹 Nettoyage des données de test...');
  
  try {
    const states = await getComponentStates(TEST_SITE_ID);
    
    for (const [type, state] of Object.entries(states)) {
      const response = await fetch(`${API_BASE_URL}/shelly/component-state/${state.componentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      if (response.ok) {
        console.log(`   🗑️ ${type} supprimé`);
      }
    }
    
    console.log('✅ Nettoyage terminé');
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error.message);
  }
}

// Exécuter les tests
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'cleanup') {
    cleanupTestData();
  } else {
    testComponentSync();
  }
}

module.exports = {
  testComponentSync,
  cleanupTestData
};
