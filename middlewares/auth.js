
const User = require('../models/User');

// Remove only the selected login from the session
const removeSessionIdentity = (req, res, sessionKey, redirectUrl) => {
  if (!req.session) {
    return res.redirect(redirectUrl);
  }

  delete req.session[sessionKey];

  req.session.save((error) => {
    if (error) {
      console.error('Session save error:', error);
      return res.status(500).send('Unable to update session');
    }

    return res.redirect(redirectUrl);
  });
};


// Customer authentication
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.userId)
      .select('_id isBlocked role');

    if (!user || user.isBlocked || user.role === 'admin') {
      return removeSessionIdentity(
        req,
        res,
        'userId',
        '/login?status=blocked'
      );
    }

    req.user = user;
    return next();

  } catch (error) {
    console.error('Customer authentication error:', error);
    return res.status(500).send('Something went wrong');
  }
};


// Guest-only pages
const guestOnly = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }

  return next();
};


// Admin authentication
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.session || !req.session.adminId) {
      return res.redirect('/admin/login');
    }

    const admin = await User.findById(req.session.adminId)
      .select('_id role isBlocked name email');

    if (!admin || admin.role !== 'admin' || admin.isBlocked) {
      return removeSessionIdentity(
        req,
        res,
        'adminId',
        '/admin/login'
      );
    }

    req.admin = admin;
    return next();

  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(500).send('Something went wrong');
  }
};


module.exports = {
  requireAuth,
  guestOnly,
  requireAdmin
};
