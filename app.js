
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const User = require('./models/User');
const { requireAuth, guestOnly } = require('./middlewares/auth');
const passport = require('passport');
const configurePassport = require('./config/passport');

const app = express();
configurePassport(passport);
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));



// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    }
  })
);

app.use(passport.initialize());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use('/', userRoutes);
app.use('/admin', adminRoutes);


// Home page
app.get('/', async (req, res) => {
  try {
    let user = null;

    if (req.session.userId) {
      user = await User.findById(req.session.userId)
        .select('name email profileImage');
    }

    res.render('user/home', {
      title: 'NORIX | Gaming Store',
      user,
      cartCount: 0,
      wishlistCount: 0
    });

  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).send('Unable to load home page');
  }
});

// Login page
app.get('/login', guestOnly, (req, res) => {
  let error = null;

  if (req.query.error === 'google') {
    error = 'Unable to login with Google. Your account may be blocked or Google authentication failed.';
  }

  res.render('user/login', {
    title: 'Login | NORIX',
    error
  });
});

// Signup page
app.get('/signup', guestOnly, (req, res) => {
  res.render('user/signup', {
    title: 'Create Account | NORIX',
    error: null
  });
});



app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select('name email phone profileImage');

    if (!user) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
      return;
    }

 res.render('user/profile', {
  title: 'NORIX | My Profile',
  user,
  cartCount: 0,
  wishlistCount: 0,
  uploadError: req.query.uploadError || null
});

  } catch (error) {
    console.error('Profile page error:', error);
    res.status(500).send('Unable to load profile');
  }
});


app.get('/forgot-password', guestOnly, (req, res) => {
  res.render('user/forgot-password', {
    title: 'Forgot Password | NORIX',
    error: null
  });
});


// Connect MongoDB and start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`NORIX server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Server startup failed:', error.message);
  });
