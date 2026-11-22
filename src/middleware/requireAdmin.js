const ADMIN_ID = '6b01632ca8db9f17c8935b06';

module.exports = function requireAdmin(req, res, next) {
  if (req.user._id.toString() !== ADMIN_ID) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
};
