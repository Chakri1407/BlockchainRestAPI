const mongoose = require('mongoose');
const { createHash } = require('crypto');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromWallet: { type: String, required: true },
  toWallet: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  fee: { type: Number, default: 0.01 },
  signature: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', default: null },
  hash: { type: String, required: true }
});

transactionSchema.statics.generateHash = function(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

module.exports = mongoose.model('Transaction', transactionSchema);