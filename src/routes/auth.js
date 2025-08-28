const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock user data (in production, this would come from database)
const users = [
  { id: 1, email: 'user@example.com', password: '$2b$10$YourHashedPasswordHere' }
];

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );
  
  res.json({ token, user: { id: user.id, email: user.email } });
});

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    email,
    password: hashedPassword
  };
  
  users.push(newUser);
  
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );
  
  res.status(201).json({ token, user: { id: newUser.id, email } });
});

module.exports = router;