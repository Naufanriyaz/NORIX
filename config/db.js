const mongoose = require('mongoose');

const connectDB = async () => {
  console.log('Checking MongoDB connection...');
  console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

  try {
    await mongoose.connect(
      process.env.MONGODB_URI,
      { serverSelectionTimeoutMS: 5000 }
    );

    console.log('MongoDB connected successfully!');
  } catch (error) {
    console.error('MongoDB connection failed:');
    console.error(error.message);
    throw error;
  }
};

module.exports = connectDB;