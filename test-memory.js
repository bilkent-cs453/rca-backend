// Simple script to allocate memory and test monitoring
const allocations = [];

console.log('Starting memory allocation test...');
console.log('Initial memory:', process.memoryUsage());

// Allocate memory in chunks
setInterval(() => {
  // Allocate 50MB
  const size = 50 * 1024 * 1024;
  const buffer = Buffer.alloc(size);
  allocations.push(buffer);
  
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  console.log(`Allocated ${allocations.length * 50}MB, Heap used: ${heapUsedMB.toFixed(2)}MB`);
  
  if (heapUsedMB > 1200) {
    console.log('Memory threshold reached!');
    process.exit(0);
  }
}, 2000);