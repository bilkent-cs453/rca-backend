const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.json({ orders: [] });
});

router.post('/', async (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

router.get('/:id', async (req, res) => {
  res.json({ id: req.params.id, items: [] });
});

module.exports = router;