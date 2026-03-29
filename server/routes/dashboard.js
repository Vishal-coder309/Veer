const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { SSC_CGL_SYLLABUS } = require('../data/syllabus');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

// GET /api/dashboard — aggregated dashboard data
router.get('/', protect, async (req, res) => {
  try {
    const today = toDateStr(new Date());

    // Build last 7 days date list
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return toDateStr(d);
    });

    // Fetch all completed sessions for the past 7 days + today in one query
    const weekSessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        status: 'completed',
        date: { in: dates },
      },
    });

    const todaySessions = weekSessions.filter((s) => s.date === today);
    const todayMinutes = todaySessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);

    const subjectBreakdown = {};
    todaySessions.forEach((sess) => {
      subjectBreakdown[sess.subject] = (subjectBreakdown[sess.subject] || 0) + (sess.durationMinutes || 0);
    });

    // Weekly stats
    const weekStats = dates.map((dateStr) => ({
      date: dateStr,
      minutes: weekSessions
        .filter((s) => s.date === dateStr)
        .reduce((s, sess) => s + (sess.durationMinutes || 0), 0),
    }));

    // Topic progress
    const progress = await prisma.topicProgress.findMany({ where: { userId: req.user.id } });
    const totalTopics = Object.values(SSC_CGL_SYLLABUS).flat().length;
    const completedTopics = progress.filter((p) => p.status === 'completed').length;
    const inProgressTopics = progress.filter((p) => p.status === 'in_progress').length;

    // Recent tests
    const recentTests = await prisma.test.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: 3,
    });

    // Total all-time study minutes
    const allTimeAgg = await prisma.session.aggregate({
      where: { userId: req.user.id, status: 'completed' },
      _sum: { durationMinutes: true },
    });
    const totalMinutesAllTime = allTimeAgg._sum.durationMinutes || 0;

    // User streak from DB
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    res.json({
      success: true,
      dashboard: {
        todayMinutes,
        subjectBreakdown,
        streak: {
          current: user.streakCurrent,
          longest: user.streakLongest,
          lastStudiedDate: user.streakLastStudied,
        },
        dailyGoalMinutes: user.dailyGoalMinutes,
        topicsProgress: {
          total: totalTopics,
          completed: completedTopics,
          inProgress: inProgressTopics,
          percentage: Math.round((completedTopics / totalTopics) * 100),
        },
        recentTests: recentTests.map((t) => ({
          testName: t.testName,
          date: t.date,
          accuracy: t.accuracy,
          score: t.score,
          totalMarks: t.totalMarks,
        })),
        weekStats,
        totalMinutesAllTime,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
