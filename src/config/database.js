const { Sequelize } = require('sequelize');
const { Pool } = require('pg');

// Parse DATABASE_URL if provided (Render format)
let poolConfig;
let sequelizeConfig;

if (process.env.DATABASE_URL) {
  // Parse Render's DATABASE_URL
  const connectionString = process.env.DATABASE_URL;
  poolConfig = {
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Render
    },
    max: 20, // maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  sequelizeConfig = {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  };
} else {
  // Use individual settings
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ecommerce',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  sequelizeConfig = {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  };
}

// PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Sequelize instance for ORM
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, sequelizeConfig)
  : new Sequelize(
      process.env.DB_NAME || 'ecommerce',
      process.env.DB_USER || 'postgres', 
      process.env.DB_PASSWORD || 'postgres',
      sequelizeConfig
    );

// Database connection function
async function connectDatabase() {
  try {
    if (!process.env.DATABASE_URL && process.env.DB_HOST === 'dpg-xxxxx.render.com') {
      console.log('⚠️  Please update DATABASE_URL in .env with your Render PostgreSQL URL');
      console.log('   You can find it in your Render dashboard under your database settings');
      console.log('   Format: postgresql://user:password@host/database');
      return false;
    }
    
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized');
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    console.log('   Running in demo mode without database');
    return false;
  }
}

// Transaction helper - potential issue: missing cleanup in error paths
async function executeTransaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  // Note: client.release() missing in some error scenarios
}

// Query helper with connection from pool
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 1000) {
    console.warn(`Slow query detected (${duration}ms):`, text);
  }
  
  return res;
}

// Get connection from pool
async function getConnection() {
  return await pool.connect();
}

module.exports = {
  sequelize,
  pool,
  connectDatabase,
  executeTransaction,
  query,
  getConnection
};