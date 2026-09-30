'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, toPublicUser } = require('../utils/token');
const { syncNotificationsForUser } = require('../utils/notificationService');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('An account with that email already exists.');
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user);

  res.status(201).json({ success: true, message: 'Account created successfully.', data: { user: toPublicUser(user), token } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  // Same generic message for unknown email and wrong password so the endpoint
  // cannot be used to enumerate registered accounts.
  if (!user || !(await user.matchesPassword(password))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  await syncNotificationsForUser(user._id);

  const token = signToken(user);

  res.json({ success: true, message: 'Logged in successfully.', data: { user: toPublicUser(user), token } });
});

const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: toPublicUser(req.user) } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { name: req.body.name } },
    { new: true, runValidators: true },
  );

  if (!user) throw ApiError.notFound('Account not found.');

  res.json({ success: true, message: 'Profile updated.', data: { user: toPublicUser(user) } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.matchesPassword(currentPassword))) {
    throw ApiError.unauthorized('Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated successfully.' });
});

module.exports = { register, login, getProfile, updateProfile, changePassword };
