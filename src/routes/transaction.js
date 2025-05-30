const express = require('express');
const { createTransaction, getTransaction, listTransactions, getWalletTransactions, validateTransaction } = require('../controllers/transaction');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');
const router = express.Router();

router.post('/:walletId', authenticateToken, checkWalletOwnership, createTransaction);
router.get('/:transactionId', getTransaction);
router.get('/', listTransactions);
router.get('/wallet/:walletId', authenticateToken, checkWalletOwnership, getWalletTransactions);
router.post('/validate/:transactionId', authenticateToken, validateTransaction);

module.exports = router;