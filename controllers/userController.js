const User = require('../models/User');
const bcrypt = require('bcrypt');
const { sendOTP } = require('../services/emailService');
const { generateOTP } = require('../utils/otp');
const { hashOTP, getOTPExpiry } = require('../utils/otpHelpers');

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).send('All fields are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing verified account
    const existingUser = await User.findOne({
      email: normalizedEmail,
      isVerified: true
    });

    if (existingUser) {
      return res.status(409).send('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);

    // Create or update unverified user
    await User.findOneAndUpdate(
      { email: normalizedEmail, isVerified: false },
      {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        otp: hashedOTP,
        otpExpiry: getOTPExpiry(),
        otpAttempts: 0,
        otpPurpose: 'signup'
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Send OTP email
    await sendOTP(normalizedEmail, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`
    );

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).send('Unable to process signup');
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(email || '')}&status=missing`
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      isVerified: false,
      otpPurpose: 'signup'
    });

    if (!user) {
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(normalizedEmail)}&status=notfound`
      );
    }

    if (!user.otp || !user.otpExpiry || user.otpExpiry <= new Date()) {
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(normalizedEmail)}&status=expired`
      );
    }

    if (user.otpAttempts >= 5) {
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(normalizedEmail)}&status=locked`
      );
    }

    const submittedHash = hashOTP(otp);

    if (submittedHash !== user.otp) {
      user.otpAttempts += 1;
      await user.save();

      const status = user.otpAttempts >= 5 ? 'locked' : 'invalid';

      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(normalizedEmail)}&status=${status}`
      );
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    user.otpPurpose = null;

    await user.save();

    return res.redirect('/login');

  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).send('Unable to verify OTP');
  }
};

const resendOTP = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).send('Email is required');
    }

    const user = await User.findOne({
      email,
      isVerified: false,
      otpPurpose: 'signup'
    });

    if (!user) {
      return res.status(404).send('Signup request not found');
    }

    const otp = generateOTP();

    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    user.otpAttempts = 0;

    await user.save();

    await sendOTP(email, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(email)}`
    );

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).send('Unable to resend OTP');
  }

  
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).render('user/login', {
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(401).render('user/login', {
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatch) {
     console.log(`Failed login attempt: ${normalizedEmail}`);
      return res.status(401).render('user/login', {
        error: 'Invalid email or password'
      });
    }

    // Check email verification
    if (!user.isVerified) {
      return res.status(403).render('user/login', {
        error: 'Please verify your email before logging in'
      });
    }

    // Check blocked account
    if (user.isBlocked) {
      return res.status(403).render('user/login', {
        error: 'Your account has been blocked'
      });
    }

    // Regenerate session to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session error:', err);
        return res.status(500).send('Unable to create session');
      }

      req.session.userId = user._id.toString();

      return req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).send('Unable to save session');
        }

        return res.redirect('/');
      });
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).render('user/login', {
      error: 'Unable to process login'
    });
  }
};


const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Unable to logout');
    }

    res.clearCookie('connect.sid');
    return res.redirect('/login');
  });
};

module.exports = {
  signup,
  verifyOTP,
  resendOTP,
  login,
  logout
};