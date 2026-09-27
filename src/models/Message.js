const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: function requiredTeam() { return !this.recipient; } },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  content: { type: String, trim: true, maxlength: 3000, default: '' },
  imageUrl: { type: String, default: '' }
}, { timestamps: true });

messageSchema.index({ team: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
