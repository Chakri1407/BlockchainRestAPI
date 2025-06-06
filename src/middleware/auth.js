const jwt = require('jsonwebtoken');
const Wallet = require('../models/Wallet');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const checkWalletOwnership = async (req, res, next) => {
  const wallet = await Wallet.findById(req.params.walletId);
  if (!wallet || wallet.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin, checkWalletOwnership };