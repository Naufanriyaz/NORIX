NORIX WEEK 13 EJS PAGE STARTER
================================

Included 13 page templates:
1. home.ejs
2. login.ejs
3. signup.ejs
4. verify-otp.ejs
5. forgot-password.ejs
6. reset-password.ejs
7. profile.ejs
8. edit-profile.ejs
9. change-password.ejs
10. addresses.ejs
11. address-form.ejs (used for both add and edit address)
12. admin/login.ejs
13. admin/users.ejs

Shared:
- views/partials/header.ejs
- views/partials/footer.ejs
- public/css/norix.css
- public/js/norix.js

Design direction follows the available NORIX Figma reference: off-white/gray backgrounds, orange (#ff6a00) accent, Space Grotesk + Outfit fonts, rounded cards, responsive layout and large-screen breakpoints for 27"/32" desktop viewports.

IMPORTANT:
- These are EJS UI templates, not a complete backend.
- Templates expect Express routes to render the relevant view names and pass variables:
  * profile/edit/change-password use `user` (optional)
  * addresses uses `addresses` (array)
  * admin/users uses `users`, `search`, `page`, `totalPages`, `totalUsers`, `activeUsers`, `blockedUsers`
  * address-form uses `address` (optional)
- Do not render `admin/users.ejs` without providing `users` as an array (empty array is fine).
- Example render names:
  res.render('pages/home', { title: 'NORIX' })
  res.render('pages/login', { title: 'Sign in' })
  res.render('pages/address-form', { title: 'Add address', address: null })
  res.render('admin/login', { title: 'Admin login' })
  res.render('admin/users', { title: 'User management', users: [], page: 1, totalPages: 1, search: '' })
- Add `app.use(express.static('public'))` before routes.
- This pack does NOT include backend/database routes, OTP delivery, OAuth credentials, or real auth.
- Replace the current views folder carefully; do not overwrite your project blindly. Copy the files into the matching folders.
