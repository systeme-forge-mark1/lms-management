const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (!user.subscribed) {
    return res.status(403).json({ error: 'No active subscription. Contact support to activate.' });
  }
  if (user.subscriptionExpiry && user.subscriptionExpiry < new Date()) {
    return res.status(403).json({ error: 'Subscription expired. Contact support to renew.' });
  }

  const token = crypto.randomUUID();
  user.activeSessionToken = token;
  await user.save();

  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      subscribed: user.subscribed,
      subscriptionExpiry: user.subscriptionExpiry,
    },
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  req.user.activeSessionToken = null;
  await req.user.save();
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    subscribed: req.user.subscribed,
    subscriptionExpiry: req.user.subscriptionExpiry,
  });
});

module.exports = router;
