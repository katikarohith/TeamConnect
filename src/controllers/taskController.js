const Task = require('../models/Task');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');

const taskPopulate = [
  { path: 'assignedTo', select: 'name email profileImage' },
  { path: 'createdBy', select: 'name profileImage' },
  { path: 'team', select: 'name' }
];

async function ensureTeamMember(userId, teamId) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);
  const member = team.members.find((item) => item.user.toString() === userId);
  if (!member) throw new AppError('You are not a member of this team.', 403);
  return { team, role: member.role };
}

function validAssignment(team, userId) {
  return !userId || team.members.some((member) => member.user.toString() === userId);
}

exports.listTasks = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.team) {
    await ensureTeamMember(req.user.id, req.query.team);
    filter.team = req.query.team;
  } else {
    const teams = await Team.find({ 'members.user': req.user.id }).select('_id');
    filter.team = { $in: teams.map((team) => team.id) };
  }
  if (req.query.status && ['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(req.query.status)) filter.status = req.query.status;
  const tasks = await Task.find(filter).populate(taskPopulate).sort({ dueDate: 1, createdAt: -1 });
  res.json({ success: true, tasks });
});

exports.getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate(taskPopulate);
  if (!task) throw new AppError('Task not found.', 404);
  await ensureTeamMember(req.user.id, task.team._id);
  res.json({ success: true, task });
});

exports.createTask = asyncHandler(async (req, res) => {
  const { title, description = '', team: teamId, assignedTo = null, status = 'TODO', priority = 'MEDIUM', dueDate = null } = req.body;
  if (!title || !teamId) throw new AppError('Task title and team are required.', 400);
  if (!['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status) || !['LOW', 'MEDIUM', 'HIGH'].includes(priority)) throw new AppError('Invalid task status or priority.', 400);
  const { team } = await ensureTeamMember(req.user.id, teamId);
  if (!validAssignment(team, assignedTo)) throw new AppError('The assignee must be a member of this team.', 400);
  const task = await Task.create({ title, description, team: teamId, assignedTo, createdBy: req.user.id, status, priority, dueDate: dueDate || null });
  const populated = await task.populate(taskPopulate);
  if (assignedTo && assignedTo !== req.user.id) {
    await createNotification({ recipient: assignedTo, actor: req.user.id, type: 'TASK_ASSIGNED', text: `${req.user.name} assigned you “${task.title}” in ${team.name}.`, link: `/tasks?team=${team.id}` }, req.app.get('io'));
  }
  req.app.get('io')?.to(`team:${team.id}`).emit('taskUpdated', { action: 'created', task: populated });
  res.status(201).json({ success: true, task: populated });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found.', 404);
  const { team, role } = await ensureTeamMember(req.user.id, task.team);
  const isCreator = task.createdBy.toString() === req.user.id;
  const isAssignee = task.assignedTo?.toString() === req.user.id;
  const isAdmin = ['owner', 'admin'].includes(role);
  const allowedStatusOnly = isAssignee && Object.keys(req.body).every((key) => key === 'status');
  if (!isCreator && !isAdmin && !allowedStatusOnly) throw new AppError('You can only update your assigned task status.', 403);

  const permitted = ['title', 'description', 'assignedTo', 'status', 'priority', 'dueDate'];
  permitted.forEach((field) => { if (req.body[field] !== undefined) task[field] = req.body[field] || null; });
  if (!['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(task.status) || !['LOW', 'MEDIUM', 'HIGH'].includes(task.priority)) throw new AppError('Invalid task status or priority.', 400);
  if (!validAssignment(team, task.assignedTo?.toString())) throw new AppError('The assignee must be a team member.', 400);
  await task.save();
  const populated = await task.populate(taskPopulate);
  if (req.body.assignedTo && req.body.assignedTo !== req.user.id) {
    await createNotification({ recipient: req.body.assignedTo, actor: req.user.id, type: 'TASK_ASSIGNED', text: `${req.user.name} assigned you “${task.title}” in ${team.name}.`, link: `/tasks?team=${team.id}` }, req.app.get('io'));
  }
  req.app.get('io')?.to(`team:${team.id}`).emit('taskUpdated', { action: 'updated', task: populated });
  res.json({ success: true, task: populated });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found.', 404);
  const { role } = await ensureTeamMember(req.user.id, task.team);
  if (task.createdBy.toString() !== req.user.id && !['owner', 'admin'].includes(role)) throw new AppError('Only the creator or a team admin can delete this task.', 403);
  const teamId = task.team.toString();
  await task.deleteOne();
  req.app.get('io')?.to(`team:${teamId}`).emit('taskUpdated', { action: 'deleted', taskId: req.params.id });
  res.status(204).send();
});
