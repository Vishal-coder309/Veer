const jwt = require('jsonwebtoken');
const prisma = require('../prisma/client');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, email: true, username: true, name: true,
        profileComplete: true, theme: true, dailyGoalMinutes: true,
        reminderEnabled: true, reminderTime: true, reminderDays: true,
        streakCurrent: true, streakLongest: true, streakLastStudied: true,
        emailVerified: true,
      },
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { protect };
