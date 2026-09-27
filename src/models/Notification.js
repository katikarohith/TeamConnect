const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['TASK_ASSIGNED', 'TEAM_INVITE', 'TEAM_MESSAGE', 'MENTION', 'PRIVATE_MESSAGE'], required: true },
  text: { type: String, required: true, maxlength: 300 },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
