const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const User = require('../models/User');
const Team = require('../models/Team');
const Message = require('../models/Message');
const { createNotification } = require('../services/notificationService');
const { getRedis, createRedisDuplicate } = require('../config/redis');

const localPresence = new Map();
const messagePopulate = [{ path: 'sender', select: 'name profileImage' }, { path: 'recipient', select: 'name profileImage' }];

function socketError(callback, message) {
  if (typeof callback === 'function') callback({ ok: false, message });
}

async function isTeamMember(userId, teamId) {
  const team = await Team.findById(teamId).populate('members.user', 'name profileImage');
  if (!team) throw new Error('Team not found.');
  if (!team.members.some((member) => member.user._id.toString() === userId)) throw new Error('You are not a member of this team.');
  return team;
}

async function markOnline(userId, socketId) {
  const redis = getRedis();
  if (redis) {
    await redis.sAdd(`teamconnect:presence:${userId}`, socketId);
    await redis.expire(`teamconnect:presence:${userId}`, 86400);
    return (await redis.sAdd('teamconnect:online-users', userId)) === 1;
  }
  const sockets = localPresence.get(userId) || new Set();
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  localPresence.set(userId, sockets);
  return wasOffline;
}

async function markOffline(userId, socketId) {
  const redis = getRedis();
  if (redis) {
    await redis.sRem(`teamconnect:presence:${userId}`, socketId);
    const remaining = await redis.sCard(`teamconnect:presence:${userId}`);
    if (remaining === 0) {
      await redis.del(`teamconnect:presence:${userId}`);
      await redis.sRem('teamconnect:online-users', userId);
      return true;
    }
    return false;
  }
  const sockets = localPresence.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (!sockets.size) { localPresence.delete(userId); return true; }
  return false;
}

async function enableRedisAdapter(io) {
  if (!getRedis()) return;
  try {
    const pubClient = await createRedisDuplicate();
    const subClient = await createRedisDuplicate();
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis adapter enabled.');
    }
  } catch (error) {
    console.warn(`Socket.IO is using its in-memory adapter: ${error.message}`);
  }
}

async function notifyTeamMessage(io, team, sender, message) {
  const recipients = team.members.filter((member) => member.user._id.toString() !== sender.id);
  await Promise.all(recipients.map((member) => createNotification({
    recipient: member.user._id,
    actor: sender.id,
    type: 'TEAM_MESSAGE',
    text: `${sender.name} posted a message in ${team.name}.`,
    link: `/teams/${team.id}`
  }, io)));

  const text = message.content.toLowerCase();
  const mentions = recipients.filter((member) => member.user.name && text.includes(`@${member.user.name.toLowerCase().replace(/\s+/g, '')}`));
  await Promise.all(mentions.map((member) => createNotification({
    recipient: member.user._id,
    actor: sender.id,
    type: 'MENTION',
    text: `${sender.name} mentioned you in ${team.name}.`,
    link: `/teams/${team.id}`
  }, io)));
}

async function initializeSockets(io) {
  await enableRedisAdapter(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication token is required.'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email profileImage');
      if (!user) return next(new Error('Account no longer exists.'));
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid or expired authentication token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    socket.join(`user:${userId}`);
    try {
      if (await markOnline(userId, socket.id)) io.emit('userOnline', { userId });
    } catch (error) { console.warn('Presence update failed:', error.message); }

    socket.on('joinTeam', async ({ teamId }, callback) => {
      try {
        await isTeamMember(userId, teamId);
        socket.join(`team:${teamId}`);
        if (typeof callback === 'function') callback({ ok: true });
      } catch (error) { socketError(callback, error.message); }
    });

    socket.on('leaveTeam', ({ teamId }, callback) => {
      socket.leave(`team:${teamId}`);
      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('sendMessage', async ({ teamId, content = '', imageUrl = '' }, callback) => {
      try {
        if (!String(content).trim() && !imageUrl) throw new Error('A message needs text or an image.');
        const team = await isTeamMember(userId, teamId);
        const message = await Message.create({ team: teamId, sender: userId, content: String(content).trim(), imageUrl });
        const populated = await message.populate(messagePopulate);
        io.to(`team:${teamId}`).emit('receiveMessage', populated);
        notifyTeamMessage(io, team, socket.user, message).catch((error) => console.error('Notification delivery error:', error.message));
        if (typeof callback === 'function') callback({ ok: true, message: populated });
      } catch (error) { socketError(callback, error.message); }
    });

    socket.on('privateMessage', async ({ recipientId, content = '', imageUrl = '' }, callback) => {
      try {
        if (!recipientId || (!String(content).trim() && !imageUrl)) throw new Error('A recipient and message are required.');
        const sharedTeam = await Team.findOne({ $and: [{ 'members.user': userId }, { 'members.user': recipientId }] });
        if (!sharedTeam) throw new Error('You can only message a teammate privately.');
        const message = await Message.create({ sender: userId, recipient: recipientId, content: String(content).trim(), imageUrl });
        const populated = await message.populate(messagePopulate);
        io.to(`user:${recipientId}`).emit('privateMessage', populated);
        await createNotification({ recipient: recipientId, actor: userId, type: 'PRIVATE_MESSAGE', text: `${socket.user.name} sent you a private message.`, link: '/chat' }, io);
        if (typeof callback === 'function') callback({ ok: true, message: populated });
      } catch (error) { socketError(callback, error.message); }
    });

    socket.on('typing', async ({ teamId }) => {
      try { await isTeamMember(userId, teamId); socket.to(`team:${teamId}`).emit('typing', { teamId, user: { id: userId, name: socket.user.name } }); } catch (error) { /* Ignore unauthorized ephemeral events. */ }
    });
    socket.on('stopTyping', ({ teamId }) => socket.to(`team:${teamId}`).emit('stopTyping', { teamId, userId }));

    socket.on('disconnect', async () => {
      try {
        if (await markOffline(userId, socket.id)) io.emit('userOffline', { userId });
      } catch (error) { console.warn('Presence removal failed:', error.message); }
    });
  });
}

module.exports = initializeSockets;
