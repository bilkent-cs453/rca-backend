#!/usr/bin/env node

const BACKEND_URL = 'https://rca-backend-ye7l.onrender.com';

console.log('🔬 Memory Leak Detection Test for Render Deployment');
console.log('=' .repeat(60));
console.log(`Target: ${BACKEND_URL}`);
console.log(`Started: ${new Date().toISOString()}`);
console.log('=' .repeat(60));

const memoryReadings = [];
let testPhase = 'baseline';

// Check memory via health endpoint
async function checkMemory() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    
    if (data.memory) {
      const reading = {
        timestamp: new Date().toISOString(),
        phase: testPhase,
        rss_mb: Math.round(data.memory.rss / 1024 / 1024),
        heap_mb: Math.round(data.memory.heapUsed / 1024 / 1024),
        external_mb: Math.round(data.memory.external / 1024 / 1024)
      };
      memoryReadings.push(reading);
      return reading;
    }
  } catch (error) {
    console.log(`  ⚠ Failed to get memory reading: ${error.message}`);
  }
  return null;
}

// Create multiple fetch requests that leak
async function createLeakyRequests() {
  const promises = [];
  
  for (let i = 0; i < 50; i++) {
    // Create requests that might cause memory accumulation
    promises.push(
      fetch(`${BACKEND_URL}/api/products`)
        .then(res => res.json())
        .catch(() => {})
    );
    
    // Also create some that fetch individual products
    promises.push(
      fetch(`${BACKEND_URL}/api/products/${(i % 8) + 1}`)
        .then(res => res.json())
        .catch(() => {})
    );
  }
  
  await Promise.all(promises);
}

// Create WebSocket connections
async function createWebSocketLoad() {
  const WebSocket = require('ws');
  const connections = [];
  
  console.log('\n📡 Creating WebSocket connections...');
  
  for (let i = 0; i < 30; i++) {
    try {
      const ws = new WebSocket('wss://rca-backend-ye7l.onrender.com');
      
      ws.on('open', () => {
        // Send data periodically
        const interval = setInterval(() => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'data',
              payload: Buffer.alloc(10240).toString('hex'), // 10KB messages
              timestamp: Date.now()
            }));
          } else {
            clearInterval(interval);
          }
        }, 500);
        
        ws.on('close', () => clearInterval(interval));
      });
      
      connections.push(ws);
    } catch (error) {
      // Continue even if some fail
    }
  }
  
  console.log(`  ✓ Created ${connections.length} WebSocket connections`);
  return connections;
}

