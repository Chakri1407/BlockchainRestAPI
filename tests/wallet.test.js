const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');

describe('Wallet API', () => {
  let accessToken;
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Wallet.deleteMany({});

    // Register and login a user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@example.com', password: 'password123', role: 'user' });
    userId = registerRes.body.data.user.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/wallets', () => {
    it('should create a wallet for the authenticated user', async () => {
      const res = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('address');
      expect(res.body.data.userId).toEqual(userId);
    });

    it('should fail to create wallet without authentication', async () => {
      const res = await request(app)
        .post('/api/wallets')
        .send();
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toEqual('No token provided');
    });
  });

  describe('POST /api/wallets/:id/fund', () => {
    let walletId;

    beforeEach(async () => {
      const walletRes = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();
      walletId = walletRes.body.data._id;
    });

    it('should fund the wallet successfully', async () => {
      const res = await request(app)
        .post(`/api/wallets/${walletId}/fund`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 100 });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction).toHaveProperty('amount', 100);
      expect(res.body.data.transaction.status).toEqual('confirmed');
    });

    it('should fail to fund with invalid wallet ID', async () => {
      const res = await request(app)
        .post('/api/wallets/invalid-id/fund')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 100 });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });

    it('should fail to fund with negative amount', async () => {
      const res = await request(app)
        .post(`/api/wallets/${walletId}/fund`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: -50 });
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/wallets/:id/balance', () => {
    let walletId;

    beforeEach(async () => {
      const walletRes = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();
      walletId = walletRes.body.data._id;

      await request(app)
        .post(`/api/wallets/${walletId}/fund`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 100 });
    });

    it('should get wallet balance successfully', async () => {
      const res = await request(app)
        .get(`/api/wallets/${walletId}/balance`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toEqual(100);
    });

    it('should fail to get balance with invalid wallet ID', async () => {
      const res = await request(app)
        .get('/api/wallets/invalid-id/balance')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });
});