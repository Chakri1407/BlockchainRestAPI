const express = require('express');
const { getBlocks, getBlock, getStatus, mineBlock, validateChain } = require('../controllers/blockchain');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/blocks', getBlocks);
router.get('/blocks/:blockId', getBlock);
router.get('/status', getStatus);
router.post('/mine', authenticateToken, requireAdmin, mineBlock);
router.get('/validate', authenticateToken, requireAdmin, validateChain);

module.exports = router;