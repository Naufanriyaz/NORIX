
const express = require('express');
const User = require('../models/User');
const router = express.Router();

const {
  signup,
  login,
  logout,
  verifyOTP,
  resendOTP
} = require('../controllers/userController');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

router.get('/verify-otp', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.redirect('/signup');
  }

  try {
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      isVerified: false,
      otpPurpose: 'signup'
    });

    if (!user) {
      return res.redirect('/signup');
    }

   res.render('user/verify-otp', {
  email,
  otpExpiry: user.otpExpiry,
  status: req.query.status || null,
  otpLocked: user.otpAttempts >= 5
});

  } catch (error) {
    console.error('OTP page error:', error);
    res.status(500).send('Unable to load OTP page');
  }
});

module.exports = router;
