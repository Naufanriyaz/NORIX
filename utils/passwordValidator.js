const validatePassword = (password) => {
  const rules = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[^A-Za-z0-9]/.test(password)
  };

  return {
    isValid: Object.values(rules).every(Boolean),
    rules
  };
};

module.exports = { validatePassword };