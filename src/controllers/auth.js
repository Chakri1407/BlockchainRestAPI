const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const register = async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS));
  try {
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ success: true, data: { id: user._id, username, email } });
  } catch (err) {
    res.status(409).json({ error: 'User already exists' });
  }
};

const login = async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE });
  user.refreshTokens.push(refreshToken);
  await user.save();

  res.json({ success: true, data: { accessToken, refreshToken } });
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  const user = await User.findOne({ refreshTokens: refreshToken });
  if (!user) return res.status(403).json({ error: 'Invalid refresh token' });

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid refresh token' });
    const accessToken = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
    res.json({ success: true, data: { accessToken } });
  });
};

const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -refreshTokens');
  res.json({ success: true, data: user, user: req.user });
};

const updateProfile = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { profile: req.body.profile, updatedAt: Date.now() }, { new: true }).select('-password -refreshTokens');
  res.json({ success: true, data: user, user: req.user });
};

module.exports = { register, login, refresh, getProfile, updateProfile };