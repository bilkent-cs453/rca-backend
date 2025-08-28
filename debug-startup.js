// Simple debug script to test database connectivity
require('dotenv').config();

console.log('Environment variables check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');

const { Sequelize } = require('sequelize');

async function testDatabaseConnection() {
  try {
    console.log('\nTesting database connection...');
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: console.log
    });
    
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testDatabaseConnection();