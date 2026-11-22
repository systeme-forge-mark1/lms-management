const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res) => {
  const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { username, password, subscriptionExpiry } = req.body;
  if (!username || !password || password.length < 6)
    return res.status(400).json({ error: 'Username and password (min 6 chars) required' });
  const existing = await User.findOne({ username: username.toLowerCase().trim() });
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: username.toLowerCase().trim(),
    passwordHash: hash,
    subscribed: true,
    subscriptionExpiry: subscriptionExpiry ? new Date(subscriptionExpiry) : null,
  });
  res.status(201).json({ ok: true, id: user._id });
});

router.patch('/users/:id/password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const hash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.params.id, { passwordHash: hash, activeSessionToken: null });
  res.json({ ok: true });
});

router.patch('/users/:id/apikey', async (req, res) => {
  const { apiKey } = req.body;
  await User.findByIdAndUpdate(req.params.id, { openrouterApiKey: apiKey || '' });
  res.json({ ok: true });
});

router.patch('/users/:id/revoke', async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { subscribed: false, activeSessionToken: null });
  res.json({ ok: true });
});

router.patch('/users/:id/subscription', async (req, res) => {
  const { subscribed, subscriptionExpiry } = req.body;
  const update = { subscribed: Boolean(subscribed) };
  if (subscriptionExpiry) update.subscriptionExpiry = new Date(subscriptionExpiry);
  await User.findByIdAndUpdate(req.params.id, update);
  res.json({ ok: true });
});

module.exports = router;
