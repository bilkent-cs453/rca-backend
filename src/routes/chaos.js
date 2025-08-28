const express = require('express');
const WebSocket = require('ws');
const { getClient } = require('../config/redis');
const router = express.Router();

// Store active chaos scenarios
const activeChaos = new Map();

// Middleware to log chaos events
function logChaosEvent(type, details) {
  console.log(`🔥 CHAOS: ${type} - ${details}`);
  // In production, this would also log to monitoring system
}

// 1. Memory Leak Trigger - WebSocket connections that don't close
router.post('/trigger-memory-leak', async (req, res) => {
  try {
    const { duration = 30000, connections = 20 } = req.body;
    
    logChaosEvent('MEMORY_LEAK', `Starting ${connections} WebSocket connections for ${duration}ms`);
    
    const chaosId = Date.now().toString();
    const wsConnections = [];
    
    // Create multiple WebSocket connections that accumulate data
    for (let i = 0; i < connections; i++) {
      try {
        // Create internal connection (simplified for demo)
        const mockWs = {
          id: i,
          data: Buffer.alloc(1024 * 1024), // 1MB per connection
          heartbeat: setInterval(() => {
            // Simulate data accumulation
            mockWs.data = Buffer.concat([mockWs.data, Buffer.alloc(100 * 1024)]);
          }, 1000)
        };
        wsConnections.push(mockWs);
      } catch (error) {
        console.log(`WebSocket ${i} creation failed:`, error.message);
      }
    }
    
    activeChaos.set(chaosId, {
      type: 'memory_leak',
      connections: wsConnections,
      startTime: new Date()
    });
    
    // Auto-cleanup after duration
    setTimeout(() => {
      const chaos = activeChaos.get(chaosId);
      if (chaos) {
        chaos.connections.forEach(ws => {
          if (ws.heartbeat) clearInterval(ws.heartbeat);
        });
        activeChaos.delete(chaosId);
        logChaosEvent('MEMORY_LEAK', `Cleaned up chaos scenario ${chaosId}`);
      }
    }, duration);
    
    res.json({
      success: true,
      chaosId,
      message: `Memory leak triggered with ${connections} connections for ${duration}ms`,
      memoryBefore: process.memoryUsage()
    });
    
  } catch (error) {
    logChaosEvent('MEMORY_LEAK', `Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 2. N+1 Query Problem Trigger
router.post('/trigger-n1-queries', async (req, res) => {
  try {
    const { productCount = 50 } = req.body;
    
    logChaosEvent('N1_QUERIES', `Triggering N+1 queries for ${productCount} products`);
    
    const { sequelize } = require('../config/database');
    const { Product } = require('../models');
    
    // Simulate N+1 problem by fetching products individually
    const results = [];
    const startTime = Date.now();
    
    for (let i = 1; i <= productCount; i++) {
      try {
        // This creates individual queries instead of JOIN
        const product = await Product.findByPk(i);
        if (product) {
          // Fetch related data separately (N+1 problem)
          const reviews = await sequelize.query(
            'SELECT * FROM reviews WHERE product_id = ?',
            { replacements: [i] }
          );
          results.push({ product, reviewCount: reviews[0].length });
        }
      } catch (error) {
        // Continue even if individual product fails
      }
    }
    
    const duration = Date.now() - startTime;
    logChaosEvent('N1_QUERIES', `Completed ${results.length} queries in ${duration}ms`);
    
    res.json({
      success: true,
      message: `N+1 queries executed for ${results.length} products`,
      executionTime: duration,
      queriesExecuted: productCount * 2 // Product + Reviews for each
    });
    
  } catch (error) {
    logChaosEvent('N1_QUERIES', `Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 3. Database Connection Pool Exhaustion
router.post('/trigger-db-connections', async (req, res) => {
  try {
    const { connectionCount = 15 } = req.body;
    
    logChaosEvent('DB_CONNECTIONS', `Exhausting connection pool with ${connectionCount} connections`);
    
    const { pool } = require('../config/database');
    const connections = [];
    
    // Hold connections without releasing them
    for (let i = 0; i < connectionCount; i++) {
      try {
        const client = await pool.connect();
        connections.push(client);
        
        // Start a long-running query
        client.query('SELECT pg_sleep(30)'); // 30 second sleep
        
        logChaosEvent('DB_CONNECTIONS', `Connection ${i + 1} acquired`);
      } catch (error) {
        logChaosEvent('DB_CONNECTIONS', `Connection ${i + 1} failed: ${error.message}`);
        break;
      }
    }
    
    // Release connections after delay
    setTimeout(() => {
      connections.forEach((client, index) => {
        try {
          client.release();
          logChaosEvent('DB_CONNECTIONS', `Released connection ${index + 1}`);
        } catch (error) {
          logChaosEvent('DB_CONNECTIONS', `Error releasing connection ${index + 1}: ${error.message}`);
        }
      });
    }, 20000);
    
    res.json({
      success: true,
      message: `${connections.length} database connections acquired`,
      connectionsHeld: connections.length,
      poolStatus: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
  } catch (error) {
    logChaosEvent('DB_CONNECTIONS', `Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 4. Frontend Memory Bloat Trigger (Redux Store)
router.post('/trigger-frontend-bloat', async (req, res) => {
  try {
    const { dataSize = 1000 } = req.body;
    
    logChaosEvent('FRONTEND_BLOAT', `Generating ${dataSize} items for frontend`);
    
    // Generate large payload for frontend to consume
    const bloatedData = [];
    for (let i = 0; i < dataSize; i++) {
      bloatedData.push({
        id: i,
        name: `Bloat Item ${i}`,
        description: 'x'.repeat(1000), // 1KB description
        metadata: {
          timestamp: new Date(),
          randomData: Math.random().toString(36).repeat(100),
          nestedArray: new Array(100).fill(`nested-${i}`)
        }
      });
    }
    
    res.json({
      success: true,
      message: `Generated ${dataSize} bloated items for frontend`,
      payload: bloatedData,
      payloadSize: JSON.stringify(bloatedData).length
    });
    
  } catch (error) {
    logChaosEvent('FRONTEND_BLOAT', `Failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get active chaos scenarios
router.get('/status', (req, res) => {
  const scenarios = Array.from(activeChaos.entries()).map(([id, data]) => ({
    id,
    type: data.type,
    startTime: data.startTime,
    duration: Date.now() - data.startTime.getTime()
  }));
  
  res.json({
    activeScenarios: scenarios.length,
    scenarios,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// 6. Stop all chaos scenarios
router.post('/stop-all', (req, res) => {
  logChaosEvent('STOP_ALL', `Stopping ${activeChaos.size} active scenarios`);
  
  activeChaos.forEach((chaos, id) => {
    if (chaos.connections) {
      chaos.connections.forEach(ws => {
        if (ws.heartbeat) clearInterval(ws.heartbeat);
      });
    }
    activeChaos.delete(id);
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  res.json({
    success: true,
    message: 'All chaos scenarios stopped',
    memoryUsage: process.memoryUsage()
  });
});

module.exports = router;