const Wallet = require('../models/Wallet');
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
  const wallet = await Wallet.findById(req.params.walletId);
  res.json({ success: true, data: { balance: wallet.balance }, user: req.user });
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

module.exports = { createWallet, getWallet, getBalance, updateWallet, getUserWallets };