const { recordMetric, createSpan } = require('../config/datadog');

// Example of adding Datadog metrics to product controller
function trackProductMetrics(action, productData = {}) {
  // Record custom business metrics
  recordMetric(`product.${action}`, 1, {
    category: productData.category,
    price_range: productData.price > 100 ? 'high' : 'low'
  });
}

// Example usage in controller methods:
// trackProductMetrics('viewed', { category: 'electronics', price: 150 });
// trackProductMetrics('purchased', { category: 'books', price: 25 });
// trackProductMetrics('search', { category: req.query.category });

module.exports = { trackProductMetrics };