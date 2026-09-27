const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/token');

function userResponse(user) {
  return { id: user.id, name: user.name, email: user.email, profileImage: user.profileImage, createdAt: user.createdAt };
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new AppError('Name, email, and password are required.', 400);
  if (password.length < 8) throw new AppError('Password must be at least 8 characters long.', 400);
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw new AppError('An account with that email already exists.', 409);

  const user = await User.create({ name, email, password });
  res.status(201).json({ success: true, token: signToken(user.id), user: userResponse(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required.', 400);

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new AppError('Invalid email or password.', 401);

  res.json({ success: true, token: signToken(user.id), user: userResponse(user) });
});

exports.logout = (req, res) => res.status(204).send();
exports.me = (req, res) => res.json({ success: true, user: userResponse(req.user) });

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) throw new AppError('Name must contain at least 2 characters.', 400);
    req.user.name = name.trim();
  }
  await req.user.save();
  res.json({ success: true, user: userResponse(req.user) });
});
