const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  openrouterApiKey: { type: String, default: '' },
  subscribed: { type: Boolean, default: false },
  subscriptionExpiry: { type: Date, default: null },
  activeSessionToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
