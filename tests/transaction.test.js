const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');

describe('Transaction API', () => {
  let user1AccessToken, user2AccessToken;
  let user1Id, user2Id;
  let wallet1Id, wallet2Id, wallet1Address, wallet2Address;

  beforeAll(async counter = 0;
  async () => {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Wallet.deleteMany({});
    await Transaction.deleteMany({});

    // Register user1
    const user1Res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user1', email: 'user1@example.com', password: 'password123', role: 'user' });
    user1Id = user1Res.body.data.user.id;
    const user1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@example.com', password: 'password123' });
    user1AccessToken = user1Login.body.data.accessToken;

    // Register user2
    const user2Res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user2', email: 'user2@example.com', password: 'password123', role: 'user' });
    user2Id = user2Res.body.data.user.id;
    const user2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user2@example.com', password: 'password123' });
    user2AccessToken = user2Login.body.data.accessToken;

    // Create wallet for user1
    const wallet1Res = await request(app)
      .post('/api/wallets')
      .set('Authorization', `Bearer ${user1AccessToken}`)
      .send();
    wallet1Id = wallet1Res.body.data._id;
    wallet1Address = wallet1Res.body.data.address;
    await request(app)
      .post(`/api/wallets/${wallet1Id}/fund`)
      .set('Authorization', `Bearer ${user1AccessToken}`)
      .send({ amount: 200 });

    // Create wallet for user2
    const wallet2Res = await request(app)
      .post('/api/wallets')
      .set('Authorization', `Bearer ${user2AccessToken}`)
      .send();
    wallet2Id = wallet2Res.body.data._id;
    wallet2Address = wallet2Res.body.data.address;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/transactions/:walletId', () => {
    it('should create a transaction successfully', async () => {
      const res = await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 50 });
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('fromWallet', wallet1Address);
      expect(res.body.data).toHaveProperty('toWallet', wallet2Address);
      expect(res.body.data.amount).toEqual(50);
      expect(res.body.data.status).toEqual('pending');
    });

    it('should fail to create transaction with insufficient balance', async () => {
      const res = await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 300 });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toEqual('Insufficient balance');
    });

    it('should fail to create transaction with invalid recipient wallet', async () => {
      const res = await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: 'invalid-address', amount: 50 });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toEqual('Recipient wallet not found');
    });
  });

  describe('GET /api/transactions/:transactionId', () => {
    let transactionId;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 50 });
      transactionId = res.body.data._id;
    });

    it('should get transaction details successfully', async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionId}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toEqual(transactionId);
      expect(res.body.data.amount).toEqual(50);
    });

    it('should fail to get transaction with invalid ID', async () => {
      const res = await request(app)
        .get('/api/transactions/invalid-id');
      expect(res.statusCode).toEqual(404);
      expect(res.body.error).toEqual('Transaction not found');
    });
  });

  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 50 });
    });

    it('should list pending transactions', async () => {
      const res = await request(app)
        .get('/api/transactions?status=pending');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toEqual('pending');
    });

    it('should return empty list for non-existent status', async () => {
      const res = await request(app)
        .get('/api/transactions?status=confirmed');
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/transactions/wallet/:walletId', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 50 });
    });

    it('should get wallet transactions successfully', async () => {
      const res = await request(app)
        .get(`/api/transactions/wallet/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].fromWallet).toEqual(wallet1Address);
    });

    it('should fail to get wallet transactions without authentication', async () => {
      const res = await request(app)
        .get(`/api/transactions/wallet/${wallet1Id}`);
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual('No token provided');
    });
  });

  describe('POST /api/transactions/validate/:transactionId', () => {
    let transactionId;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/transactions/${wallet1Id}`)
        .set('Authorization', `Bearer ${user1AccessToken}`)
        .send({ toWallet: wallet2Address, amount: 50 });
      transactionId = res.body.data._id;
    });

    it('should validate transaction successfully', async () => {
      const res = await request(app)
        .post(`/api/transactions/validate/${transactionId}`)
        .set('Authorization', `Bearer ${user1AccessToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
    });

    it('should fail to validate with invalid transaction ID', async () => {
      const res = await request(app)
        .post('/api/transactions/validate/invalid-id')
        .set('Authorization', `Bearer ${user1AccessToken}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body.error).toEqual('Transaction not found');
    });
  });
});