const Message = require('../models/Message');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const populateMessage = [{ path: 'sender', select: 'name profileImage' }, { path: 'recipient', select: 'name profileImage' }];

async function verifyMember(userId, teamId) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);
  if (!team.members.some((member) => member.user.toString() === userId)) throw new AppError('You are not a member of this team.', 403);
  return team;
}

exports.getTeamMessages = asyncHandler(async (req, res) => {
  await verifyMember(req.user.id, req.params.teamId);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const messages = await Message.find({ team: req.params.teamId, recipient: null }).sort({ createdAt: -1 }).limit(limit).populate(populateMessage);
  res.json({ success: true, messages: messages.reverse() });
});

exports.createTeamMessage = asyncHandler(async (req, res) => {
  const team = await verifyMember(req.user.id, req.params.teamId);
  const { content = '', imageUrl = '' } = req.body;
  if (!content.trim() && !imageUrl) throw new AppError('A message needs text or an image.', 400);
  const message = await Message.create({ team: team.id, sender: req.user.id, content: content.trim(), imageUrl });
  const populated = await message.populate(populateMessage);
  req.app.get('io')?.to(`team:${team.id}`).emit('receiveMessage', populated);
  res.status(201).json({ success: true, message: populated });
});

exports.getPrivateMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find({ recipient: { $ne: null }, $or: [
    { sender: req.user.id, recipient: req.params.userId },
    { sender: req.params.userId, recipient: req.user.id }
  ] }).sort({ createdAt: 1 }).limit(100).populate(populateMessage);
  res.json({ success: true, messages });
});

module.exports.verifyMember = verifyMember;
module.exports.populateMessage = populateMessage;
