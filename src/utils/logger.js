const winston = require('winston');
const { tracer } = require('../config/datadog');
const DatadogHTTPTransport = require('./datadog-http-logger');

// Initialize Datadog HTTP transport if API key is present
let datadogTransport = null;
if (process.env.DD_API_KEY) {
  datadogTransport = new DatadogHTTPTransport(
    process.env.DD_API_KEY,
    process.env.DD_SITE || 'us5.datadoghq.com',
    process.env.DD_SERVICE || 'ecommerce-backend'
  );
}

// Create Winston logger with Datadog format
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(info => {
      // Inject trace IDs for log correlation
      const span = tracer?.scope()?.active();
      if (span) {
        const traceId = span.context().toTraceId();
        const spanId = span.context().toSpanId();
        info.dd = {
          trace_id: traceId,
          span_id: spanId,
          service: process.env.DD_SERVICE || 'ecommerce-backend',
          env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
          version: process.env.DD_VERSION || '1.0.0'
        };
      }
      
      // Send to Datadog HTTP transport if available
      if (datadogTransport) {
        datadogTransport.log(info.level, info.message, info);
      }
      
      return JSON.stringify(info);
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'combined.log' 
  }));
}

module.exports = logger;