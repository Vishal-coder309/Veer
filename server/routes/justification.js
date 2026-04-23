const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { getLongBreakRequirement, toDateStr } = require('../utils/justificationPolicy');

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
    if (req.pendingJustification?.required) {
      return res.json({ required: true, ...req.pendingJustification });
    }

    const longBreakRequirement = await getLongBreakRequirement(req.user.id, req.user.longBreakJustifiedFor);
    if (longBreakRequirement.required) {
      return res.json({ required: true, ...longBreakRequirement });
    }

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

    res.json({ required: true, type: 'weekly_target', weekStart, weekEnd, daysStudied, threshold: 3, dayOfWeek });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/justification — submit a justification
router.post('/', protect, async (req, res) => {
  try {
    const { reason, category, weekStart: providedWeekStart, type, lastStudyDate: providedLastStudyDate } = req.body;
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed reason (min 20 characters)',
      });
    }

    const longBreakRequirement = req.pendingJustification?.required
      ? req.pendingJustification
      : await getLongBreakRequirement(req.user.id, req.user.longBreakJustifiedFor);

    if (type === 'long_break' || longBreakRequirement.required) {
      if (!longBreakRequirement.required) {
        return res.status(400).json({
          success: false,
          message: 'No long-break justification is pending',
        });
      }

      if (providedLastStudyDate && providedLastStudyDate !== longBreakRequirement.lastStudyDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid long-break justification payload',
        });
      }

      const referenceKey = `long-break-${longBreakRequirement.lastStudyDate}`;
      const justification = await prisma.justification.upsert({
        where: { userId_weekStart: { userId: req.user.id, weekStart: referenceKey } },
        update: {
          reason: reason.trim(),
          category: category || 'long_break',
          daysStudied: 0,
        },
        create: {
          userId: req.user.id,
          weekStart: referenceKey,
          reason: reason.trim(),
          category: category || 'long_break',
          daysStudied: 0,
        },
      });

      await prisma.user.update({
        where: { id: req.user.id },
        data: { longBreakJustifiedFor: longBreakRequirement.lastStudyDate },
      });

      return res.status(201).json({ success: true, type: 'long_break', justification });
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
    const today = toDateStr();
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

    res.status(201).json({ success: true, type: 'weekly_target', justification });
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
