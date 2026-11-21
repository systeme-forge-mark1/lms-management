const express = require('express');
const Subject = require('../models/Subject');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const subjects = await Subject.find({ userId: req.user._id }).sort({ createdAt: 1 });
  res.json(subjects);
});

router.post('/', async (req, res) => {
  const { fullName } = req.body;
  if (!fullName?.trim()) return res.status(400).json({ error: 'fullName is required' });

  const existing = await Subject.findOne({ userId: req.user._id, fullName: fullName.trim() });
  if (existing) return res.status(409).json({ error: 'Subject already registered' });

  const subject = await Subject.create({ userId: req.user._id, fullName: fullName.trim() });
  res.status(201).json(subject);
});

router.delete('/:id', async (req, res) => {
  const subject = await Subject.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  res.json({ ok: true });
});

module.exports = router;
