const tracer = require('dd-trace');

// Simple Datadog APM initialization for trace correlation with logs
function initializeDatadog() {
  if (!process.env.DD_API_KEY) {
    console.log('Datadog APM not initialized - DD_API_KEY not found');
    return null;
  }

  tracer.init({
    service: process.env.DD_SERVICE || 'ecommerce-backend',
    env: process.env.DD_ENV || 'production',
    version: process.env.DD_VERSION || '1.0.0',
    logInjection: true, // This is the key feature for log correlation
    runtimeMetrics: true
  });

  console.log('Datadog APM initialized for log correlation');
  return tracer;
}

module.exports = {
  initializeDatadog,
  tracer
};