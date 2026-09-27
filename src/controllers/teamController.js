const Team = require('../models/Team');
const Task = require('../models/Task');
const Message = require('../models/Message');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const { getRedis } = require('../config/redis');

const populateMembers = [{ path: 'owner', select: 'name email profileImage' }, { path: 'members.user', select: 'name email profileImage' }];

function roleFor(team, userId) {
  return team.members.find((member) => member.user._id ? member.user._id.toString() === userId : member.user.toString() === userId)?.role;
}

async function serializedTeam(team, userId) {
  await team.populate(populateMembers);
  const redis = getRedis();
  const members = await Promise.all(team.members.map(async (member) => ({
    user: member.user,
    role: member.role,
    joinedAt: member.joinedAt,
    online: redis ? Boolean(await redis.sIsMember('teamconnect:online-users', member.user._id.toString())) : false
  })));
  return { ...team.toObject(), members, currentUserRole: roleFor(team, userId) };
}

exports.listTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ 'members.user': req.user.id }).sort({ updatedAt: -1 }).populate('owner', 'name email profileImage');
  res.json({ success: true, teams: await Promise.all(teams.map((team) => serializedTeam(team, req.user.id))) });
});

exports.createTeam = asyncHandler(async (req, res) => {
  const { name, description = '' } = req.body;
  if (!name || name.trim().length < 2) throw new AppError('Team name must contain at least 2 characters.', 400);
  const team = await Team.create({ name: name.trim(), description, owner: req.user.id, members: [{ user: req.user.id, role: 'owner' }] });
  res.status(201).json({ success: true, team: await serializedTeam(team, req.user.id) });
});

exports.getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found.', 404);
  if (!team.members.some((member) => member.user.toString() === req.user.id)) throw new AppError('You are not a member of this team.', 403);
  res.json({ success: true, team: await serializedTeam(team, req.user.id) });
});

exports.updateTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (name !== undefined) {
    if (String(name).trim().length < 2) throw new AppError('Team name must contain at least 2 characters.', 400);
    req.team.name = String(name).trim();
  }
  if (description !== undefined) req.team.description = String(description).trim();
  await req.team.save();
  res.json({ success: true, team: await serializedTeam(req.team, req.user.id) });
});

exports.deleteTeam = asyncHandler(async (req, res) => {
  if (req.teamRole !== 'owner') throw new AppError('Only the team owner can delete a team.', 403);
  await Promise.all([Task.deleteMany({ team: req.team.id }), Message.deleteMany({ team: req.team.id })]);
  await req.team.deleteOne();
  res.status(204).send();
});

exports.joinTeam = asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) throw new AppError('An invite code is required.', 400);
  const team = await Team.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
  if (!team) throw new AppError('That invite code is invalid.', 404);
  if (!team.members.some((member) => member.user.toString() === req.user.id)) {
    team.members.push({ user: req.user.id, role: 'member' });
    await team.save();
  }
  res.json({ success: true, team: await serializedTeam(team, req.user.id) });
});

exports.addMember = asyncHandler(async (req, res) => {
  const User = require('../models/User'); // Kept here to make the team flow easy to follow.
  const { email, role = 'member' } = req.body;
  if (!email) throw new AppError('A member email is required.', 400);
  if (!['admin', 'member'].includes(role)) throw new AppError('A member can be assigned admin or member role.', 400);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new AppError('No registered user has that email yet.', 404);
  if (req.team.members.some((member) => member.user.toString() === user.id)) throw new AppError('This user is already a team member.', 409);
  req.team.members.push({ user: user.id, role });
  await req.team.save();
  await createNotification({ recipient: user.id, actor: req.user.id, type: 'TEAM_INVITE', text: `${req.user.name} added you to ${req.team.name}.`, link: `/teams/${req.team.id}` }, req.app.get('io'));
  res.status(201).json({ success: true, team: await serializedTeam(req.team, req.user.id) });
});

exports.updateMember = asyncHandler(async (req, res) => {
  const member = req.team.members.find((item) => item.user.toString() === req.params.userId);
  if (!member) throw new AppError('Team member not found.', 404);
  if (member.role === 'owner') throw new AppError('The owner role cannot be changed.', 403);
  if (!['admin', 'member'].includes(req.body.role)) throw new AppError('Role must be admin or member.', 400);
  member.role = req.body.role;
  await req.team.save();
  res.json({ success: true, team: await serializedTeam(req.team, req.user.id) });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const member = req.team.members.find((item) => item.user.toString() === req.params.userId);
  if (!member) throw new AppError('Team member not found.', 404);
  if (member.role === 'owner') throw new AppError('The team owner cannot be removed.', 403);
  req.team.members = req.team.members.filter((item) => item.user.toString() !== req.params.userId);
  await req.team.save();
  res.status(204).send();
});

exports.leaveTeam = asyncHandler(async (req, res) => {
  const member = req.team.members.find((item) => item.user.toString() === req.user.id);
  if (member.role === 'owner') throw new AppError('Transfer ownership or delete the team before leaving it.', 400);
  req.team.members = req.team.members.filter((item) => item.user.toString() !== req.user.id);
  await req.team.save();
  res.status(204).send();
});
