require('dotenv').config();
const AWS = require('aws-sdk');

// Configuration AWS - Utiliser vos vraies credentials
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB();

// Tables à créer
const tables = [
  {
    TableName: 'waihome-users',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
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
  },
  {
    TableName: 'waihome-sites',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'siteId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'siteId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  },
  {
    TableName: 'waihome-shelly-data',
    KeySchema: [
      { AttributeName: 'siteId', KeyType: 'HASH' },
      { AttributeName: 'dataId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'siteId', AttributeType: 'S' },
      { AttributeName: 'dataId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  },
  {
    TableName: 'waihome-admin-logs',
    KeySchema: [
      { AttributeName: 'logId', KeyType: 'HASH' },
      { AttributeName: 'timestamp', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'logId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  },
  {
    TableName: 'WaiHomeShellyDevices',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' }
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
  }
];

async function createTables() {
  for (const table of tables) {
    try {
      console.log(`Creating table: ${table.TableName}`);
      await dynamodb.createTable(table).promise();
      console.log(`✅ Table ${table.TableName} created successfully`);
    } catch (error) {
      if (error.code === 'ResourceInUseException') {
        console.log(`⚠️  Table ${table.TableName} already exists`);
      } else {
        console.error(`❌ Error creating table ${table.TableName}:`, error);
      }
    }
  }
}

createTables().then(() => {
  console.log('🎉 All tables created successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error creating tables:', error);
  process.exit(1);
}); 