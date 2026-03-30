const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

// POST /api/sessions — start a new session
router.post('/', protect, async (req, res) => {
  try {
    const { subject, topic, notes } = req.body;
    if (!subject || !topic) {
      return res.status(400).json({ success: false, message: 'Subject and topic are required' });
    }

    const now = new Date();
    const session = await prisma.session.create({
      data: {
        userId: req.user.id,
        subject,
        topic,
        notes,
        startTime: now,
        date: toDateStr(now),
        status: 'active',
      },
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/sessions/:id/stop — stop session and save duration
router.put('/:id/stop', protect, async (req, res) => {
  try {
    const existing = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Session not found' });

    const endTime = new Date();

    // Use client-tracked elapsed seconds if provided (accurate — excludes paused time)
    // Fall back to wall-clock diff if not provided
    let elapsedSeconds;
    if (req.body && req.body.elapsedSeconds != null && req.body.elapsedSeconds > 0) {
      elapsedSeconds = Math.floor(req.body.elapsedSeconds);
    } else {
      elapsedSeconds = Math.floor((endTime - new Date(existing.startTime)) / 1000);
    }

    // Round up to nearest minute (so 27s = 1 min, not 0 min)
    const durationMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { endTime, durationMinutes, status: 'completed' },
    });

    await updateStreak(req.user.id, session.date);

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/sessions/:id/pause
router.put('/:id/pause', protect, async (req, res) => {
  try {
    const existing = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Session not found' });

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'paused' },
    });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/sessions/:id/resume
router.put('/:id/resume', protect, async (req, res) => {
  try {
    const existing = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Session not found' });

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'active' },
    });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/today
router.get('/today', protect, async (req, res) => {
  try {
    const today = toDateStr(new Date());
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, date: today },
      orderBy: { startTime: 'desc' },
    });
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    res.json({ success: true, sessions, totalMinutes, date: today });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions?startDate=&endDate=&subject=
router.get('/', protect, async (req, res) => {
  try {
    const { startDate, endDate, subject } = req.query;
    const where = { userId: req.user.id, status: 'completed' };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }
    if (subject) where.subject = subject;

    const sessions = await prisma.session.findMany({
      where,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/weekly-stats
router.get('/weekly-stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return toDateStr(d);
    });

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        status: 'completed',
        date: { in: dates },
      },
    });

    const stats = dates.map((dateStr) => {
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const totalMinutes = daySessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);
      const subjectBreakdown = {};
      daySessions.forEach((sess) => {
        subjectBreakdown[sess.subject] = (subjectBreakdown[sess.subject] || 0) + (sess.durationMinutes || 0);
      });
      return { date: dateStr, totalMinutes, subjectBreakdown };
    });

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sessions/monthly-stats
router.get('/monthly-stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const year = req.query.year || now.getFullYear();
    const month = req.query.month || now.getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        status: 'completed',
        date: { gte: startDate, lte: endDate },
      },
    });

    const bySubject = {};
    const byDate = {};
    let totalMinutes = 0;

    sessions.forEach((sess) => {
      totalMinutes += sess.durationMinutes || 0;
      bySubject[sess.subject] = (bySubject[sess.subject] || 0) + (sess.durationMinutes || 0);
      byDate[sess.date] = (byDate[sess.date] || 0) + (sess.durationMinutes || 0);
    });

    res.json({ success: true, totalMinutes, bySubject, byDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper: update user streak
async function updateStreak(userId, dateStr) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const lastStudied = user.streakLastStudied ? toDateStr(user.streakLastStudied) : null;
  if (lastStudied === dateStr) return; // already updated today

  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  let streakCurrent = user.streakCurrent;
  if (lastStudied === yesterday || lastStudied === null) {
    streakCurrent += 1;
  } else if (lastStudied !== dateStr) {
    streakCurrent = 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      streakCurrent,
      streakLongest: Math.max(streakCurrent, user.streakLongest),
      streakLastStudied: new Date(dateStr),
    },
  });
}

module.exports = router;