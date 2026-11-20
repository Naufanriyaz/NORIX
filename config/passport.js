
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
  const baseUrl = process.env.TUNNEL_URL || process.env.LOCAL_URL;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${baseUrl}/auth/google/callback`
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleEmail = profile.emails?.[0];

          if (!googleEmail || googleEmail.verified !== true) {
            return done(null, false);
          }

          const email = googleEmail.value.toLowerCase();

          let user = await User.findOne({
            googleId: profile.id
          });

          if (!user) {
            user = await User.findOne({ email });

            if (user) {
              if (user.googleId && user.googleId !== profile.id) {
                return done(null, false);
              }

              user.googleId = profile.id;
              await user.save();

            } else {
              user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                authProvider: 'google',
                isVerified: true
              });
            }
          }

          if (user.isBlocked) {
            return done(null, false);
          }

          return done(null, user);

        } catch (error) {
          console.error('Google authentication error:', error);
          return done(error, null);
        }
      }
    )
  );
};
