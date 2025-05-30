const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Joi = require('joi');
const crypto = require('crypto-js');

const transactionSchema = Joi.object({
  toWallet: Joi.string().required(),
  amount: Joi.number().min(0.01).required()
});

const createTransaction = async (req, res) => {
  const { error } = transactionSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { toWallet, amount } = req.body;
  const fromWallet = await Wallet.findById(req.params.walletId);
  if (!fromWallet || fromWallet.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Invalid wallet' });
  }
  if (fromWallet.balance < amount + 0.01) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  if (!(await Wallet.findOne({ address: toWallet }))) {
    return res.status(400).json({ error: 'Recipient wallet not found' });
  }

  const transactionData = { fromWallet: fromWallet.address, toWallet, amount, fee: 0.01, timestamp: Date.now() };
  const signature = crypto.HmacSHA256(JSON.stringify(transactionData), fromWallet.privateKey).toString();
  const hash = Transaction.generateHash(transactionData);

  const transaction = new Transaction({
    userId: req.user.id,
    fromWallet: fromWallet.address,
    toWallet,
    amount,
    fee: 0.01,
    signature,
    hash
  });

  await transaction.save();
  res.status(201).json({ success: true, data: transaction, user: req.user });
};

const getTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ success: true, data: transaction });
};

const listTransactions = async (req, res) => {
  const { status, limit = 20, offset = 0, sortBy = 'timestamp', order = 'desc' } = req.query;
  const query = status ? { status } : {};
  const transactions = await Transaction.find(query)
    .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit));
  const total = await Transaction.countDocuments(query);
  res.json({
    success: true,
    data: transactions,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasNext: offset + limit < total }
  });
};

const getWalletTransactions = async (req, res) => {
  const { minAmount, maxAmount, limit = 20, offset = 0 } = req.query;
  const query = { $or: [{ fromWallet: req.params.walletId }, { toWallet: req.params.walletId }] };
  if (minAmount) query.amount = { $gte: parseFloat(minAmount) };
  if (maxAmount) query.amount = { ...query.amount, $lte: parseFloat(maxAmount) };
  const transactions = await Transaction.find(query)
    .skip(parseInt(offset))
    .limit(parseInt(limit));
  const total = await Transaction.countDocuments(query);
  res.json({
    success: true,
    data: transactions,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasNext: offset + limit < total },
    user: req.user
  });
};

const validateTransaction = async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  const wallet = await Wallet.findOne({ address: transaction.fromWallet });
  if (!wallet || wallet.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Invalid wallet' });
  }
  const transactionData = {
    fromWallet: transaction.fromWallet,
    toWallet: transaction.toWallet,
    amount: transaction.amount,
    fee: transaction.fee,
    timestamp: transaction.timestamp
  };
  const computedSignature = crypto.HmacSHA256(JSON.stringify(transactionData), wallet.privateKey).toString();
  const isValid = computedSignature === transaction.signature && wallet.balance >= (transaction.amount + transaction.fee);
  res.json({ success: true, data: { isValid } });
};

module.exports = { createTransaction, getTransaction, listTransactions, getWalletTransactions, validateTransaction };