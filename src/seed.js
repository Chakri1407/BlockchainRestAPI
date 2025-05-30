const mongoose = require('mongoose');
const User = require('./models/User');
const Wallet = require('./models/Wallet');
const bcrypt = require('bcrypt');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteMany({});
  await Wallet.deleteMany({});

  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = new User({ username: 'admin', email: 'admin@example.com', password: hashedPassword, role: 'admin' });
  await admin.save();

  const { address, publicKey, privateKey } = await Wallet.generateWallet(admin._id);
  const wallet = new Wallet({ userId: admin._id, address, publicKey, privateKey, balance: 100 });
  await wallet.save();

  console.log('Database seeded');
  mongoose.connection.close();
}

seed();