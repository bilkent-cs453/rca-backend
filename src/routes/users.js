const express = require('express');
const router = express.Router();

router.get('/profile', async (req, res) => {
  res.json({ id: 1, email: 'user@example.com' });
});

router.put('/profile', async (req, res) => {
  res.json({ id: 1, ...req.body });
});

module.exports = router;