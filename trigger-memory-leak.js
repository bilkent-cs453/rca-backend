#!/usr/bin/env node

const WebSocket = require('ws');

const BACKEND_URL = 'https://rca-backend-ye7l.onrender.com';
const WS_URL = 'wss://rca-backend-ye7l.onrender.com';

console.log('🚨 TRIGGERING MEMORY LEAK FOR SENTRY ALERT');
console.log('=' .repeat(60));
console.log(`Target: ${BACKEND_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('=' .repeat(60));

let leakedData = [];
let wsConnections = [];
let intervalHandles = [];

// Check current memory
async function checkMemory() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    if (data.memory) {
      const mb = {
        rss: Math.round(data.memory.rss / 1024 / 1024),
        heap: Math.round(data.memory.heapUsed / 1024 / 1024),
        external: Math.round(data.memory.external / 1024 / 1024)
      };
      console.log(`📊 Memory: RSS=${mb.rss}MB, Heap=${mb.heap}MB, External=${mb.external}MB`);
      return mb;
    }
  } catch (error) {
    console.log(`⚠️  Failed to check memory: ${error.message}`);
  }
  return null;
}

// Create WebSocket connections that leak memory
async function createLeakyWebSockets() {
  console.log('\n🔌 Creating WebSocket connections that will leak memory...');
  
  for (let i = 0; i < 50; i++) {
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        console.log(`  ✓ WebSocket ${i + 1}/50 connected`);
        
        // Send large messages continuously
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Send 100KB message each time
            const largeData = Buffer.alloc(100 * 1024).toString('base64');
            ws.send(JSON.stringify({
              type: 'broadcast',
              room: `leak-room-${i}`,
              data: largeData,
              timestamp: Date.now()
            }));
          }
        }, 100); // Send every 100ms
        
        intervalHandles.push(interval);
      });
      
      ws.on('message', (data) => {
        // Store all received messages (intentional leak)
        leakedData.push(data.toString());
      });
      
      ws.on('error', () => {});
      
      wsConnections.push(ws);
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ⚠️  WebSocket ${i + 1} failed: ${error.message}`);
    }
  }
  
  console.log(`✅ Created ${wsConnections.length} leaky WebSocket connections`);
}

// Make rapid API calls that accumulate data
async function bombardAPICalls() {
  console.log('\n🎯 Bombarding API with requests...');
  
  const endpoints = [
    '/api/products',
    '/api/products/1',
    '/api/products/2',
    '/api/products/3',
    '/api/products/4',
    '/api/products/5',
    '/api/products/6',
    '/api/products/7',
    '/api/products/8'
  ];
  
  let requestCount = 0;
  
  // Create multiple concurrent request loops
  for (let loop = 0; loop < 10; loop++) {
    setInterval(async () => {
      const promises = [];
      
      // Make 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        promises.push(
          fetch(`${BACKEND_URL}${endpoint}`)
            .then(res => res.json())
            .then(data => {
              // Intentionally store all response data (leak)
              leakedData.push(JSON.stringify(data));
              requestCount++;
              
              if (requestCount % 100 === 0) {
                console.log(`  📈 ${requestCount} requests completed, leaked data: ${(JSON.stringify(leakedData).length / 1024 / 1024).toFixed(2)}MB`);
              }
            })
            .catch(() => {})
        );
      }
      
      await Promise.all(promises);
    }, 500); // Every 500ms
  }
  
  console.log('✅ API bombardment started (10 loops, 20 req/sec each)');
}

// Create large objects that won't be garbage collected
function createMemoryLeaks() {
  console.log('\n💾 Creating intentional memory leaks...');
  
  // Leak 1: Circular references
  setInterval(() => {
    const obj1 = { data: Buffer.alloc(1024 * 1024) }; // 1MB
    const obj2 = { data: Buffer.alloc(1024 * 1024) }; // 1MB
    obj1.ref = obj2;
    obj2.ref = obj1;
    leakedData.push(obj1);
  }, 1000);
  
  // Leak 2: Growing array
  setInterval(() => {
    for (let i = 0; i < 100; i++) {
      leakedData.push(Buffer.alloc(10240).toString('hex')); // 10KB each
    }
  }, 500);
  
  // Leak 3: Event emitter leak
  const EventEmitter = require('events');
  const emitter = new EventEmitter();
  setInterval(() => {
    emitter.on('data', () => {
      const data = Buffer.alloc(102400); // 100KB
      leakedData.push(data);
    });
    emitter.emit('data');
  }, 200);
  
  console.log('✅ Memory leak generators started');
}

// Main execution
async function triggerMemoryLeak() {
  console.log('\n🚀 Starting memory leak trigger sequence...\n');
  
  // Check initial memory
  console.log('📊 Initial memory state:');
  await checkMemory();
  
  // Start all leak generators
  await createLeakyWebSockets();
  await bombardAPICalls();
  createMemoryLeaks();
  
  // Monitor memory growth
  console.log('\n📈 Monitoring memory growth (this will trigger Sentry alerts)...\n');
  
  let checkCount = 0;
  const monitorInterval = setInterval(async () => {
    checkCount++;
    console.log(`\n--- Check #${checkCount} (${new Date().toISOString()}) ---`);
    
    const memory = await checkMemory();
    console.log(`  Leaked data size: ${(JSON.stringify(leakedData).length / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Active WebSockets: ${wsConnections.filter(ws => ws.readyState === WebSocket.OPEN).length}`);
    
    if (memory && memory.heap > 500) {
      console.log('\n🎯 ALERT THRESHOLD REACHED! Sentry should be triggered!');
      console.log('   Heap memory exceeded 500MB');
    }
    
    if (memory && memory.rss > 1000) {
      console.log('\n🚨 CRITICAL! RSS memory exceeded 1GB!');
      console.log('   This should definitely trigger Sentry alerts!');
    }
    
    // Stop after 5 minutes or if memory is too high
    if (checkCount >= 30 || (memory && memory.rss > 1500)) {
      console.log('\n🛑 Stopping leak generation...');
      clearInterval(monitorInterval);
      cleanup();
    }
  }, 10000); // Check every 10 seconds
}

// Cleanup function
function cleanup() {
  console.log('\n🧹 Cleaning up (optional - you can let it run)...');
  
  // Clear intervals
  intervalHandles.forEach(handle => clearInterval(handle));
  
  // Close WebSockets
  wsConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Memory leak trigger complete!');
  console.log('🔔 Check Sentry dashboard for memory alerts!');
  console.log('   https://bilkent-cs453.sentry.io/');
  console.log('='.repeat(60));
  
  // Don't exit - let the process continue leaking if needed
  console.log('\n⚠️  Process will continue running to maintain the leak...');
  console.log('   Press Ctrl+C to stop');
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user');
  process.exit(0);
});

// Start the leak trigger
triggerMemoryLeak().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});