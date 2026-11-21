const User = require('../models/User');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);

  let user;
  try {
    user = await User.findOne({ activeSessionToken: token });
  } catch {
    return res.status(500).json({ error: 'Auth check failed' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Session expired or account signed in on another device' });
  }

  if (!user.subscribed) {
    return res.status(403).json({ error: 'No active subscription. Contact support to activate.' });
  }

  if (user.subscriptionExpiry && user.subscriptionExpiry < new Date()) {
    return res.status(403).json({ error: 'Subscription expired. Contact support to renew.' });
  }

  req.user = user;
  next();
}

module.exports = requireAuth;
