const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage du système de synchronisation des composants\n');

// Fonction pour exécuter une commande
function runCommand(command, args, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(`📋 ${description}...`);
    
    const child = spawn(command, args, {
      cwd: cwd,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} terminé avec succès\n`);
        resolve();
      } else {
        console.error(`❌ ${description} échoué avec le code ${code}\n`);
        reject(new Error(`Commande échouée avec le code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Erreur lors de ${description}:`, error.message);
      reject(error);
    });
  });
}

// Fonction principale
async function startComponentSync() {
  try {
    // 1. Créer la table DynamoDB
    await runCommand(
      'node',
      ['create-component-states-table.js'],
      __dirname,
      'Création de la table DynamoDB WaiHomeComponentStates'
    );
    
    // 2. Démarrer le serveur backend
    console.log('🔄 Démarrage du serveur backend...');
    const serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });
    
    // Attendre que le serveur démarre
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Tester la synchronisation
    await runCommand(
      'node',
      ['test-component-sync.js'],
      __dirname,
      'Test de synchronisation des composants'
    );
    
    console.log('🎉 Système de synchronisation prêt!');
    console.log('\n📱 Vous pouvez maintenant:');
    console.log('   • Changer l\'état des composants dans l\'app');
    console.log('   • Voir les états synchronisés dans DynamoDB');
    console.log('   • Tester la synchronisation entre appareils');
    console.log('\n🛑 Pour arrêter le serveur, appuyez sur Ctrl+C');
    
    // Garder le serveur en cours d'exécution
    serverProcess.on('close', (code) => {
      console.log(`\n🛑 Serveur arrêté avec le code ${code}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error.message);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du système...');
  process.exit(0);
});

// Démarrer le système
startComponentSync();
