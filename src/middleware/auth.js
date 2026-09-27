const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError('Authentication token is required.', 401);

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new AppError('Your session is invalid or has expired. Please sign in again.', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('The account for this token no longer exists.', 401);
  req.user = user;
  next();
});

exports.requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.teamRole)) return next(new AppError('You do not have permission for this team action.', 403));
  next();
};
