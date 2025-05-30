const mongoose = require('mongoose');
const crypto = require('crypto-js');
const { createHash } = require('crypto');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true },
  privateKey: { type: String, required: true },
  balance: { type: Number, default: 0 },
  metadata: {
    name: String,
    description: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

walletSchema.statics.generateWallet = async function(userId) {
  const keyPair = crypto.lib.WordArray.random(32).toString();
  const publicKey = crypto.SHA256(keyPair).toString();
  const address = createHash('sha256').update(publicKey).digest('hex');
  return { address, publicKey, privateKey: keyPair };
};

module.exports = mongoose.model('Wallet', walletSchema);