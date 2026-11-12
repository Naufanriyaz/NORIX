const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { sendOTP } = require('../services/emailService');
const { generateOTP } = require('../utils/otp');
const { hashOTP, getOTPExpiry } = require('../utils/otpHelpers');
const { validatePassword } = require('../utils/passwordValidator');

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const validation = validatePassword(password || '');

if (!validation.isValid) {
  return res.status(400).send(
    'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'
  );
}

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
      return res.status(400).send('Email and OTP are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      isVerified: false,
      otpPurpose: 'signup'
    });

    // Also search for forgot-password OTP
    const targetUser = user || await User.findOne({
      email: normalizedEmail,
      isVerified: true,
      otpPurpose: 'forgotPassword'
    });

    if (!targetUser) {
      return res.status(404).send('Verification request not found');
    }

    if (!targetUser.otp || !targetUser.otpExpiry ||
        targetUser.otpExpiry <= new Date()) {
      return res.status(400).send('OTP expired');
    }

    if (targetUser.otpAttempts >= 5) {
      return res.status(429).send('Too many incorrect attempts');
    }

    const submittedHash = hashOTP(otp);

  if (submittedHash !== targetUser.otp) {
  targetUser.otpAttempts += 1;
  await targetUser.save();

  const status = targetUser.otpAttempts >= 5
    ? 'locked'
    : 'invalid';

  return res.redirect(
    `/verify-otp?email=${encodeURIComponent(normalizedEmail)}&status=${status}`
  );
}

    // Signup verification
    if (targetUser.otpPurpose === 'signup') {
      targetUser.isVerified = true;
      targetUser.otp = null;
      targetUser.otpExpiry = null;
      targetUser.otpAttempts = 0;
      targetUser.otpPurpose = null;

      await targetUser.save();

      return res.redirect('/login');
    }

    // Forgot password verification
    targetUser.otp = null;
    targetUser.otpExpiry = null;
    targetUser.otpAttempts = 0;
    targetUser.otpPurpose = null;

    await targetUser.save();

    req.session.passwordResetUserId = targetUser._id.toString();

    return req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Unable to save verification session');
      }

      return res.redirect('/reset-password');
    });

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

    // Find pending signup or forgot-password request
    const user = await User.findOne({
      email,
      $or: [
        { isVerified: false, otpPurpose: 'signup' },
        { isVerified: true, otpPurpose: 'forgotPassword' }
      ]
    });

    if (!user) {
      return res.status(404).send('OTP request not found');
    }

    // Generate a new OTP
    const otp = generateOTP();

    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    user.otpAttempts = 0;

    await user.save();

    // Send new OTP
    await sendOTP(email, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(email)}`
    );

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).send('Unable to resend OTP');
  }
};


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send('Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find registered and verified user
    const user = await User.findOne({
      email: normalizedEmail,
      isVerified: true
    });

    if (!user) {
      return res.status(404).render('user/forgot-password', {
        title: 'Forgot Password | NORIX',
        error: 'No verified account found with this email'
      });
    }

    // Generate new OTP
    const otp = generateOTP();

    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    user.otpAttempts = 0;
    user.otpPurpose = 'forgotPassword';

    await user.save();

    // Send OTP email
    await sendOTP(normalizedEmail, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).send('Unable to process forgot password');
  }
};



const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    // Check temporary reset permission
    if (!req.session.passwordResetUserId) {
      return res.redirect('/forgot-password');
    }

    const user = await User.findById(req.session.passwordResetUserId);

    if (!user) {
      return res.redirect('/forgot-password');
    }

    // Check required fields
    if (!password || !confirmPassword) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'All fields are required'
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'Passwords do not match'
      });
    }

    // Validate password strength
    const validation = validatePassword(password);

    if (!validation.isValid) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    // Check whether new password matches the old password
    const isSamePassword = await bcrypt.compare(
      password,
      user.password
    );

    if (isSamePassword) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'New password cannot be the same as your current password'
      });
    }

    // Hash and update new password
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    // Remove temporary reset permission
    delete req.session.passwordResetUserId;

    return req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Unable to complete password reset');
      }

      return res.redirect('/login');
    });

  } catch (error) {
    console.error('Reset password error:', error);

    return res.status(500).render('user/reset-password', {
      title: 'Reset Password | NORIX',
      error: 'Unable to reset password'
    });
  }
};


const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // Check required fields
    if (!name || !phone) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user: await User.findById(req.session.userId),
        error: 'All fields are required'
      });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    // Validate name
    if (trimmedName.length < 3 || !/^[A-Za-z ]+$/.test(trimmedName)) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user: await User.findById(req.session.userId),
        error: 'Enter a valid name with at least 3 characters'
      });
    }

    // Validate Indian phone number
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user: await User.findById(req.session.userId),
        error: 'Enter a valid 10-digit Indian mobile number'
      });
    }

    // Find logged-in user
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    // Update profile information
    user.name = trimmedName;
    user.phone = trimmedPhone;

    await user.save();

    return res.redirect('/profile');

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).send('Unable to update profile');
  }
};



const uploadProfileImage = async (req, res) => {
  let newImagePath;

  try {
    if (!req.file) {
      return res.redirect('/profile');
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/login');
    }

    // Store the new image path
    const oldImage = user.profileImage;

    user.profileImage = `/uploads/profiles/${req.file.filename}`;

    await user.save();

    // Delete the old image after successful database update
    if (oldImage && oldImage.startsWith('/uploads/profiles/')) {
      const oldImagePath = path.join(
        __dirname,
        '../public',
        oldImage.replace(/^\/+/, '')
      );

      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    return res.redirect('/profile');

  } catch (error) {
    console.error('Profile image upload error:', error);

    // Delete newly uploaded file if something fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).send('Unable to upload profile image');
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
  forgotPassword,
  resetPassword,
  login,
  logout,
  updateProfile,
  uploadProfileImage
};