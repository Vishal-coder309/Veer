const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { sendMail, welcomeEmail, otpEmail } = require('../services/mailer');
const {
  hashPassword, hashPin, comparePassword, comparePin,
  hashOtp, generateOTP, otpExpiresAt, verifyOtp, buildUsername,
} = require('../utils/authHelpers');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ─── STEP 1: Register → send OTP ─────────────────────────────────────────────
router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name required'),
    body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password, firstName, lastName } = req.body;
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.emailVerified) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const usernameSeed = [firstName, lastName].filter(Boolean).join('_') || displayName || email;
      const username = existing?.username || await buildUsername(usernameSeed);

      const otp = generateOTP();
      const data = {
        email,
        name: displayName,
        username,
        password: await hashPassword(password),
        otpCode: hashOtp(otp),
        otpExpiresAt: otpExpiresAt(),
        emailVerified: false,
        profileComplete: false,
      };

      if (existing) {
        await prisma.user.update({ where: { email }, data });
      } else {
        await prisma.user.create({ data });
      }

      const { subject, html } = otpEmail(email, otp);
      await sendMail(email, subject, html);
      res.status(201).json({ success: true, message: `OTP sent to ${email}`, email, user: { email, name: displayName, username } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── Resend OTP ───────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      return res.status(404).json({ success: false, message: 'No pending registration for this email' });
    }
    const otp = generateOTP();
    await prisma.user.update({
      where: { email },
      data: { otpCode: hashOtp(otp), otpExpiresAt: otpExpiresAt() },
    });
    const { subject, html } = otpEmail(email, otp);
    await sendMail(email, subject, html);
    res.json({ success: true, message: `OTP resent to ${email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── STEP 2: Verify OTP ───────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: 'No registration found' });
    if (user.emailVerified) return res.status(400).json({ success: false, message: 'Already verified' });
    if (!verifyOtp(String(otp).trim(), user.otpCode, user.otpExpiresAt)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const suggestedUsername = user.username || await buildUsername((user.name || email).replace(/\s+/g, '_'));
    const updated = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        username: suggestedUsername,
        name: user.name || suggestedUsername,
      },
    });

    res.json({
      success: true,
      token: generateToken(updated.id),
      user: { id: updated.id, email: updated.email, username: updated.username, name: updated.name, profileComplete: false, theme: updated.theme },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── STEP 3: Setup profile (username + PIN) ───────────────────────────────────
router.post('/setup-profile', protect,
  [
    body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-z0-9_]+$/).withMessage('Username: 3–30 lowercase letters/numbers/underscore'),
    body('pin').isLength({ min: 4, max: 6 }).matches(/^\d+$/).withMessage('PIN: 4–6 digits'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { username, pin } = req.body;
    try {
      const taken = await prisma.user.findFirst({ where: { username, NOT: { id: req.user.id } } });
      if (taken) return res.status(400).json({ success: false, message: 'Username already taken' });

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { username: username.toLowerCase(), pin: await hashPin(pin), profileComplete: true },
      });

      const { subject, html } = welcomeEmail(user.username);
      sendMail(user.email, subject, html).catch((e) => console.warn('Welcome email failed:', e.message));

      res.json({ success: true, user: { id: user.id, email: user.email, username: user.username, name: user.name, profileComplete: true, theme: user.theme, dailyGoalMinutes: user.dailyGoalMinutes } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login',
  [
    body('email').isEmail(),
    body('credential').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, credential, credentialType = 'password' } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ success: false, message: 'Invalid email or credentials' });
      if (!user.emailVerified) return res.status(403).json({ success: false, message: 'Email not verified', action: 'verify', email });

      let valid = false;
      if (credentialType === 'pin') {
        if (!user.pin) return res.status(400).json({ success: false, message: 'PIN not set. Login with password first.' });
        valid = await comparePin(String(credential), user.pin);
      } else {
        valid = await comparePassword(credential, user.password);
      }

      if (!valid) return res.status(401).json({ success: false, message: `Invalid ${credentialType}` });

      res.json({
        success: true,
        token: generateToken(user.id),
        user: {
          id: user.id, email: user.email, username: user.username, name: user.name,
          profileComplete: user.profileComplete, theme: user.theme,
          dailyGoalMinutes: user.dailyGoalMinutes,
          streak: { current: user.streakCurrent, longest: user.streakLongest, lastStudiedDate: user.streakLastStudied },
          reminderSettings: { enabled: user.reminderEnabled, time: user.reminderTime, days: user.reminderDays },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── GET /me ──────────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Update profile ───────────────────────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const allowed = ['name', 'dailyGoalMinutes', 'targetYear', 'notificationsEnabled', 'theme'];
    const data = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Change PIN ───────────────────────────────────────────────────────────────
router.put('/change-pin', protect,
  [body('pin').isLength({ min: 4, max: 6 }).matches(/^\d+$/)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    try {
      await prisma.user.update({ where: { id: req.user.id }, data: { pin: await hashPin(req.body.pin) } });
      res.json({ success: true, message: 'PIN updated' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── Reminder settings ────────────────────────────────────────────────────────
router.put('/reminder-settings', protect, async (req, res) => {
  try {
    const { enabled, time, days } = req.body;
    const data = {};
    if (enabled !== undefined) data.reminderEnabled = enabled;
    if (time) data.reminderTime = time;
    if (days) data.reminderDays = days;
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ success: true, reminderSettings: { enabled: user.reminderEnabled, time: user.reminderTime, days: user.reminderDays } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Strip sensitive fields before sending to client
function sanitizeUser(u) {
  const { password, pin, otpCode, otpExpiresAt, ...safe } = u;
  return {
    ...safe,
    streak: { current: u.streakCurrent, longest: u.streakLongest, lastStudiedDate: u.streakLastStudied },
    reminderSettings: { enabled: u.reminderEnabled, time: u.reminderTime, days: u.reminderDays },
  };
}

module.exports = router;
