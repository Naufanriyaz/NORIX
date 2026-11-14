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
    const { name, email, password, termsAccepted } = req.body;

    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).render('user/signup', {
        title: 'Create Account | NORIX',
        error: 'Please complete all required fields.'
      });
    }

    // Check terms acceptance
    if (termsAccepted !== 'true') {
      return res.status(400).render('user/signup', {
        title: 'Create Account | NORIX',
        error: 'Please accept the Terms & Conditions and Privacy Policy.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing verified account
    const existingUser = await User.findOne({
      email: normalizedEmail,
      isVerified: true
    });

    if (existingUser) {
      return res.status(409).render('user/signup', {
        title: 'Create Account | NORIX',
        error: 'This email is already registered. Please login to your NORIX account.'
      });
    }

    // Validate password
    const validation = validatePassword(password);

    if (!validation.isValid) {
      return res.status(400).render('user/signup', {
        title: 'Create Account | NORIX',
        error: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);

    // Create or update unverified user
    await User.findOneAndUpdate(
      {
        email: normalizedEmail,
        isVerified: false
      },
      {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        otp: hashedOTP,
        otpExpiry: getOTPExpiry(),
        otpAttempts: 0,
        otpPurpose: 'signup'
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    // Send OTP email
    await sendOTP(normalizedEmail, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`
    );

  } catch (error) {
    console.error('Signup error:', error);

    return res.status(500).render('user/signup', {
      title: 'Create Account | NORIX',
      error: 'Unable to process signup. Please try again.'
    });
  }
};


const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).send('Email and OTP are required');
    }

    const normalizedEmail = email.trim().toLowerCase();

   const targetUser = await User.findOne({
  email: normalizedEmail,
  $or: [
    { isVerified: false, otpPurpose: 'signup' },
    {
      isVerified: true,
      otpPurpose: { $in: ['forgotPassword', 'emailChange'] }
    }
  ]
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

    // Email change verification
// Email change verification
if (targetUser.otpPurpose === 'emailChange') {

  if (!targetUser.pendingEmail) {
    return res.status(400).send('Email change request not found');
  }

  // Check whether the new email is already registered
  const existingUser = await User.findOne({
    email: targetUser.pendingEmail,
    _id: { $ne: targetUser._id }
  });

  if (existingUser) {
    targetUser.otp = null;
    targetUser.otpExpiry = null;
    targetUser.otpAttempts = 0;
    targetUser.otpPurpose = null;
    targetUser.pendingEmail = null;

    await targetUser.save();

    return res.status(400).send('This email is already registered');
  }

  // Update email only after successful OTP verification
  targetUser.email = targetUser.pendingEmail;
  targetUser.pendingEmail = null;

  // Clear OTP information
  targetUser.otp = null;
  targetUser.otpExpiry = null;
  targetUser.otpAttempts = 0;
  targetUser.otpPurpose = null;

  await targetUser.save();

  return res.redirect('/profile?emailChanged=true');
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

    // Find pending signup, forgot-password or email-change request
    const user = await User.findOne({
      email,
      $or: [
        { isVerified: false, otpPurpose: 'signup' },
        { isVerified: true, otpPurpose: 'forgotPassword' },
        { isVerified: true, otpPurpose: 'emailChange' }
      ]
    });

    if (!user) {
      return res.status(404).send('OTP request not found');
    }

    // Generate new OTP
    const otp = generateOTP();

    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    user.otpAttempts = 0;

    await user.save();

    // Send OTP to the correct email address
    const recipient = user.otpPurpose === 'emailChange'
      ? user.pendingEmail
      : user.email;

    if (!recipient) {
      return res.status(400).send('Email verification request not found');
    }

    await sendOTP(recipient, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(user.email)}`
    );

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).send('Unable to resend OTP');
  }
};




const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check empty email
    if (!email || !email.trim()) {
      return res.status(400).render('user/forgot-password', {
        title: 'Forgot Password | NORIX',
        error: 'Please enter your registered email address.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).render('user/forgot-password', {
        title: 'Forgot Password | NORIX',
        error: 'Please enter a valid email address.'
      });
    }

    // Find registered and verified user
    const user = await User.findOne({
      email: normalizedEmail,
      isVerified: true
    });

    if (!user) {
      return res.status(404).render('user/forgot-password', {
        title: 'Forgot Password | NORIX',
        error: 'No verified account found with this email.'
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

    // Redirect to OTP verification
    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`
    );

  } catch (error) {
    console.error('Forgot password error:', error);

    return res.status(500).render('user/forgot-password', {
      title: 'Forgot Password | NORIX',
      error: 'Unable to process your request. Please try again.'
    });
  }
};





const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    // Check temporary reset permission
    if (!req.session.passwordResetUserId) {
      return res.redirect('/forgot-password');
    }

    const user = await User.findById(
      req.session.passwordResetUserId
    );

    if (!user) {
      delete req.session.passwordResetUserId;
      return res.redirect('/forgot-password');
    }

    // Check required fields
    if (!password || !confirmPassword) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'Please complete all required fields.'
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.status(400).render('user/reset-password', {
        title: 'Reset Password | NORIX',
        error: 'Your passwords do not match.'
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

    // Check old password only if the user already has one
    if (user.password) {
      const isSamePassword = await bcrypt.compare(
        password,
        user.password
      );

      if (isSamePassword) {
        return res.status(400).render('user/reset-password', {
          title: 'Reset Password | NORIX',
          error: 'New password cannot be the same as your current password.'
        });
      }
    }

    // Hash and update password
    user.password = await bcrypt.hash(password, 10);

    await user.save();

    // Remove temporary reset permission
    delete req.session.passwordResetUserId;

    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);

        return res.status(500).render('user/reset-password', {
          title: 'Reset Password | NORIX',
          error: 'Password was updated, but we could not complete the session cleanup. Please return to login.'
        });
      }

      return res.redirect('/login');
    });

  } catch (error) {
    console.error('Reset password error:', error);

    return res.status(500).render('user/reset-password', {
      title: 'Reset Password | NORIX',
      error: 'Unable to reset password. Please try again.'
    });
  }
};





const updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    console.log('EDIT PROFILE DATA:', req.body);
    console.log('SESSION USER ID:', req.session.userId);

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    // Validate required fields
    if (!name || !phone || !email) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user,
        error: 'All fields are required'
      });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Validate name
    if (trimmedName.length < 3 || !/^[A-Za-z ]+$/.test(trimmedName)) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user,
        error: 'Enter a valid name with at least 3 characters'
      });
    }

    // Validate phone
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user,
        error: 'Enter a valid 10-digit Indian mobile number'
      });
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).render('user/edit-profile', {
        title: 'NORIX | Edit Profile',
        user,
        error: 'Enter a valid email address'
      });
    }

    // Check whether email has changed
    const emailChanged = normalizedEmail !== user.email;

    console.log('CURRENT EMAIL:', user.email);
    console.log('NEW EMAIL:', normalizedEmail);
    console.log('EMAIL CHANGED:', emailChanged);

    if (emailChanged) {
      // Check whether another account uses this email
      const existingUser = await User.findOne({
        email: normalizedEmail
      });

      console.log('EXISTING USER:', existingUser);

      if (existingUser) {
        return res.status(400).render('user/edit-profile', {
          title: 'NORIX | Edit Profile',
          user,
          error: 'This email is already registered'
        });
      }

      // Generate OTP
      const otp = generateOTP();

      user.name = trimmedName;
      user.phone = trimmedPhone;
      user.pendingEmail = normalizedEmail;
      user.otp = hashOTP(otp);
      user.otpExpiry = getOTPExpiry();
      user.otpAttempts = 0;
      user.otpPurpose = 'emailChange';

      await user.save();

      console.log('USER SAVED WITH PENDING EMAIL');

      // Send OTP to new email
      await sendOTP(normalizedEmail, otp);

      console.log('OTP EMAIL SENT SUCCESSFULLY');

      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(user.email)}`
      );
    }

    // Normal profile update when email is unchanged
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

    if (!email || !password) {
      return res.status(400).render('user/login', {
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'user'
    });

    if (!user) {
      return res.status(401).render('user/login', {
        error: 'Invalid email or password'
      });
    }

    if (!user.password) {
      return res.render('user/login', {
        title: 'Login | NORIX',
        error: 'This account uses Google Login. Please continue with Google.'
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatch) {
      return res.status(401).render('user/login', {
        error: 'Invalid email or password'
      });
    }

    if (!user.isVerified) {
      return res.status(403).render('user/login', {
        error: 'Please verify your email before logging in'
      });
    }

    if (user.isBlocked) {
      return res.status(403).render('user/login', {
        error: 'Your account has been blocked'
      });
    }

    // Preserve admin identity before regenerating session
    const adminId = req.session.adminId;

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session error:', err);
        return res.status(500).send('Unable to create session');
      }

      // Restore admin identity
      if (adminId) {
        req.session.adminId = adminId;
      }

      // Set customer identity
      req.session.userId = user._id.toString();

      req.session.save((err) => {
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
  // Remove only customer identity
  delete req.session.userId;

  req.session.save((error) => {
    if (error) {
      console.error('Customer logout error:', error);
      return res.status(500).send('Unable to logout');
    }

    return res.redirect('/login');
  });
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // 1. Validate fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.redirect('/change-password?error=empty');
    }

    // 2. Find logged-in user
const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    // 3. Check current password
    if (!user.password) {
      return res.redirect('/change-password?error=google');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.redirect('/change-password?error=incorrect');
    }

    // 4. Check new password
    if (newPassword.length < 8 ||
        !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword) ||
        !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.redirect('/change-password?error=weak');
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/change-password?error=mismatch');
    }

    if (currentPassword === newPassword) {
      return res.redirect('/change-password?error=same');
    }

    // 5. Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.redirect('/profile?passwordChanged=true');

  } catch (error) {
    console.error('Change password error:', error);
    return res.redirect('/change-password?error=server');
  }
};

const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    const normalizedEmail = email?.trim().toLowerCase();

    // Validate email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !emailPattern.test(normalizedEmail)) {
      return res.status(400).render('user/update-email', {
        title: 'NORIX | Update Email',
        user,
        error: 'Please enter a valid email address',
        cartCount: 0,
        wishlistCount: 0
      });
    }

    if (normalizedEmail === user.email) {
      return res.status(400).render('user/update-email', {
        title: 'NORIX | Update Email',
        user,
        error: 'This is already your registered email',
        cartCount: 0,
        wishlistCount: 0
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(400).render('user/update-email', {
        title: 'NORIX | Update Email',
        user,
        error: 'This email is already registered',
        cartCount: 0,
        wishlistCount: 0
      });
    }

    const otp = generateOTP();

    user.pendingEmail = normalizedEmail;
    user.otp = hashOTP(otp);
    user.otpExpiry = getOTPExpiry();
    user.otpAttempts = 0;
    user.otpPurpose = 'emailChange';

    await user.save();

    await sendOTP(normalizedEmail, otp);

    return res.redirect(
      `/verify-otp?email=${encodeURIComponent(user.email)}`
    );

  } catch (error) {
    console.error('Update email error:', error);
    return res.status(500).send('Unable to process email update');
  }
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
  updateEmail,
  uploadProfileImage,
  changePassword
};