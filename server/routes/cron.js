/**
 * Cron endpoints — called by Vercel Cron Jobs on a schedule.
 * Protected by CRON_SECRET environment variable.
 */
const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { sendMail, studyReminderEmail, motivationEmail, dailyNudgeEmail, dailyProgressEmail } = require('../services/mailer');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

function getWeekStart(d = new Date()) {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split('T')[0];
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

  if (dayOfWeek === 7) return currentWeekStart; // Sunday
  if (dayOfWeek === 1) return addDays(currentWeekStart, -7); // Monday
  return null;
}

function verifyCronSecret(req) {
  const authHeader = req.headers['authorization'] || '';
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured — allow in dev
  return authHeader === `Bearer ${secret}`;
}

function getIstDateStr(dateObj = new Date()) {
  const istNow = new Date(dateObj.getTime() + 5.5 * 60 * 60 * 1000);
  const y = istNow.getUTCFullYear();
  const m = String(istNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function listDatesInclusive(startDateStr, endDateStr) {
  const dates = [];
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return dates;
  }

  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
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

// GET /api/cron/daily-motivation
// Schedule: "30 3 * * *" (3:30 AM UTC = 9:00 AM IST)
router.get('/daily-motivation', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const istDay = istNow.getUTCDay();

  try {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        notificationsEnabled: true,
        reminderDays: { has: istDay },
      },
      select: { email: true, username: true, name: true },
    });

    let sent = 0;
    const errors = [];

    for (const user of users) {
      try {
        const { subject, html } = dailyNudgeEmail(user.name || user.username || 'there');
        await sendMail(user.email, subject, html);
        sent++;
      } catch (e) {
        errors.push({ user: user.email, error: e.message });
      }
    }

    res.json({ success: true, checked: users.length, sent, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/cron/daily-analytics
// Schedule: "30 17 * * *" (5:30 PM UTC = 11:00 PM IST)
router.get('/daily-analytics', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const reportDate = toDateStr(new Date());
  const dateLabel = new Date(`${reportDate}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  try {
    const users = await prisma.user.findMany({
      where: { emailVerified: true, notificationsEnabled: true },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        dailyGoalMinutes: true,
        streakCurrent: true,
      },
    });

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      return res.json({ success: true, checked: 0, sent: 0, errors: [] });
    }

    const [sessions, commitments] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId: { in: userIds },
          date: reportDate,
          status: 'completed',
        },
        select: { userId: true, subject: true, durationMinutes: true },
      }),
      prisma.dailyCommitment.findMany({
        where: {
          userId: { in: userIds },
          date: reportDate,
        },
        select: { userId: true, studyMinutes: true },
      }),
    ]);

    const timerMinutesByUser = new Map();
    const sessionCountByUser = new Map();
    const subjectBreakdownByUser = new Map();
    for (const s of sessions) {
      timerMinutesByUser.set(s.userId, (timerMinutesByUser.get(s.userId) || 0) + (s.durationMinutes || 0));
      sessionCountByUser.set(s.userId, (sessionCountByUser.get(s.userId) || 0) + 1);

      if (!subjectBreakdownByUser.has(s.userId)) {
        subjectBreakdownByUser.set(s.userId, {});
      }
      const breakdown = subjectBreakdownByUser.get(s.userId);
      breakdown[s.subject] = (breakdown[s.subject] || 0) + (s.durationMinutes || 0);
    }

    const loggedMinutesByUser = new Map();
    for (const c of commitments) {
      loggedMinutesByUser.set(c.userId, Number(c.studyMinutes || 0));
    }

    let sent = 0;
    const errors = [];

    for (const user of users) {
      const timerMinutes = timerMinutesByUser.get(user.id) || 0;
      const loggedMinutes = loggedMinutesByUser.get(user.id) || 0;
      const totalMinutes = Math.max(timerMinutes, loggedMinutes);
      const sessionCount = sessionCountByUser.get(user.id) || 0;
      const subjectBreakdown = subjectBreakdownByUser.get(user.id) || {};

      try {
        const { subject, html } = dailyProgressEmail(user.name || user.username || 'there', {
          dateLabel,
          totalMinutes,
          sessionCount,
          streak: user.streakCurrent,
          goalMinutes: user.dailyGoalMinutes,
          subjectBreakdown,
        });
        await sendMail(user.email, subject, html);
        sent++;
      } catch (e) {
        errors.push({ user: user.email, error: e.message });
      }
    }

    res.json({ success: true, checked: users.length, sent, errors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/cron/inactivity-check
// Schedule: Sunday + Monday (see vercel.json)
router.get('/inactivity-check', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const weekStart = getTargetWeekStart();
  if (!weekStart) {
    return res.json({ success: true, skipped: true, reason: 'Runs only on Sunday/Monday' });
  }

  const weekEnd = addDays(weekStart, 6);
  const today = toDateStr(new Date());
  const evaluationEnd = today < weekEnd ? today : weekEnd;

  try {
    const users = await prisma.user.findMany({
      where: { emailVerified: true },
      select: { id: true, email: true, username: true, name: true },
    });

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      return res.json({ success: true, checked: 0, flagged: 0, errors: [] });
    }

    const [sessions, existingJustifications] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId: { in: userIds },
          date: { gte: weekStart, lte: evaluationEnd },
          status: 'completed',
        },
        select: { userId: true, date: true },
      }),
      prisma.justification.findMany({
        where: {
          userId: { in: userIds },
          weekStart,
        },
        select: { userId: true },
      }),
    ]);

    const studyDaysByUser = new Map();
    for (const s of sessions) {
      if (!studyDaysByUser.has(s.userId)) {
        studyDaysByUser.set(s.userId, new Set());
      }
      studyDaysByUser.get(s.userId).add(s.date);
    }

    const alreadySubmitted = new Set(existingJustifications.map((j) => j.userId));

    let flagged = 0;
    const errors = [];

    for (const user of users) {
      const daysStudied = studyDaysByUser.get(user.id)?.size || 0;
      if (daysStudied >= 3) continue;

      if (alreadySubmitted.has(user.id)) continue;

      try {
        await sendMail(
          user.email,
          `⚠️ VEER: Weekly target missed (${daysStudied}/3 days) — justification needed`,
          `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
            <h2 style="color:#dc2626;">Study Target Not Met</h2>
            <p>Hi <strong>${user.username || user.name || 'there'}</strong>,</p>
            <p>For the week of <strong>${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>, you've studied on only <strong>${daysStudied} day${daysStudied !== 1 ? 's' : ''}</strong> (target: 3 days).</p>
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

// GET /api/cron/daily-efficiency-rollup
// Schedule: "30 18 * * *" (6:30 PM UTC = 12:00 AM IST)
router.get('/daily-efficiency-rollup', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const istToday = getIstDateStr(new Date());
  const evaluateDate = addDays(istToday, -1);

  try {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        OR: [
          { lastEfficiencyEvaluatedDate: null },
          { lastEfficiencyEvaluatedDate: { not: evaluateDate } },
        ],
      },
      select: {
        id: true,
        dailyGoalMinutes: true,
        offDaysCount: true,
        inefficientDaysCount: true,
      },
    });

    if (users.length === 0) {
      return res.json({ success: true, checked: 0, updated: 0, evaluateDate });
    }

    const userIds = users.map((u) => u.id);

    const [sessions, commitments] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId: { in: userIds },
          status: 'completed',
          date: evaluateDate,
        },
        select: { userId: true, durationMinutes: true },
      }),
      prisma.dailyCommitment.findMany({
        where: {
          userId: { in: userIds },
          date: evaluateDate,
        },
        select: { userId: true, studyMinutes: true },
      }),
    ]);

    const timerMinutesByUser = new Map();
    for (const s of sessions) {
      timerMinutesByUser.set(s.userId, (timerMinutesByUser.get(s.userId) || 0) + (s.durationMinutes || 0));
    }

    const loggedMinutesByUser = new Map();
    for (const c of commitments) {
      loggedMinutesByUser.set(c.userId, Number(c.studyMinutes || 0));
    }

    let updated = 0;
    const offDayUsers = [];
    const inefficientDayUsers = [];

    for (const user of users) {
      const timerMinutes = timerMinutesByUser.get(user.id) || 0;
      const loggedMinutes = loggedMinutesByUser.get(user.id) || 0;
      const totalMinutes = Math.max(timerMinutes, loggedMinutes);

      const data = { lastEfficiencyEvaluatedDate: evaluateDate };

      if (totalMinutes <= 0) {
        data.offDaysCount = (user.offDaysCount || 0) + 1;
        offDayUsers.push(user.id);
      } else if (totalMinutes < user.dailyGoalMinutes) {
        data.inefficientDaysCount = (user.inefficientDaysCount || 0) + 1;
        inefficientDayUsers.push(user.id);
      }

      await prisma.user.update({ where: { id: user.id }, data });
      updated++;
    }

    res.json({
      success: true,
      checked: users.length,
      updated,
      evaluateDate,
      offDaysAdded: offDayUsers.length,
      inefficientDaysAdded: inefficientDayUsers.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/cron/backfill-efficiency-counters
// Manual one-time (or re-runnable) historical recomputation.
// Query params:
// - startDate=YYYY-MM-DD (optional; default: first session date per user)
// - endDate=YYYY-MM-DD (optional; default: yesterday IST)
// - dryRun=true|false (optional; default: false)
router.get('/backfill-efficiency-counters', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Unauthorized' });

  const dryRun = String(req.query.dryRun || 'false').toLowerCase() === 'true';
  const overrideStartDate = req.query.startDate;
  const overrideEndDate = req.query.endDate;

  const yesterdayIst = addDays(getIstDateStr(new Date()), -1);
  const endDate = overrideEndDate || yesterdayIst;

  try {
    const users = await prisma.user.findMany({
      where: { emailVerified: true },
      select: {
        id: true,
        dailyGoalMinutes: true,
      },
    });

    if (users.length === 0) {
      return res.json({ success: true, checked: 0, updated: 0, dryRun, endDate });
    }

    const userIds = users.map((u) => u.id);

    const [sessions, commitments] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId: { in: userIds },
          status: 'completed',
          date: { lte: endDate },
        },
        select: { userId: true, date: true, durationMinutes: true },
      }),
      prisma.dailyCommitment.findMany({
        where: {
          userId: { in: userIds },
          date: { lte: endDate },
        },
        select: { userId: true, date: true, studyMinutes: true },
      }),
    ]);

    const timerMinutesByUserDate = new Map();
    for (const s of sessions) {
      const key = `${s.userId}::${s.date}`;
      timerMinutesByUserDate.set(key, (timerMinutesByUserDate.get(key) || 0) + (s.durationMinutes || 0));
    }

    const loggedMinutesByUserDate = new Map();
    for (const c of commitments) {
      const key = `${c.userId}::${c.date}`;
      loggedMinutesByUserDate.set(key, Number(c.studyMinutes || 0));
    }

    const minDateByUser = new Map();
    for (const s of sessions) {
      const existing = minDateByUser.get(s.userId);
      if (!existing || s.date < existing) {
        minDateByUser.set(s.userId, s.date);
      }
    }

    let updated = 0;
    let skipped = 0;
    let totalOffDays = 0;
    let totalInefficientDays = 0;

    for (const user of users) {
      const derivedStartDate = minDateByUser.get(user.id);
      const startDate = overrideStartDate || derivedStartDate;

      if (!startDate) {
        skipped++;
        continue;
      }

      const allDates = listDatesInclusive(startDate, endDate);
      if (allDates.length === 0) {
        skipped++;
        continue;
      }

      let offDays = 0;
      let inefficientDays = 0;

      for (const date of allDates) {
        const key = `${user.id}::${date}`;
        const timerMinutes = timerMinutesByUserDate.get(key) || 0;
        const loggedMinutes = loggedMinutesByUserDate.get(key) || 0;
        const totalMinutes = Math.max(timerMinutes, loggedMinutes);

        if (totalMinutes <= 0) {
          offDays++;
        } else if (totalMinutes < user.dailyGoalMinutes) {
          inefficientDays++;
        }
      }

      totalOffDays += offDays;
      totalInefficientDays += inefficientDays;

      if (!dryRun) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            offDaysCount: offDays,
            inefficientDaysCount: inefficientDays,
            lastEfficiencyEvaluatedDate: endDate,
          },
        });
      }

      updated++;
    }

    res.json({
      success: true,
      dryRun,
      checked: users.length,
      updated,
      skipped,
      range: {
        startDate: overrideStartDate || 'per-user-first-session',
        endDate,
      },
      totals: {
        offDays: totalOffDays,
        inefficientDays: totalInefficientDays,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
