const { recordMetric, createSpan } = require('../config/datadog');
const logger = require('../utils/logger');

// Middleware to track request metrics
function datadogRequestTracking(req, res, next) {
  const startTime = Date.now();
  
  // Track request start
  recordMetric('http.request.started', 1, {
    method: req.method,
    path: req.path
  });
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Record request metrics
    recordMetric('http.request.duration', duration, {
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      status_category: `${Math.floor(res.statusCode / 100)}xx`
    });
    
    // Record status code distribution
    recordMetric('http.request.status', 1, {
      method: req.method,
      path: req.path,
      status_code: res.statusCode
    });
    
    // Log request completion
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
    
    originalEnd.apply(res, args);
  };
  
  next();
}

// Middleware to track database query performance
function datadogDatabaseTracking(queryName) {
  return function(req, res, next) {
    createSpan(`db.query.${queryName}`, next, {
      'db.type': 'postgresql',
      'db.operation': queryName
    });
  };
}

// Middleware to track cache performance
function datadogCacheTracking(operation) {
  return function(req, res, next) {
    createSpan(`cache.${operation}`, next, {
      'cache.type': 'redis',
      'cache.operation': operation
    });
  };
}

// Error tracking middleware
function datadogErrorTracking(err, req, res, next) {
  // Record error metrics
  recordMetric('error.occurred', 1, {
    error_type: err.constructor.name,
    path: req.path,
    method: req.method,
    status_code: err.statusCode || 500
  });
  
  // Log error with trace context
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });
  
  next(err);
}

module.exports = {
  datadogRequestTracking,
  datadogDatabaseTracking,
  datadogCacheTracking,
  datadogErrorTracking
};