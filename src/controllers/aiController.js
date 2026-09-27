const Message = require('../models/Message');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateTaskBreakdown, summarizeConversation } = require('../services/aiService');

exports.taskBreakdown = asyncHandler(async (req, res) => {
  const { description } = req.body;
  if (!description || typeof description !== 'string' || description.trim().length < 10) throw new AppError('Enter a task description of at least 10 characters.', 400);
  const subtasks = await generateTaskBreakdown(description.trim().slice(0, 4000));
  res.json({ success: true, subtasks });
});

exports.chatSummary = asyncHandler(async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) throw new AppError('Team ID is required.', 400);
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);
  if (!team.members.some((member) => member.user.toString() === req.user.id)) throw new AppError('You are not a member of this team.', 403);
  const messages = await Message.find({ team: teamId, recipient: null }).sort({ createdAt: -1 }).limit(40).populate('sender', 'name');
  if (!messages.length) throw new AppError('There are no messages to summarize yet.', 400);
  const summary = await summarizeConversation(messages.reverse());
  res.json({ success: true, summary, messageCount: messages.length });
});
