const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

SubjectSchema.index({ userId: 1 });

module.exports = mongoose.model('Subject', SubjectSchema);
