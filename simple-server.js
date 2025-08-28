// Minimal server for testing Render deployment
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV
  });
});

// Basic products endpoint for testing
app.get('/api/products', (req, res) => {
  res.json({
    products: [
      { id: 1, name: 'Test Product', price: 29.99 },
      { id: 2, name: 'Another Product', price: 19.99 }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Simple server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;