#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');

console.log('Triggering embedded issues for Sentry monitoring...\n');

// 1. Trigger WebSocket memory leak
console.log('1. Creating multiple WebSocket connections to trigger memory leak...');
const connections = [];
for (let i = 0; i < 20; i++) {
  try {
    const ws = new WebSocket('ws://localhost:3002');
    ws.on('open', () => {
      console.log(`   - WebSocket connection ${i + 1} opened`);
      ws.send(JSON.stringify({ type: 'subscribe', room: 'products' }));
    });
    ws.on('error', () => {}); // Ignore connection errors
    connections.push(ws);
  } catch (error) {
    // Ignore connection errors
  }
}

// 2. Trigger N+1 query (try to access product endpoint)
console.log('\n2. Attempting to trigger N+1 query issue...');
setTimeout(() => {
  http.get('http://localhost:3002/api/products/1', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`   - Product endpoint response: ${data.substring(0, 100)}...`);
    });
  }).on('error', (err) => {
    console.log(`   - Product endpoint error (expected without DB): ${err.message}`);
  });
}, 1000);

// 3. Generate high memory usage to trigger memory alert
console.log('\n3. Allocating memory to trigger high memory usage alert...');
const memoryHogs = [];
let totalAllocated = 0;

const allocateMemory = setInterval(() => {
  try {
    // Allocate 100MB at a time
    const size = 100 * 1024 * 1024;
    const buffer = Buffer.alloc(size);
    memoryHogs.push(buffer);
    totalAllocated += 100;
    
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    console.log(`   - Allocated ${totalAllocated}MB, Heap used: ${heapUsedMB.toFixed(2)}MB`);
    
    if (heapUsedMB > 1100) {
      console.log('\n✅ Memory threshold exceeded! Alert should be triggered.');
      clearInterval(allocateMemory);
      
      // Clean up and exit after a delay
      setTimeout(() => {
        console.log('\n4. Cleaning up connections...');
        connections.forEach(ws => ws.close());
        console.log('\n✅ Test complete! Check your Sentry dashboard for alerts.');
        process.exit(0);
      }, 5000);
    }
  } catch (error) {
    console.log(`   - Memory allocation error: ${error.message}`);
    clearInterval(allocateMemory);
  }
}, 2000);

// Safety timeout
setTimeout(() => {
  console.log('\nTest timeout reached. Cleaning up...');
  connections.forEach(ws => ws.close());
  clearInterval(allocateMemory);
  process.exit(0);
}, 60000);