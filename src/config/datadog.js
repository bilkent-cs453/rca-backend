const tracer = require('dd-trace');

// Initialize Datadog APM
function initializeDatadog() {
  // Only initialize if DD_API_KEY is present
  if (!process.env.DD_API_KEY) {
    console.log('Datadog APM not initialized - DD_API_KEY not found');
    return null;
  }

  tracer.init({
    // Service name for your application
    service: process.env.DD_SERVICE || 'ecommerce-backend',
    
    // Environment (development, staging, production)
    env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    
    // Version of your application
    version: process.env.DD_VERSION || '1.0.0',
    
    // Enable runtime metrics
    runtimeMetrics: true,
    
    // Enable log injection for correlating logs with traces
    logInjection: true,
    
    // Enable profiling
    profiling: process.env.DD_PROFILING_ENABLED === 'true',
    
    // Sample rate (1.0 = 100% of traces)
    sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
    
    // Tags to add to all spans
    tags: {
      team: 'backend',
      product: 'ecommerce',
      region: process.env.AWS_REGION || 'us-east-1'
    },
    
    // Database monitoring
    plugins: {
      pg: {
        service: `${process.env.DD_SERVICE || 'ecommerce-backend'}-postgres`
      },
      redis: {
        service: `${process.env.DD_SERVICE || 'ecommerce-backend'}-redis`
      },
      http: {
        validateStatus: code => code < 500 // Only 5xx are errors
      }
    }
  });

  console.log('Datadog APM initialized successfully');
  return tracer;
}

// Custom metrics helper
function recordMetric(name, value, tags = {}) {
  if (!tracer) return;
  
  const span = tracer.scope().active();
  if (span) {
    span.setTag(`metric.${name}`, value);
    Object.entries(tags).forEach(([key, val]) => {
      span.setTag(key, val);
    });
  }
}

// Error tracking helper
function trackError(error, additionalInfo = {}) {
  if (!tracer) return;
  
  const span = tracer.scope().active();
  if (span) {
    span.setTag('error', true);
    span.setTag('error.type', error.constructor.name);
    span.setTag('error.message', error.message);
    span.setTag('error.stack', error.stack);
    
    Object.entries(additionalInfo).forEach(([key, value]) => {
      span.setTag(`error.${key}`, value);
    });
  }
}

// Custom span creation
function createSpan(name, fn, tags = {}) {
  if (!tracer) return fn();
  
  return tracer.trace(name, { tags }, fn);
}

module.exports = {
  initializeDatadog,
  tracer,
  recordMetric,
  trackError,
  createSpan
};