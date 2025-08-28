const Sentry = require("@sentry/node");

// Custom monitoring and alerting configuration
class MonitoringService {
  constructor() {
    this.memoryThresholds = {
      warning: 150 * 1024 * 1024,  // 150MB
      critical: 300 * 1024 * 1024  // 300MB
    };
    
    this.performanceThresholds = {
      slowQuery: 1000,     // 1 second
      verySlowQuery: 5000  // 5 seconds
    };
    
    // Start periodic monitoring
    this.startMonitoring();
  }

  // Monitor memory usage and send alerts
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const rss = usage.rss;

    // Send memory metrics to Sentry
    Sentry.addBreadcrumb({
      message: 'Memory Usage Check',
      data: {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        rss: Math.round(rss / 1024 / 1024) + 'MB',
        external: Math.round(usage.external / 1024 / 1024) + 'MB'
      },
      level: 'info'
    });

    // Critical memory threshold
    if (rss > this.memoryThresholds.critical) {
      const error = new Error('Critical Memory Usage Alert');
      error.extra = {
        memoryUsage: usage,
        threshold: 'critical',
        rssUsedMB: Math.round(rss / 1024 / 1024),
        thresholdMB: Math.round(this.memoryThresholds.critical / 1024 / 1024)
      };
      
      Sentry.captureException(error);
      console.log('🚨 CRITICAL: Memory usage exceeded', Math.round(rss / 1024 / 1024) + 'MB');
      
    } else if (rss > this.memoryThresholds.warning) {
      Sentry.addBreadcrumb({
        message: 'High Memory Usage Warning',
        data: {
          rssUsedMB: Math.round(rss / 1024 / 1024),
          thresholdMB: Math.round(this.memoryThresholds.warning / 1024 / 1024)
        },
        level: 'warning'
      });
      
      console.log('⚠️  WARNING: High memory usage', Math.round(rss / 1024 / 1024) + 'MB');
    }
  }

  // Track database query performance
  trackQueryPerformance(query, duration, metadata = {}) {
    if (duration > this.performanceThresholds.verySlowQuery) {
      const error = new Error('Very Slow Database Query Detected');
      error.extra = {
        query: query.substring(0, 200), // Truncate for privacy
        durationMs: duration,
        threshold: 'very_slow',
        ...metadata
      };
      
      Sentry.captureException(error);
      console.log('🐌 VERY SLOW QUERY:', duration + 'ms');
      
    } else if (duration > this.performanceThresholds.slowQuery) {
      Sentry.addBreadcrumb({
        message: 'Slow Database Query',
        data: {
          durationMs: duration,
          queryType: metadata.type || 'unknown',
          threshold: 'slow'
        },
        level: 'warning'
      });
      
      console.log('⏰ SLOW QUERY:', duration + 'ms');
    }

    // Send performance metric to Sentry
    Sentry.setTag('query_performance', duration > 1000 ? 'slow' : 'normal');
  }

  // Track database connection pool status
  trackConnectionPool(poolStats) {
    const { totalConnections, idleConnections, waitingCount } = poolStats;
    const activeConnections = totalConnections - idleConnections;
    const utilizationPercent = (activeConnections / totalConnections) * 100;

    // High connection pool utilization alert
    if (utilizationPercent > 90) {
      const error = new Error('Database Connection Pool Near Exhaustion');
      error.extra = {
        totalConnections,
        activeConnections,
        idleConnections,
        waitingCount,
        utilizationPercent: Math.round(utilizationPercent)
      };
      
      Sentry.captureException(error);
      console.log('🚨 CONNECTION POOL CRITICAL:', Math.round(utilizationPercent) + '% utilized');
      
    } else if (utilizationPercent > 70) {
      Sentry.addBreadcrumb({
        message: 'High Database Connection Pool Usage',
        data: {
          utilizationPercent: Math.round(utilizationPercent),
          activeConnections,
          totalConnections
        },
        level: 'warning'
      });
      
      console.log('⚠️  CONNECTION POOL HIGH:', Math.round(utilizationPercent) + '% utilized');
    }
  }

  // Track chaos scenario events
  trackChaosEvent(type, details) {
    Sentry.addBreadcrumb({
      message: `Chaos Engineering: ${type}`,
      data: details,
      level: 'info',
      category: 'chaos'
    });

    // Send custom event to Sentry for chaos scenarios
    Sentry.withScope((scope) => {
      scope.setTag('chaos_scenario', type);
      scope.setLevel('warning');
      scope.setContext('chaos_details', details);
      
      Sentry.captureMessage(`Chaos Scenario Triggered: ${type}`, 'warning');
    });
    
    console.log(`🔥 CHAOS EVENT: ${type}`, details);
  }

  // Track error rate spikes
  trackErrorRate() {
    // This would typically connect to your error rate metrics
    // For now, we'll track via Sentry's built-in error rate monitoring
    Sentry.addBreadcrumb({
      message: 'Error Rate Check',
      level: 'info'
    });
  }

  // Start periodic monitoring
  startMonitoring() {
    // Check memory every 30 seconds
    this.memoryInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);

    // Log monitoring start
    console.log('📊 Monitoring service started - Memory checks every 30s');
    
    Sentry.addBreadcrumb({
      message: 'Monitoring Service Started',
      level: 'info'
    });
  }

  // Stop monitoring (cleanup)
  stopMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      console.log('📊 Monitoring service stopped');
    }
  }

  // Manual trigger for testing alerts
  triggerTestAlert(type = 'memory') {
    switch (type) {
      case 'memory':
        const fakeError = new Error('Test Memory Alert');
        fakeError.extra = {
          testAlert: true,
          memoryUsage: process.memoryUsage(),
          trigger: 'manual_test'
        };
        Sentry.captureException(fakeError);
        break;
        
      case 'performance':
        this.trackQueryPerformance('SELECT * FROM test_table WHERE slow_condition', 6000, {
          testAlert: true,
          trigger: 'manual_test'
        });
        break;
        
      case 'connection':
        this.trackConnectionPool({
          totalConnections: 10,
          idleConnections: 1,
          waitingCount: 5,
          testAlert: true
        });
        break;
        
      default:
        Sentry.captureMessage('Test Alert Triggered: ' + type, 'warning');
    }
    
    console.log(`🧪 TEST ALERT TRIGGERED: ${type}`);
  }
}

// Create singleton instance
const monitoring = new MonitoringService();

// Graceful shutdown
process.on('SIGTERM', () => {
  monitoring.stopMonitoring();
});

process.on('SIGINT', () => {
  monitoring.stopMonitoring();
});

module.exports = monitoring;