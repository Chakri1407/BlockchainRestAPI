const Block = require('../models/Block');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const { createHash } = require('crypto');

const getBlocks = async (req, res) => {
  const { fromDate, toDate, limit = 10, offset = 0 } = req.query;
  const query = {};
  if (fromDate) query.timestamp = { $gte: new Date(fromDate) };
  if (toDate) query.timestamp = { ...query.timestamp, $lte: new Date(toDate) };
  const blocks = await Block.find(query)
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .populate('transactions');
  const total = await Block.countDocuments(query);
  res.json({
    success: true,
    data: blocks,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasNext: offset + limit < total }
  });
};

const getBlock = async (req, res) => {
  const block = await Block.findById(req.params.blockId).populate('transactions');
  if (!block) return res.status(404).json({ error: 'Block not found' });
  res.json({ success: true, data: block });
};

const getStatus = async (req, res) => {
  const blockCount = await Block.countDocuments();
  const transactionCount = await Transaction.countDocuments();
  const latestBlock = await Block.findOne().sort({ timestamp: -1 });
  res.json({
    success: true,
    data: {
      blockCount,
      transactionCount,
      latestBlockHash: latestBlock ? latestBlock.hash : ''
    }
  });
};

const mineBlock = async (req, res) => {
  const transactions = await Transaction.find({ status: 'pending' }).limit(10);
  const previousBlock = await Block.findOne().sort({ index: -1 });
  const index = previousBlock ? previousBlock.index + 1 : 0;
  const previousHash = previousBlock ? previousBlock.hash : '0'.repeat(64);
  const timestamp = Date.now();
  const merkleRoot = Block.calculateMerkleRoot(transactions);
  let nonce = 0;
  let hash;
  const difficulty = 4;

  do {
    hash = Block.calculateHash(index, previousHash, timestamp, merkleRoot, nonce);
    nonce++;
  } while (!hash.startsWith('0'.repeat(difficulty)));

  const block = new Block({
    index,
    timestamp,
    transactions: transactions.map(tx => tx._id),
    transactionCount: transactions.length,
    previousHash,
    hash,
    nonce: nonce - 1,
    merkleRoot,
    difficulty
  });

  await block.save();
  for (const tx of transactions) {
    tx.status = 'confirmed';
    tx.blockId = block._id;
    await tx.save();
    const fromWallet = await Wallet.findOne({ address: tx.fromWallet });
    const toWallet = await Wallet.findOne({ address: tx.toWallet });
    fromWallet.balance -= (tx.amount + tx.fee);
    toWallet.balance += tx.amount;
    await fromWallet.save();
    await toWallet.save();
  }

  res.json({ success: true, data: block });
};

const validateChain = async (req, res) => {
  const blocks = await Block.find().sort({ index: 1 }).populate('transactions');
  let isValid = true;
  for (let i = 1; i < blocks.length; i++) {
    const current = blocks[i];
    const previous = blocks[i - 1];
    if (current.previousHash !== previous.hash || !current.hash.startsWith('0'.repeat(current.difficulty))) {
      isValid = false;
      break;
    }
    const merkleRoot = Block.calculateMerkleRoot(current.transactions);
    if (merkleRoot !== current.merkleRoot) {
      isValid = false;
      break;
    }
    for (const tx of current.transactions) {
      const wallet = await Wallet.findOne({ address: tx.fromWallet });
      const transactionData = {
        fromWallet: tx.fromWallet,
        toWallet: tx.toWallet,
        amount: tx.amount,
        fee: tx.fee,
        timestamp: tx.timestamp
      };
      const computedSignature = crypto.HmacSHA256(JSON.stringify(transactionData), wallet.privateKey).toString();
      if (computedSignature !== tx.signature) {
        isValid = false;
        break;
      }
    }
  }
  res.json({ success: true, data: { isValid } });
};

module.exports = { getBlocks, getBlock, getStatus, mineBlock, validateChain };