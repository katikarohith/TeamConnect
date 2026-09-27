const Notification = require('../models/Notification');

async function createNotification(payload, io) {
  const notification = await Notification.create(payload);
  const populated = await notification.populate([
    { path: 'actor', select: 'name profileImage' },
    { path: 'recipient', select: 'name' }
  ]);
  if (io) io.to(`user:${payload.recipient}`).emit('notification', populated);
  return populated;
}

module.exports = { createNotification };
