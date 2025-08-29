#!/usr/bin/env node

const https = require('https');
const WebSocket = require('ws');
const axios = require('axios');

const RENDER_BACKEND_URL = 'https://rca-backend-ye7l.onrender.com';
const RENDER_WS_URL = 'wss://rca-backend-ye7l.onrender.com';

console.log('🚀 Starting Render Deployment Stress Test for Memory Leak Detection');
console.log('=' .repeat(70));
console.log(`Target: ${RENDER_BACKEND_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('=' .repeat(70));

const stats = {
  requests: 0,
  errors: 0,
  websocketConnections: 0,
  startTime: Date.now(),
  memorySnapshots: []
};

// Function to make HTTP requests
async function makeRequest(endpoint, method = 'GET', data = null) {
  try {
    const response = await axios({
      method,
      url: `${RENDER_BACKEND_URL}${endpoint}`,
      data,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    stats.requests++;
    return response.data;
  } catch (error) {
    stats.errors++;
    return null;
  }
}

// Function to check health and memory
async function checkHealth() {
  const health = await makeRequest('/health');
  if (health && health.memory) {
    const memoryMB = {
      rss: (health.memory.rss / 1024 / 1024).toFixed(2),
      heapTotal: (health.memory.heapTotal / 1024 / 1024).toFixed(2),
      heapUsed: (health.memory.heapUsed / 1024 / 1024).toFixed(2),
      external: (health.memory.external / 1024 / 1024).toFixed(2)
    };
    stats.memorySnapshots.push({
      timestamp: new Date().toISOString(),
      memory: memoryMB
    });
    return memoryMB;
  }
  return null;
}

// Test 1: WebSocket Connection Spam (Memory Leak Test)
async function testWebSocketLeak() {
  console.log('\n📊 Test 1: WebSocket Memory Leak Test');
  console.log('-'.repeat(40));
  
  const connections = [];
  const targetConnections = 100;
  
  console.log(`Creating ${targetConnections} WebSocket connections...`);
  
  for (let i = 0; i < targetConnections; i++) {
    try {
      const ws = new WebSocket(RENDER_WS_URL);
      
      ws.on('open', () => {
        stats.websocketConnections++;
        ws.send(JSON.stringify({ type: 'subscribe', room: `room-${i}` }));
        
        // Send messages periodically
        setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'message',
              data: Buffer.alloc(1024).toString('hex') // 1KB message
            }));
          }
        }, 100);
      });
      
      ws.on('error', () => {});
      connections.push(ws);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ ${i + 1} connections established`);
        const memory = await checkHealth();
        if (memory) {
          console.log(`    Memory: RSS=${memory.rss}MB, Heap=${memory.heapUsed}MB`);
        }
      }
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.log(`  ⚠ Connection ${i} failed: ${error.message}`);
    }
  }
  
  console.log(`✅ Created ${stats.websocketConnections} WebSocket connections`);
  return connections;
}

// Test 2: High-frequency API calls
async function testAPILoad() {
  console.log('\n📊 Test 2: High-frequency API Load Test');
  console.log('-'.repeat(40));
  
  const endpoints = [
    '/api/products',
    '/api/products/1',
    '/api/products/2',
    '/api/products/3',
    '/health'
  ];
  
  const concurrentRequests = 50;
  const iterations = 20;
  
  console.log(`Sending ${concurrentRequests * iterations} requests...`);
  
  for (let i = 0; i < iterations; i++) {
    const promises = [];
    
    for (let j = 0; j < concurrentRequests; j++) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      promises.push(makeRequest(endpoint));
    }
    
    await Promise.all(promises);
    
    console.log(`  ✓ Iteration ${i + 1}/${iterations} complete (${stats.requests} total requests)`);
    
    if ((i + 1) % 5 === 0) {
      const memory = await checkHealth();
      if (memory) {
        console.log(`    Memory: RSS=${memory.rss}MB, Heap=${memory.heapUsed}MB`);
      }
    }
  }
  
  console.log(`✅ Completed ${stats.requests} API requests`);
}

// Test 3: Large payload requests
async function testLargePayloads() {
  console.log('\n📊 Test 3: Large Payload Test');
  console.log('-'.repeat(40));
  
  const payloadSizes = [10, 50, 100, 500]; // KB
  
  for (const size of payloadSizes) {
    const largeData = {
      data: Buffer.alloc(size * 1024).toString('base64'),
      size: `${size}KB`,
      timestamp: Date.now()
    };
    
    console.log(`  Sending ${size}KB payload...`);
    
    // Try to create a product with large data
    await makeRequest('/api/products', 'POST', {
      name: `Test Product ${Date.now()}`,
      description: largeData.data,
      price: 99.99,
      stock: 100
    });
    
    const memory = await checkHealth();
    if (memory) {
      console.log(`    Memory after ${size}KB: RSS=${memory.rss}MB, Heap=${memory.heapUsed}MB`);
    }
  }
  
  console.log('✅ Large payload test complete');
}

