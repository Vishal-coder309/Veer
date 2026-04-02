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

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function getTargetWeekStart(dateObj = new Date()) {
  const now = new Date(dateObj);
  const rawDay = now.getUTCDay();
  const dayOfWeek = rawDay === 0 ? 7 : rawDay; // Mon=1 ... Sun=7
  const currentWeekStart = getWeekStart(now);

  if (dayOfWeek === 7) return currentWeekStart; // Sunday: current week
  if (dayOfWeek === 1) return addDays(currentWeekStart, -7); // Monday: previous week
  return null;
}

/** Count distinct days with completed sessions in [startDate, endDate] */
async function countStudyDays(userId, startDate, endDate) {

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      status: 'completed',
    },
    select: { date: true },
  });

  return new Set(sessions.map((s) => s.date)).size;
}

// GET /api/justification/check — should a justification modal be shown?
router.get('/check', protect, async (req, res) => {
  try {
    const rawDay = new Date().getUTCDay();
    const dayOfWeek = rawDay === 0 ? 7 : rawDay; // Mon=1 … Sun=7
    const weekStart = getTargetWeekStart();

    if (!weekStart) {
      return res.json({ required: false, reason: 'Justification opens on Sunday or Monday only' });
    }

    const weekEnd = addDays(weekStart, 6);
    const today = new Date().toISOString().split('T')[0];
    const evaluationEnd = today < weekEnd ? today : weekEnd;

    const daysStudied = await countStudyDays(req.user.id, weekStart, evaluationEnd);
    if (daysStudied >= 3) {
      return res.json({ required: false, daysStudied });
    }

    const existing = await prisma.justification.findUnique({
      where: { userId_weekStart: { userId: req.user.id, weekStart } },
    });
    if (existing) {
      return res.json({ required: false, alreadySubmitted: true, daysStudied });
    }

    res.json({ required: true, weekStart, weekEnd, daysStudied, threshold: 3, dayOfWeek });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/justification — submit a justification
router.post('/', protect, async (req, res) => {
  try {
    const { reason, category, weekStart: providedWeekStart } = req.body;
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed reason (min 20 characters)',
      });
    }

    const computedWeekStart = getTargetWeekStart();
    if (!computedWeekStart) {
      return res.status(400).json({
        success: false,
        message: 'Justification can be submitted on Sunday or Monday only',
      });
    }

    if (providedWeekStart && providedWeekStart !== computedWeekStart) {
      return res.status(400).json({
        success: false,
        message: 'Invalid week selected for justification',
      });
    }

    const weekStart = computedWeekStart;

    const weekEnd = addDays(weekStart, 6);
    const today = new Date().toISOString().split('T')[0];
    const evaluationEnd = today < weekEnd ? today : weekEnd;
    const daysStudied = await countStudyDays(req.user.id, weekStart, evaluationEnd);

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
