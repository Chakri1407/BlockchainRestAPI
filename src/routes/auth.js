const express = require('express');
const { register, login, refresh, getProfile, updateProfile } = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/register', (req, res, next) => {
    console.log('Register route hit');
    register(req, res, next);
  });
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

module.exports = router;