
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendOTP = async (email, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"NORIX Gaming" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'NORIX - Email Verification OTP',
      html: `
        <h2>Welcome to NORIX!</h2>
        <p>Your verification OTP is:</p>
        <h1 style="letter-spacing: 8px;">${otp}</h1>
       <p>This OTP is valid for 5 minutes.</p>
        <p>Please do not share this code with anyone.</p>
      `
    });

    console.log('OTP email sent successfully:', info.messageId);
    return info;

  } catch (error) {
    console.log('OTP email error:', error.message);
    throw error;
  }
};

module.exports = { sendOTP };
