
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  next();
};

const guestOnly = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }

  next();
};

module.exports = {
  requireAuth,
  guestOnly
};
