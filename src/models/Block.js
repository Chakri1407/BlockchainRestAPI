const mongoose = require('mongoose');
const { createHash } = require('crypto');

const blockSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  transactionCount: { type: Number, default: 0 },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true },
  nonce: { type: Number, required: true },
  merkleRoot: { type: String, required: true },
  difficulty: { type: Number, default: 4 }
});

blockSchema.statics.calculateMerkleRoot = function(transactions) {
  if (!transactions.length) return '';
  let hashes = transactions.map(tx => tx.hash); // Changed 'const' to 'let'
  while (hashes.length > 1) {
    const newLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      newLevel.push(createHash('sha256').update(left + right).digest('hex'));
    }
    hashes = newLevel;
  }
  return hashes[0];
};

blockSchema.statics.calculateHash = function(index, previousHash, timestamp, merkleRoot, nonce) {
  return createHash('sha256').update(index + previousHash + timestamp + merkleRoot + nonce).digest('hex');
};

module.exports = mongoose.model('Block', blockSchema);