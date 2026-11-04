const crypto = require('crypto');

const hashOTP = (otp) => {
  return crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');
};

const getOTPExpiry = () => {
  return new Date(Date.now() + 1 * 60 * 1000);
};

module.exports = {
  hashOTP,
  getOTPExpiry
};