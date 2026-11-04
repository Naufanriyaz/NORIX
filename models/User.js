
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      default: ''
    },
    profileImage: {
      type: String,
      default: ''
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    otp: {
      type: String,
      default: null
    },
    otpExpiry: {
      type: Date,
      default: null
    },
    otpAttempts: {
      type: Number,
      default: 0
    },
    otpPurpose: {
  type: String,
  enum: ['signup', 'forgotPassword'],
  default: null
}
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
