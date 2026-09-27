const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getRedis } = require('../config/redis');

exports.presence = asyncHandler(async (req, res) => {
  if (req.params.id !== req.user.id) {
    const sharedTeam = await Team.findOne({ $and: [{ 'members.user': req.user.id }, { 'members.user': req.params.id }] });
    if (!sharedTeam) throw new AppError('You can only view the presence of a teammate.', 403);
  }
  const redis = getRedis();
  const online = redis ? Boolean(await redis.sIsMember('teamconnect:online-users', req.params.id)) : false;
  res.json({ success: true, online });
});
