const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.loadTeamMembership = asyncHandler(async (req, res, next) => {
  const teamId = req.params.teamId || req.params.id || req.body.team;
  const team = await Team.findById(teamId);
  if (!team) throw new AppError('Team not found.', 404);

  const membership = team.members.find((member) => member.user.toString() === req.user.id);
  if (!membership) throw new AppError('You are not a member of this team.', 403);

  req.team = team;
  req.teamRole = membership.role;
  next();
});

exports.requireTeamRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.teamRole)) return next(new AppError('Only team owners or admins can perform this action.', 403));
  next();
};