// Test 4: Connection pool exhaustion
async function testConnectionExhaustion() {
  console.log('\n📊 Test 4: Connection Pool Exhaustion Test');
  console.log('-'.repeat(40));
  
  const connections = [];
  console.log('Creating persistent connections...');
  
  // Create many connections that stay open
  for (let i = 0; i < 200; i++) {
    const promise = axios.get(`${RENDER_BACKEND_URL}/health`, {
      timeout: 60000, // Long timeout
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true })
    }).catch(() => {});
    
    connections.push(promise);
    
    if ((i + 1) % 50 === 0) {
      console.log(`  ✓ ${i + 1} persistent connections created`);
    }
  }
  
  console.log('✅ Connection exhaustion test initiated');
  
  // Don't wait for all to complete
  setTimeout(async () => {
    const memory = await checkHealth();
    if (memory) {
      console.log(`    Final memory: RSS=${memory.rss}MB, Heap=${memory.heapUsed}MB`);
    }
  }, 5000);
}

// Monitor memory growth
async function monitorMemory(duration = 60000) {
  console.log('\n📊 Monitoring Memory Growth');
  console.log('-'.repeat(40));
  
  const interval = 5000; // Check every 5 seconds
  const iterations = duration / interval;
  
  for (let i = 0; i < iterations; i++) {
    const memory = await checkHealth();
    if (memory) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
      console.log(`  [${elapsed}s] RSS=${memory.rss}MB, Heap=${memory.heapUsed}MB`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// Generate report
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📈 STRESS TEST REPORT');
  console.log('='.repeat(70));
  
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  
  console.log(`\n📊 Statistics:`);
  console.log(`  • Test Duration: ${duration} seconds`);
  console.log(`  • Total Requests: ${stats.requests}`);
  console.log(`  • Failed Requests: ${stats.errors}`);
  console.log(`  • WebSocket Connections: ${stats.websocketConnections}`);
  console.log(`  • Success Rate: ${((stats.requests - stats.errors) / stats.requests * 100).toFixed(2)}%`);
  
  if (stats.memorySnapshots.length > 0) {
    console.log(`\n💾 Memory Analysis:`);
    const firstSnapshot = stats.memorySnapshots[0];
    const lastSnapshot = stats.memorySnapshots[stats.memorySnapshots.length - 1];
    
    console.log(`  Initial Memory:`);
    console.log(`    • RSS: ${firstSnapshot.memory.rss}MB`);
    console.log(`    • Heap: ${firstSnapshot.memory.heapUsed}MB`);
    
    console.log(`  Final Memory:`);
    console.log(`    • RSS: ${lastSnapshot.memory.rss}MB`);
    console.log(`    • Heap: ${lastSnapshot.memory.heapUsed}MB`);
    
    const rssDiff = (parseFloat(lastSnapshot.memory.rss) - parseFloat(firstSnapshot.memory.rss)).toFixed(2);
    const heapDiff = (parseFloat(lastSnapshot.memory.heapUsed) - parseFloat(firstSnapshot.memory.heapUsed)).toFixed(2);
    
    console.log(`  Memory Growth:`);
    console.log(`    • RSS Growth: ${rssDiff}MB`);
    console.log(`    • Heap Growth: ${heapDiff}MB`);
    
    if (parseFloat(heapDiff) > 100) {
      console.log(`\n⚠️  WARNING: Significant memory growth detected!`);
      console.log(`    Possible memory leak - heap grew by ${heapDiff}MB`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Stress test complete!');
  console.log('Check Sentry dashboard for any triggered alerts and errors.');
  console.log('='.repeat(70));
}

// Main execution
async function runStressTest() {
  try {
    // Wake up the service first
    console.log('\n⏰ Waking up Render service (may take 30-60s if sleeping)...');
    const initialHealth = await checkHealth();
    if (initialHealth) {
      console.log('✅ Service is awake and responding');
      console.log(`  Initial memory: RSS=${initialHealth.rss}MB, Heap=${initialHealth.heapUsed}MB`);
    }
    
    // Run tests sequentially
    const wsConnections = await testWebSocketLeak();
    await testAPILoad();
    await testLargePayloads();
    await testConnectionExhaustion();
    
    // Monitor for a bit
    await monitorMemory(30000);
    
    // Clean up WebSocket connections
    console.log('\n🧹 Cleaning up connections...');
    wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    // Final memory check
    await new Promise(resolve => setTimeout(resolve, 5000));
    await checkHealth();
    
    // Generate report
    generateReport();
    
  } catch (error) {
    console.error('\n❌ Stress test failed:', error.message);
  }
  
  process.exit(0);
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  generateReport();
  process.exit(0);
});

// Start the test
runStressTest();