const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { sendMail, studyReminderEmail, weeklyReportEmail } = require('../services/mailer');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

// POST /api/notifications/test — send a test email to yourself
router.post('/test', protect, async (req, res) => {
  try {
    await sendMail(
      req.user.email,
      '✅ VEER Email Test',
      `<div style="font-family:Inter,sans-serif;padding:32px;max-width:480px;margin:0 auto;">
        <h2 style="color:#2563eb;">Email is working! 🎉</h2>
        <p>Hi <strong>${req.user.name || req.user.username}</strong>, your VEER email notifications are set up correctly.</p>
      </div>`
    );
    res.json({ success: true, message: `Test email sent to ${req.user.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/reminder — send study reminder to self
router.post('/reminder', protect, async (req, res) => {
  try {
    const today = toDateStr(new Date());
    const agg = await prisma.session.aggregate({
      where: { userId: req.user.id, date: today, status: 'completed' },
      _sum: { durationMinutes: true },
    });
    const minutesStudied = agg._sum.durationMinutes || 0;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const { subject, html } = studyReminderEmail(
      user.name || user.username || 'there',
      user.dailyGoalMinutes,
      minutesStudied
    );
    await sendMail(user.email, subject, html);
    res.json({ success: true, message: 'Reminder sent!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/weekly-report — send weekly summary
router.post('/weekly-report', protect, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);

    const agg = await prisma.session.aggregate({
      where: {
        userId: req.user.id,
        date: { gte: toDateStr(weekStart), lte: toDateStr(now) },
        status: 'completed',
      },
      _sum: { durationMinutes: true },
      _count: { id: true },
    });

    const totalMinutes = agg._sum.durationMinutes || 0;
    const sessionCount = agg._count.id || 0;
    const completed = await prisma.topicProgress.count({
      where: { userId: req.user.id, status: 'completed' },
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const stats = {
      totalHours: Math.floor(totalMinutes / 60),
      totalMinutes,
      sessions: sessionCount,
      streak: user.streakCurrent,
      topicsCompleted: completed,
      weekLabel: `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };

    const { subject, html } = weeklyReportEmail(user.name || user.username || 'there', stats);
    await sendMail(user.email, subject, html);
    res.json({ success: true, message: 'Weekly report sent!', stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
