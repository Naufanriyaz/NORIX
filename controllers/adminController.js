
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect('/admin/login?error=empty');
    }

    const admin = await User.findOne({
      email: email.trim().toLowerCase(),
      role: 'admin'
    });

    if (!admin) {
      return res.redirect('/admin/login?error=invalid');
    }

    if (admin.isBlocked) {
      return res.redirect('/admin/login?error=blocked');
    }

    if (!admin.password) {
      return res.redirect('/admin/login?error=invalid');
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.redirect('/admin/login?error=invalid');
    }

    if (!admin.isVerified) {
      return res.redirect('/admin/login?error=unverified');
    }

    // Preserve customer identity
    req.session.adminId = admin._id.toString();

    req.session.save((error) => {
      if (error) {
        console.error('Admin session save error:', error);
        return res.redirect('/admin/login?error=server');
      }

      return res.redirect('/admin/dashboard');
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.redirect('/admin/login?error=server');
  }
};


// Admin logout
const adminLogout = (req, res) => {
  // Remove only admin identity
  delete req.session.adminId;

  req.session.save((error) => {
    if (error) {
      console.error('Admin logout error:', error);
      return res.status(500).send('Unable to logout');
    }

    return res.redirect('/admin/login');
  });
};


// Get customers
const getUsers = async (req, res) => {
  try {
    const search = req.query.search?.trim() || '';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;

    const filter = {
      role: { $ne: 'admin' }
    };

    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const totalUsers = await User.countDocuments(filter);

    const totalPages = Math.ceil(totalUsers / limit);

    const currentPage = totalPages
      ? Math.min(page, totalPages)
      : 1;

    const users = await User.find(filter)
      .select('-password -otp')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    return res.render('admin/users', {
      title: 'NORIX | User Management',
      admin: req.admin,
      users,
      search,
      currentPage,
      totalPages,
      totalUsers
    });

  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).send('Unable to load users');
  }
};


// Block / Unblock customer
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({
      _id: userId,
      role: { $ne: 'admin' }
    });

    if (!user) {
      return res.status(404).send('Customer not found');
    }

    user.isBlocked = !user.isBlocked;

    await user.save();

    const page = Math.max(
      1,
      parseInt(req.body.page, 10) || 1
    );

    const search = req.body.search || '';

    const params = new URLSearchParams({
      page: String(page),
      search
    });

    return res.redirect(`/admin/users?${params.toString()}`);

  } catch (error) {
    console.error('Toggle user status error:', error);
    return res.status(500).send('Unable to update customer status');
  }
};


module.exports = {
  adminLogin,
  adminLogout,
  getUsers,
  toggleUserStatus
};
