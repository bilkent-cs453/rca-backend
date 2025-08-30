const https = require('https');

class DatadogHTTPTransport {
  constructor(apiKey, site = 'us5.datadoghq.com', service = 'ecommerce-backend') {
    this.apiKey = apiKey;
    this.site = site;
    this.service = service;
    this.hostname = `http-intake.logs.${site}`;
    this.path = `/api/v2/logs`;
    this.buffer = [];
    this.flushInterval = 5000; // Flush every 5 seconds
    this.maxBatchSize = 100;
    
    // Start flush timer
    this.startFlushTimer();
  }

  startFlushTimer() {
    setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  log(level, message, meta = {}) {
    const logEntry = {
      ddsource: 'nodejs',
      ddtags: `env:${process.env.DD_ENV || 'production'},service:${this.service},version:${process.env.DD_VERSION || '1.0.0'}`,
      hostname: process.env.RENDER_SERVICE_NAME || 'render-service',
      service: this.service,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      level: level,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.buffer.push(logEntry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;

    const logs = this.buffer.splice(0, this.maxBatchSize);
    const payload = JSON.stringify(logs);

    const options = {
      hostname: this.hostname,
      port: 443,
      path: this.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'DD-API-KEY': this.apiKey
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 202) {
        console.error(`Datadog log submission failed: ${res.statusCode}`);
      }
    });

    req.on('error', (error) => {
      console.error('Error sending logs to Datadog:', error.message);
    });

    req.write(payload);
    req.end();
  }
}

module.exports = DatadogHTTPTransport;