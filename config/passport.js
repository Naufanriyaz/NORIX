
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // 1. Get Google email
          const googleEmail = profile.emails?.[0];

          // 2. Check whether Google email is verified
          if (!googleEmail || googleEmail.verified !== true) {
            return done(null, false);
          }

          const email = googleEmail.value.toLowerCase();

          // 3. Find user using Google ID
          let user = await User.findOne({
            googleId: profile.id
          });

          // 4. If Google ID is not found, check email
          if (!user) {
            user = await User.findOne({ email });

            if (user) {
              // Prevent linking a different Google account
              if (user.googleId && user.googleId !== profile.id) {
                return done(null, false);
              }

              // Link existing NORIX account
              user.googleId = profile.id;
              await user.save();

            } else {
              // 5. Create new Google user
              user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                authProvider: 'google',
                isVerified: true
              });
            }
          }

          // 6. Prevent blocked users from logging in
          if (user.isBlocked) {
            return done(null, false);
          }

          // 7. Authentication successful
          return done(null, user);

        } catch (error) {
          console.error('Google authentication error:', error);
          return done(error, null);
        }
      }
    )
  );
};
