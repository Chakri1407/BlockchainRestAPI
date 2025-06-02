const request = require('supertest');
  const app = require('../src/app');
  const mongoose = require('mongoose');
  const User = require('../src/models/User');

  describe('Auth API', () => {
    let server;

    beforeAll(async () => {
      await mongoose.connect(process.env.MONGODB_URI);
      server = app.listen(0); // Use port 0 to let the OS assign an available port
    });

    beforeEach(async () => {
      await User.deleteMany({});
    });

    afterAll(async () => {
      await mongoose.connection.close();
      server.close();
    });

    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser', email: 'test@example.com', password: 'password123', role: 'user' });
        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.username).toEqual('testuser');
        expect(res.body.data.email).toEqual('test@example.com');
        expect(res.body.data.role).toEqual('user');
      });

      it('should fail to register with duplicate email', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser', email: 'test@example.com', password: 'password123', role: 'user' });
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser2', email: 'test@example.com', password: 'password123', role: 'user' });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toEqual('Email already exists');
      });

      it('should fail to register with invalid email', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser', email: 'invalid-email', password: 'password123', role: 'user' });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toBeDefined();
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login and return tokens for valid credentials', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser', email: 'test@example.com', password: 'password123', role: 'user' });
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' });
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('accessToken');
        expect(res.body.data).toHaveProperty('refreshToken');
        expect(res.body.data.email).toEqual('test@example.com');
      });

      it('should fail to login with wrong password', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({ username: 'testuser', email: 'test@example.com', password: 'password123', role: 'user' });
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrongpassword' });
        expect(res.statusCode).toEqual(401);
        expect(res.body.error).toEqual('Invalid credentials');
      });

      it('should fail to login with non-existent email', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'nonexistent@example.com', password: 'password123' });
        expect(res.statusCode).toEqual(401);
        expect(res.body.error).toEqual('Invalid credentials');
      });
    });
  });