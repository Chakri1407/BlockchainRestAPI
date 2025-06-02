const request = require('supertest');
  const app = require('../src/app');
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const Wallet = require('../src/models/Wallet');
  const Transaction = require('../src/models/Transaction');
  const Block = require('../src/models/Block');

  describe('Blockchain API', () => {
    let userAccessToken, adminAccessToken;
    let userId, adminId;
    let wallet1Id, wallet2Id, wallet1Address, wallet2Address;

    beforeAll(async () => {
      await mongoose.connect(process.env.MONGODB_URI);
    });

    beforeEach(async () => {
      await User.deleteMany({});
      await Wallet.deleteMany({});
      await Transaction.deleteMany({});
      await Block.deleteMany({});

      // Register user
      const userRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'user', email: 'user@example.com', password: 'password123', role: 'user' });
      userId = userRes.body.data.id;
      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });
      userAccessToken = userLogin.body.data.accessToken;

      // Register admin
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });
      adminId = adminRes.body.data.id;
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'admin123' });
      adminAccessToken = adminLogin.body.data.accessToken;

      // Create wallet for user
      const wallet1Res = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send();
      wallet1Id = wallet1Res.body.data._id;
      wallet1Address = wallet1Res.body.data.address;
      await request(app)
        .post(`/api/wallets/${wallet1Id}/fund`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ amount: 200 });

      // Create second wallet for user
      const wallet2Res = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send();
      wallet2Id = wallet2Res.body.data._id;
      wallet2Address = wallet2Res.body.data.address;
    });

    afterAll(async () => {
      await mongoose.connection.close();
    });

    describe('POST /api/blockchain/mine', () => {
      beforeEach(async () => {
        await request(app)
          .post(`/api/transactions/${wallet1Id}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ toWallet: wallet2Address, amount: 50 });
      });

      it('should mine a block successfully', async () => {
        const res = await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${adminAccessToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('index', 0);
        expect(res.body.data.transactions).toHaveLength(1);
        expect(res.body.data.hash).toMatch(/^0000/);
      });

      it('should fail to mine without admin privileges', async () => {
        const res = await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${userAccessToken}`);
        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toEqual('Admin access required');
      });
    });

    describe('GET /api/blockchain/status', () => {
      beforeEach(async () => {
        await request(app)
          .post(`/api/transactions/${wallet1Id}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ toWallet: wallet2Address, amount: 50 });
        await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${adminAccessToken}`);
      });

      it('should get blockchain status successfully', async () => {
        const res = await request(app)
          .get('/api/blockchain/status');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('blockCount', 1);
        expect(res.body.data).toHaveProperty('transactionCount', 2);
        expect(res.body.data).toHaveProperty('latestBlockHash');
      });

      it('should return zero counts for empty blockchain', async () => {
        await Block.deleteMany({});
        await Transaction.deleteMany({});
        const res = await request(app)
          .get('/api/blockchain/status');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('blockCount', 0);
        expect(res.body.data).toHaveProperty('transactionCount', 0);
        expect(res.body.data).toHaveProperty('latestBlockHash', '');
      });
    });

    describe('GET /api/blockchain/blocks', () => {
      beforeEach(async () => {
        await request(app)
          .post(`/api/transactions/${wallet1Id}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ toWallet: wallet2Address, amount: 50 });
        await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${adminAccessToken}`);
      });

      it('should list blocks successfully', async () => {
        const res = await request(app)
          .get('/api/blockchain/blocks');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toHaveProperty('index', 0);
      });

      it('should return empty list for no blocks', async () => {
        await Block.deleteMany({});
        const res = await request(app)
          .get('/api/blockchain/blocks');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(0);
      });
    });

    describe('GET /api/blockchain/blocks/:blockId', () => {
      let blockId;

      beforeEach(async () => {
        await request(app)
          .post(`/api/transactions/${wallet1Id}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ toWallet: wallet2Address, amount: 50 });
        const mineRes = await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${adminAccessToken}`);
        blockId = mineRes.body.data._id;
      });

      it('should get block details successfully', async () => {
        const res = await request(app)
          .get(`/api/blockchain/blocks/${blockId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data._id).toEqual(blockId);
        expect(res.body.data.transactions).toHaveLength(1);
      });

      it('should fail to get block with invalid ID', async () => {
        const res = await request(app)
          .get('/api/blockchain/blocks/invalid-id');
        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toEqual('Block not found');
      });
    });

    describe('GET /api/blockchain/validate', () => {
      let blockId;

      beforeEach(async () => {
        await request(app)
          .post(`/api/transactions/${wallet1Id}`)
          .set('Authorization', `Bearer ${userAccessToken}`)
          .send({ toWallet: wallet2Address, amount: 50 });
        const mineRes = await request(app)
          .post('/api/blockchain/mine')
          .set('Authorization', `Bearer ${adminAccessToken}`);
        blockId = mineRes.body.data._id;
      });

      it('should validate blockchain successfully', async () => {
        const res = await request(app)
          .get('/api/blockchain/validate')
          .set('Authorization', `Bearer ${adminAccessToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isValid).toBe(true);
      });

      it('should fail validation after tampering with a block', async () => {
        await Block.updateOne({ _id: blockId }, { $set: { hash: 'tampered-hash' } });
        const res = await request(app)
          .get('/api/blockchain/validate')
          .set('Authorization', `Bearer ${adminAccessToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isValid).toBe(false);
      });

      it('should fail to validate without admin privileges', async () => {
        const res = await request(app)
          .get('/api/blockchain/validate')
          .set('Authorization', `Bearer ${userAccessToken}`);
        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toEqual('Admin access required');
      });
    });
  });