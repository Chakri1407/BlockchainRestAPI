const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Joi = require('joi');

const walletSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional()
});

const createWallet = async (req, res) => {
  const { error } = walletSchema.validate(req.body.metadata || {});
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { address, publicKey, privateKey } = await Wallet.generateWallet(req.user.id);
  const wallet = new Wallet({
    userId: req.user.id,
    address,
    publicKey,
    privateKey,
    metadata: req.body.metadata,
    balance: 0
  });

  await wallet.save();
  res.status(201).json({ success: true, data: wallet, user: req.user });
};

const getWallet = async (req, res) => {
  const wallet = await Wallet.findById(req.params.walletId).select('-privateKey');
  res.json({ success: true, data: wallet, user: req.user });
};

const getBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findById(req.params.walletId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    if (wallet.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const transactions = await Transaction.find({
      $or: [
        { fromWallet: wallet.address },
        { toWallet: wallet.address }
      ],
      status: 'confirmed'
    });
    const balance = transactions.reduce((acc, tx) => {
      const amount = Number(tx.amount);
      if (isNaN(amount)) return acc;
      if (tx.toWallet === wallet.address) return acc + amount;
      if (tx.fromWallet === wallet.address) return acc - amount;
      return acc;
    }, 0);
    res.json({ success: true, data: { balance }, user: req.user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get balance', details: err.message });
  }
};

const updateWallet = async (req, res) => {
  const { error } = walletSchema.validate(req.body.metadata || {});
  if (error) return res.status(400).json({ error: error.details[0].message });

  const wallet = await Wallet.findByIdAndUpdate(
    req.params.walletId,
    { metadata: req.body.metadata, updatedAt: Date.now() },
    { new: true }
  ).select('-privateKey');
  res.json({ success: true, data: wallet, user: req.user });
};

const getUserWallets = async (req, res) => {
  const wallets = await Wallet.find({ userId: req.user.id }).select('-privateKey');
  res.json({ success: true, data: wallets, user: req.user });
};

const fundWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const { amount } = req.body;

    // Validate amount
    const fundAmount = Number(amount);
    if (isNaN(fundAmount) || fundAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });
    }

    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    if (wallet.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create a funding transaction from "system"
    const transaction = new Transaction({
      fromWallet: 'system',
      toWallet: wallet.address,
      amount: fundAmount,
      status: 'confirmed',
      user: req.user.id,
      userId: req.user.id, // Add userId field
      hash: `system-funding-hash-${Date.now()}`, // Placeholder hash
      signature: `system-funding-signature-${Date.now()}`, // Placeholder signature
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await transaction.save();

    // Calculate the updated balance
    const transactions = await Transaction.find({
      $or: [
        { fromWallet: wallet.address },
        { toWallet: wallet.address }
      ],
      status: 'confirmed'
    });
    const balance = transactions.reduce((acc, tx) => {
      const amount = Number(tx.amount);
      if (isNaN(amount)) return acc;
      if (tx.toWallet === wallet.address) return acc + amount;
      if (tx.fromWallet === wallet.address) return acc - amount;
      return acc;
    }, 0);

    res.status(200).json({ success: true, data: { message: 'Wallet funded', balance }, user: req.user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fund wallet', details: err.message });
  }
};

module.exports = { createWallet, getWallet, getBalance, updateWallet, getUserWallets, fundWallet };