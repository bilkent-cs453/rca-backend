const Sentry = require("@sentry/node");

// Helper to capture custom errors
function captureCustomError(error, context = {}) {
  Sentry.captureException(error, {
    tags: context.tags || {},
    extra: context.extra || {},
    level: context.level || 'error'
  });
}

// Helper to add breadcrumbs
function addBreadcrumb(message, category = 'custom', level = 'info', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000
  });
}

// Helper to measure performance
function startTransaction(name, op = 'custom') {
  return Sentry.startTransaction({
    op,
    name,
  });
}

// Monitor specific issues we embedded
function monitorPerformanceIssues() {
  // Monitor WebSocket connections
  setInterval(() => {
    try {
      const { wsManager } = require('../services/websocket');
      if (wsManager && wsManager.clients) {
        const clientCount = wsManager.clients.size;
        
        if (clientCount > 500) {
          Sentry.captureMessage('High WebSocket connection count', {
            level: 'warning',
            tags: {
              issue_type: 'websocket_leak'
            },
            extra: {
              connection_count: clientCount,
              threshold: 500
            }
          });
        }
      }
    } catch (error) {
      // WebSocket manager not yet initialized
    }
  }, 60000); // Check every minute
  
  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 1000) {
      Sentry.captureMessage('High memory usage detected', {
        level: 'warning',
        tags: {
          issue_type: 'memory_leak'
        },
        extra: {
          heap_used_mb: heapUsedMB,
          heap_total_mb: memUsage.heapTotal / 1024 / 1024,
          rss_mb: memUsage.rss / 1024 / 1024
        }
      });
    }
  }, 30000); // Check every 30 seconds
}

module.exports = {
  captureCustomError,
  addBreadcrumb,
  startTransaction,
  monitorPerformanceIssues,
  Sentry
};