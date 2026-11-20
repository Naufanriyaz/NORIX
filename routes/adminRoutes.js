
const express = require('express');
const router = express.Router();

const {
  adminLogin,
  adminLogout,
  getUsers,
  toggleUserStatus,
} = require('../controllers/adminController');

const { requireAdmin } = require('../middlewares/auth');

// Admin login page
router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }

  res.render('admin/login', {
    title: 'NORIX | Admin Login',
    error: req.query.error || null
  });
});

// Admin login submission
router.post('/login', adminLogin);

// Admin logout
router.post('/logout', requireAdmin, adminLogout);

// Protected admin dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    title: 'NORIX | Admin Dashboard',
    admin: req.admin
  });
});

// Admin user management
router.get('/users', requireAdmin, getUsers);

// Block / Unblock customer
router.post(
  '/users/:userId/toggle-status',
  requireAdmin,
  toggleUserStatus
);


module.exports = router;
