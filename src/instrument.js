const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://bdcaff686bd9f3d5a502843b2616d1d0@o4508367104049152.ingest.us.sentry.io/4509917018587136",
  integrations: [
    // Enable profiling
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions
  // Session Replay
  profilesSampleRate: 1.0, // Capture 100% of profiles
  environment: process.env.NODE_ENV || "development",
  
  // Set custom tags
  beforeSend(event, hint) {
    // Add custom context
    event.tags = {
      ...event.tags,
      component: 'backend',
      service: 'ecommerce-api'
    };
    
    // Filter out sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.authorization;
    }
    
    return event;
  },
  
  // Send default PII
  sendDefaultPii: true,
});