// Main test sequence
async function runMemoryLeakTest() {
  try {
    // Phase 1: Baseline
    console.log('\n📊 Phase 1: Establishing Baseline');
    console.log('-'.repeat(40));
    testPhase = 'baseline';
    
    for (let i = 0; i < 3; i++) {
      const mem = await checkMemory();
      if (mem) {
        console.log(`  [${i+1}/3] RSS: ${mem.rss_mb}MB, Heap: ${mem.heap_mb}MB`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Phase 2: Light Load
    console.log('\n📊 Phase 2: Light Load');
    console.log('-'.repeat(40));
    testPhase = 'light_load';
    
    for (let i = 0; i < 5; i++) {
      console.log(`  Iteration ${i+1}/5...`);
      await createLeakyRequests();
      const mem = await checkMemory();
      if (mem) {
        console.log(`    Memory: RSS=${mem.rss_mb}MB, Heap=${mem.heap_mb}MB`);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Phase 3: Heavy Load with WebSockets
    console.log('\n📊 Phase 3: Heavy Load with WebSockets');
    console.log('-'.repeat(40));
    testPhase = 'heavy_load';
    
    const wsConnections = await createWebSocketLoad();
    
    for (let i = 0; i < 10; i++) {
      console.log(`  Iteration ${i+1}/10...`);
      await createLeakyRequests();
      await createLeakyRequests(); // Double load
      
      const mem = await checkMemory();
      if (mem) {
        console.log(`    Memory: RSS=${mem.rss_mb}MB, Heap=${mem.heap_mb}MB`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Phase 4: Sustained Load
    console.log('\n📊 Phase 4: Sustained Load (2 minutes)');
    console.log('-'.repeat(40));
    testPhase = 'sustained';
    
    const sustainedStart = Date.now();
    let iteration = 0;
    
    while (Date.now() - sustainedStart < 120000) { // 2 minutes
      iteration++;
      await createLeakyRequests();
      
      if (iteration % 5 === 0) {
        const mem = await checkMemory();
        if (mem) {
          const elapsed = Math.round((Date.now() - sustainedStart) / 1000);
          console.log(`  [${elapsed}s] Memory: RSS=${mem.rss_mb}MB, Heap=${mem.heap_mb}MB`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Phase 5: Cooldown
    console.log('\n📊 Phase 5: Cooldown & Monitoring');
    console.log('-'.repeat(40));
    testPhase = 'cooldown';
    
    // Close WebSocket connections
    console.log('  Closing WebSocket connections...');
    wsConnections.forEach(ws => ws.close());
    
    // Monitor memory recovery
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      const mem = await checkMemory();
      if (mem) {
        console.log(`  [${(i+1)*10}s] Memory: RSS=${mem.rss_mb}MB, Heap=${mem.heap_mb}MB`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
  
  // Generate report
  generateReport();
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📈 MEMORY LEAK ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  if (memoryReadings.length === 0) {
    console.log('❌ No memory readings collected');
    return;
  }
  
  // Group readings by phase
  const phases = {};
  memoryReadings.forEach(reading => {
    if (!phases[reading.phase]) {
      phases[reading.phase] = [];
    }
    phases[reading.phase].push(reading);
  });
  
  // Analyze each phase
  Object.keys(phases).forEach(phase => {
    const readings = phases[phase];
    if (readings.length === 0) return;
    
    const first = readings[0];
    const last = readings[readings.length - 1];
    
    console.log(`\n📊 ${phase.toUpperCase()} Phase:`);
    console.log(`  Readings: ${readings.length}`);
    console.log(`  Initial: RSS=${first.rss_mb}MB, Heap=${first.heap_mb}MB`);
    console.log(`  Final:   RSS=${last.rss_mb}MB, Heap=${last.heap_mb}MB`);
    console.log(`  Growth:  RSS=${last.rss_mb - first.rss_mb}MB, Heap=${last.heap_mb - first.heap_mb}MB`);
  });
  
  // Overall analysis
  const baseline = phases.baseline ? phases.baseline[0] : memoryReadings[0];
  const final = memoryReadings[memoryReadings.length - 1];
  
  console.log('\n🔍 OVERALL ANALYSIS:');
  console.log(`  Total Readings: ${memoryReadings.length}`);
  console.log(`  Baseline Memory: RSS=${baseline.rss_mb}MB, Heap=${baseline.heap_mb}MB`);
  console.log(`  Final Memory:    RSS=${final.rss_mb}MB, Heap=${final.heap_mb}MB`);
  console.log(`  Total Growth:    RSS=${final.rss_mb - baseline.rss_mb}MB, Heap=${final.heap_mb - baseline.heap_mb}MB`);
  
  // Memory leak detection
  const heapGrowth = final.heap_mb - baseline.heap_mb;
  const rssGrowth = final.rss_mb - baseline.rss_mb;
  
  console.log('\n⚠️  MEMORY LEAK DETECTION:');
  
  if (heapGrowth > 50) {
    console.log(`  🔴 SEVERE: Heap grew by ${heapGrowth}MB - Likely memory leak!`);
  } else if (heapGrowth > 20) {
    console.log(`  🟡 WARNING: Heap grew by ${heapGrowth}MB - Possible memory leak`);
  } else {
    console.log(`  🟢 OK: Heap growth of ${heapGrowth}MB is within normal range`);
  }
  
  if (rssGrowth > 100) {
    console.log(`  🔴 SEVERE: RSS grew by ${rssGrowth}MB - Memory not being released!`);
  } else if (rssGrowth > 50) {
    console.log(`  🟡 WARNING: RSS grew by ${rssGrowth}MB - Monitor for issues`);
  } else {
    console.log(`  🟢 OK: RSS growth of ${rssGrowth}MB is acceptable`);
  }
  
  // Check if memory recovered during cooldown
  if (phases.cooldown && phases.cooldown.length > 1) {
    const cooldownStart = phases.cooldown[0];
    const cooldownEnd = phases.cooldown[phases.cooldown.length - 1];
    const recovered = cooldownStart.heap_mb - cooldownEnd.heap_mb;
    
    console.log('\n🔄 MEMORY RECOVERY:');
    if (recovered > 0) {
      console.log(`  ✅ ${recovered}MB of heap memory was recovered during cooldown`);
    } else {
      console.log(`  ⚠️  No significant memory recovery during cooldown phase`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Memory leak test complete!');
  console.log('Check Sentry dashboard for any triggered alerts.');
  console.log('='.repeat(60));
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  generateReport();
  process.exit(0);
});

// Run the test
console.log('\n⏰ Starting memory leak detection test...\n');
runMemoryLeakTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});