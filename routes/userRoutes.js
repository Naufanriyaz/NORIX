
const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middlewares/auth');
const {
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress
} = require('../controllers/addressController');
const {
  uploadProfileImage: profileImageUpload,
  verifyProfileImage
} = require('../config/multer');
const router = express.Router();

const {
  signup,
  login,
  logout,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  updateProfile,
  uploadProfileImage
} = require('../controllers/userController');



const handleProfileImageUpload = (req, res, next) => {
  profileImageUpload.single('profileImage')(req, res, (error) => {
    if (error) {
      return res.redirect(
        `/profile?uploadError=${encodeURIComponent(error.message)}`
      );
    }

    next();
  });
};

const handleImageVerificationError = (error, req, res, next) => {
  if (error) {
    return res.redirect(
      `/profile?uploadError=${encodeURIComponent(error.message)}`
    );
  }

  next();
};



router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/profile/edit', requireAuth, updateProfile);
router.post('/addresses', requireAuth, addAddress);
router.post('/addresses/:id/edit', requireAuth, editAddress);
router.post('/addresses/:id/delete', requireAuth, deleteAddress);
router.post(
  '/addresses/:id/default',
  requireAuth,
  setDefaultAddress
);
router.post(
  '/profile/upload-image',
  requireAuth,
  handleProfileImageUpload,
  verifyProfileImage,
  uploadProfileImage
);
router.post('/logout', logout);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);


router.get('/verify-otp', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.redirect('/signup');
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
      otpPurpose: { $in: ['signup', 'forgotPassword'] }
    });

    if (!user) {
      return res.redirect('/signup');
    }

    res.render('user/verify-otp', {
      email: normalizedEmail,
      otpExpiry: user.otpExpiry,
      status: req.query.status || null,
      otpLocked: user.otpAttempts >= 5,
      otpPurpose: user.otpPurpose
    });

  } catch (error) {
    console.error('OTP page error:', error);
    res.status(500).send('Unable to load OTP page');
  }
});

router.get('/reset-password', (req, res) => {
  
  if (!req.session.passwordResetUserId) {
    return res.redirect('/forgot-password');
  }

  res.render('user/reset-password', {
    title: 'Reset Password | NORIX',
    error: null
  });
});

// EDIT PROFILE PAGE
router.get('/profile/edit', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select('name email phone profileImage createdAt');

    if (!user) {
      return res.redirect('/login');
    }

    res.render('user/edit-profile', {
      title: 'NORIX | Edit Profile',
      user,
      cartCount: 0,
      wishlistCount: 0
    });

  } catch (error) {
    console.error('Edit profile page error:', error);
    res.status(500).send('Unable to load edit profile page');
  }
});


router.get('/addresses/new', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId)
    .select('name email profileImage');

  if (!user) {
    return res.redirect('/login');
  }

  res.render('user/add-address', {
    title: 'NORIX | Add Address',
    user,
    cartCount: 0,
    wishlistCount: 0
  });
});

router.get('/addresses', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select('name email profileImage addresses');

    if (!user) {
      return res.redirect('/login');
    }

    res.render('user/addresses', {
      title: 'NORIX | My Addresses',
      user,
      cartCount: 0,
      wishlistCount: 0
    });

  } catch (error) {
    console.error('Load addresses error:', error);
    res.redirect('/profile');
  }
});

router.get('/addresses/:id/edit', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select('name email profileImage addresses');

    if (!user) {
      return res.redirect('/login');
    }

    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.redirect('/addresses');
    }

    res.render('user/edit-address', {
      title: 'NORIX | Edit Address',
      user,
      address,
      cartCount: 0,
      wishlistCount: 0
    });

  } catch (error) {
    console.error('Load edit address error:', error);
    res.redirect('/addresses');
  }
});
module.exports = router;
