/**
 * Cron endpoints — called by Vercel Cron Jobs on a schedule.
 * Protected by CRON_SECRET environment variable.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { sendMail, studyReminderEmail } = require('../services/mailer');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

function getWeekStart(d = new Date()) {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split('T')[0];
}

function verifyCronSecret(req) {
  const authHeader = req.headers['authorization'] || '';
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured — allow in dev
  return authHeader === `Bearer ${secret}`;
}

// GET /api/cron/daily-reminders
// Schedule: "0 14 * * *" (2 PM UTC = 7:30 PM IST)
router.get('/daily-reminders', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const today = toDateStr(new Date());
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const istHour = istNow.getUTCHours();
  const istDay = istNow.getUTCDay();

  try {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        reminderEnabled: true,
        reminderDays: { has: istDay },
      },
    });

    let sent = 0;
    const errors = [];

    for (const user of users) {
      const agg = await prisma.session.aggregate({
        where: { userId: user.id, date: today, status: 'completed' },
        _sum: { durationMinutes: true },
      });
      const minutesStudied = agg._sum.durationMinutes || 0;

      const [rHour] = (user.reminderTime || '20:00').split(':').map(Number);
      if (Math.abs(istHour - rHour) > 1) continue;

      if (minutesStudied < user.dailyGoalMinutes) {
        try {
          const { subject, html } = studyReminderEmail(
            user.username || user.name || 'there',
            user.dailyGoalMinutes,
            minutesStudied
          );
          await sendMail(user.email, subject, html);
          sent++;
        } catch (e) {
          errors.push({ user: user.email, error: e.message });
        }
      }
    }

    res.json({ success: true, checked: users.length, sent, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/cron/inactivity-check
// Schedule: "0 15 * * 4" (3 PM UTC Thursday = 8:30 PM IST Thursday)
router.get('/inactivity-check', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const weekStart = getWeekStart();
  const today = toDateStr(new Date());

  try {
    const users = await prisma.user.findMany({ where: { emailVerified: true } });
    let flagged = 0;
    const errors = [];

    for (const user of users) {
      const sessions = await prisma.session.findMany({
        where: {
          userId: user.id,
          date: { gte: weekStart, lte: today },
          status: 'completed',
        },
        select: { date: true },
      });

      const daysStudied = new Set(sessions.map((s) => s.date)).size;
      if (daysStudied >= 3) continue;

      const existing = await prisma.justification.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
      });
      if (existing) continue;

      try {
        await sendMail(
          user.email,
          `⚠️ VEER: Only ${daysStudied}/3 study days this week — justification needed`,
          `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
            <h2 style="color:#dc2626;">Study Target Not Met</h2>
            <p>Hi <strong>${user.username || user.name || 'there'}</strong>,</p>
            <p>You've studied on only <strong>${daysStudied} day${daysStudied !== 1 ? 's' : ''}</strong> this week (target: 3 days).</p>
            <p>Please log into VEER and submit a justification to explain the reason.</p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard"
               style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px;">
              Open VEER &amp; Submit Justification
            </a>
          </div>`
        );
        flagged++;
      } catch (e) {
        errors.push({ user: user.email, error: e.message });
      }
    }

    res.json({ success: true, checked: users.length, flagged, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
