const AWS = require('aws-sdk');
require('dotenv').config();

// Configuration AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'eu-north-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB();

async function createComponentStatesTable() {
  const params = {
    TableName: 'WaiHomeComponentStates',
    KeySchema: [
      {
        AttributeName: 'componentId',
        KeyType: 'HASH' // Partition key
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'componentId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'siteId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'userId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'componentType',
        AttributeType: 'S'
      },
      {
        AttributeName: 'timestamp',
        AttributeType: 'S'
      }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'siteId-componentType-index',
        KeySchema: [
          {
            AttributeName: 'siteId',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'componentType',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'siteId-timestamp-index',
        KeySchema: [
          {
            AttributeName: 'siteId',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'timestamp',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'userId-siteId-index',
        KeySchema: [
          {
            AttributeName: 'userId',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'siteId',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };

  try {
    console.log('🔄 Création de la table WaiHomeComponentStates...');
    
    const result = await dynamodb.createTable(params).promise();
    
    console.log('✅ Table WaiHomeComponentStates créée avec succès!');
    console.log('📋 Détails de la table:', JSON.stringify(result, null, 2));
    
    // Attendre que la table soit active
    console.log('⏳ Attente que la table soit active...');
    await waitForTableActive('WaiHomeComponentStates');
    
    console.log('🎉 Table WaiHomeComponentStates prête à être utilisée!');
    
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('ℹ️ La table WaiHomeComponentStates existe déjà');
    } else {
      console.error('❌ Erreur lors de la création de la table:', error);
    }
  }
}

async function waitForTableActive(tableName) {
  const params = {
    TableName: tableName
  };

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const result = await dynamodb.describeTable(params).promise();
        const status = result.Table.TableStatus;
        
        console.log(`📊 Statut de la table: ${status}`);
        
        if (status === 'ACTIVE') {
          resolve();
        } else if (status === 'CREATING') {
          setTimeout(checkStatus, 5000); // Vérifier toutes les 5 secondes
        } else {
          reject(new Error(`Statut de table inattendu: ${status}`));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    checkStatus();
  });
}

// Fonction pour supprimer la table (utile pour les tests)
async function deleteComponentStatesTable() {
  const params = {
    TableName: 'WaiHomeComponentStates'
  };

  try {
    console.log('🗑️ Suppression de la table WaiHomeComponentStates...');
    
    await dynamodb.deleteTable(params).promise();
    
    console.log('✅ Table WaiHomeComponentStates supprimée avec succès!');
    
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.log('ℹ️ La table WaiHomeComponentStates n\'existe pas');
    } else {
      console.error('❌ Erreur lors de la suppression de la table:', error);
    }
  }
}

// Exécuter le script
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'delete') {
    deleteComponentStatesTable();
  } else {
    createComponentStatesTable();
  }
}

module.exports = {
  createComponentStatesTable,
  deleteComponentStatesTable
};
