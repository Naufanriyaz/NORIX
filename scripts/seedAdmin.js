
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const createOrUpdateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('Admin credentials are missing in .env');
    }

    if (adminPassword.length < 8) {
      throw new Error('Admin password must be at least 8 characters.');
    }

    // Check whether the email belongs to another account
    const emailExists = await User.findOne({
      email: adminEmail,
      role: { $ne: 'admin' }
    });

    if (emailExists) {
      throw new Error('This email is already used by a customer account.');
    }

    // Find the existing admin account
    let admin = await User.findOne({ role: 'admin' });

    // Generate a fresh bcrypt hash
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (admin) {
      admin.email = adminEmail;
      admin.password = hashedPassword;
      admin.name = 'NORIX Admin';
      admin.isVerified = true;

      await admin.save();

      console.log('Admin email and password updated successfully!');
    } else {
      await User.create({
        name: 'NORIX Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        authProvider: 'local',
        isVerified: true,
        isBlocked: false
      });

      console.log('Admin account created successfully!');
    }

  } catch (error) {
    console.error('Admin setup failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

createOrUpdateAdmin();
