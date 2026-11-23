const express = require('express');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const PKR_PER_USD            = 280;
const COST_PER_1M_PROMPT     = 0.10;  // Gemini 2.0 Flash
const COST_PER_1M_COMPLETION = 0.40;  // Gemini 2.0 Flash

router.post('/track', requireAuth, async (req, res) => {
  const { promptTokens = 0, completionTokens = 0 } = req.body;
  const addedPkr = parseFloat((
    (promptTokens     / 1_000_000) * COST_PER_1M_PROMPT     * PKR_PER_USD +
    (completionTokens / 1_000_000) * COST_PER_1M_COMPLETION * PKR_PER_USD
  ).toFixed(6));

  await User.findByIdAndUpdate(req.user._id, { $inc: { aiUsagePkr: addedPkr } });
  res.json({ ok: true });
});

module.exports = router;
