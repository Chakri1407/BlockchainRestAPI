const express = require('express');
const { createWallet, getWallet, getBalance, updateWallet, getUserWallets, fundWallet } = require('../controllers/wallet');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');
const router = express.Router();

router.post('/', authenticateToken, createWallet);
router.get('/:walletId', authenticateToken, checkWalletOwnership, getWallet);
router.get('/:walletId/balance', authenticateToken, checkWalletOwnership, getBalance);
router.put('/:walletId', authenticateToken, checkWalletOwnership, updateWallet);
router.get('/', authenticateToken, getUserWallets);
router.post('/:walletId/fund', authenticateToken, checkWalletOwnership, fundWallet); // New funding endpoint

module.exports = router;