// This file MUST be imported at the very beginning of your application
// before any other module imports

const { initializeDatadog } = require('./config/datadog');

// Initialize Datadog APM
const tracer = initializeDatadog();

// Export tracer for use in other modules
module.exports = tracer;