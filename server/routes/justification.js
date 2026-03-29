const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');

/** Returns the ISO date string of the Monday of the current week */
function getWeekStart(dateObj = new Date()) {
  const d = new Date(dateObj);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

/** Count distinct days with completed sessions in [weekStart, today] */
async function studyDaysThisWeek(userId) {
  const weekStart = getWeekStart();
  const today = new Date().toISOString().split('T')[0];

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      date: { gte: weekStart, lte: today },
      status: 'completed',
    },
    select: { date: true },
  });

  return new Set(sessions.map((s) => s.date)).size;
}

// GET /api/justification/check — should a justification modal be shown?
router.get('/check', protect, async (req, res) => {
  try {
    const weekStart = getWeekStart();
    const rawDay = new Date().getUTCDay();
    const dayOfWeek = rawDay === 0 ? 7 : rawDay; // Mon=1 … Sun=7

    if (dayOfWeek < 4) {
      return res.json({ required: false, reason: 'Too early in the week' });
    }

    const daysStudied = await studyDaysThisWeek(req.user.id);
    if (daysStudied >= 3) {
      return res.json({ required: false, daysStudied });
    }

    const existing = await prisma.justification.findUnique({
      where: { userId_weekStart: { userId: req.user.id, weekStart } },
    });
    if (existing) {
      return res.json({ required: false, alreadySubmitted: true, daysStudied });
    }

    res.json({ required: true, weekStart, daysStudied, threshold: 3, dayOfWeek });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/justification — submit a justification
router.post('/', protect, async (req, res) => {
  try {
    const { reason, category } = req.body;
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed reason (min 20 characters)',
      });
    }

    const weekStart = getWeekStart();
    const daysStudied = await studyDaysThisWeek(req.user.id);

    const justification = await prisma.justification.upsert({
      where: { userId_weekStart: { userId: req.user.id, weekStart } },
      update: { reason: reason.trim(), category: category || 'other', daysStudied },
      create: {
        userId: req.user.id,
        weekStart,
        reason: reason.trim(),
        category: category || 'other',
        daysStudied,
      },
    });

    res.status(201).json({ success: true, justification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/justification — list all justifications for the user
router.get('/', protect, async (req, res) => {
  try {
    const list = await prisma.justification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, justifications: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
