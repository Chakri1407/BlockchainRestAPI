Blockchain REST API
Setup

Clone the repository.
Install dependencies: npm install.
Set up .env with MongoDB URI and JWT secrets.
Start MongoDB and run: npm start.

API Endpoints
Authentication

POST /api/auth/register: Register a new user.
Body: { "username": "string", "email": "string", "password": "string" }
Response: { "success": true, "data": { "id": "string", "username": "string", "email": "string" } }


POST /api/auth/login: Login and get tokens.
Body: { "email": "string", "password": "string" }
Response: { "success": true, "data": { "accessToken": "string", "refreshToken": "string" } }



Wallets

POST /api/wallets: Create a new wallet (protected).
Header: Authorization: Bearer <token>
Body: { "metadata": { "name": "string", "description": "string" } }
Response: { "success": true, "data": { "address": "string", "publicKey": "string", "balance": 0 }, "user": { "id": "string", "username": "string", "role": "string" } }



Database Schema

User: { _id, username, email, password, role, profile, refreshTokens, isActive, createdAt, updatedAt }

Wallet: { _id, userId, address, publicKey, privateKey, balance, metadata, createdAt, updatedAt }
