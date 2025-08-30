// IMPORTANT: Import instrumentation at the very top
require('./instrument'); // Sentry instrumentation
require('./datadog-instrument'); // Datadog instrumentation

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('ws');
const http = require('http');
const Sentry = require("@sentry/node");
require('dotenv').config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const { initializeWebSocket } = require('./services/websocket');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimit');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
// Temporarily disabled for testing
// app.use(rateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Test error endpoint
app.get('/test-error', (req, res, next) => {
  const error = new Error('Test error for Sentry');
  error.status = 500;
  next(error);
});

// Error handling  
// Setup Sentry error handler - must be after all controllers and before any other error middleware
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// Initialize WebSocket server
const wss = new Server({ server });
initializeWebSocket(wss);

// Start server
async function startServer() {
  try {
    // Connect to databases
    await connectDatabase();
    // Temporarily disabled Redis connection
    // await connectRedis();
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start monitoring performance issues
      const { monitorPerformanceIssues } = require('./config/sentry');
      monitorPerformanceIssues();
      
      // Log Sentry status
      if (process.env.SENTRY_DSN) {
        console.log('Sentry error tracking enabled');
      } else {
        console.log('Sentry DSN not configured - using demo mode');
      }
      
      // Log Datadog status
      if (process.env.DD_API_KEY) {
        logger.info('Datadog APM and monitoring enabled', {
          service: process.env.DD_SERVICE || 'ecommerce-backend',
          env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
          version: process.env.DD_VERSION || '1.0.0'
        });
      } else {
        console.log('Datadog APM not configured - DD_API_KEY not found');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;