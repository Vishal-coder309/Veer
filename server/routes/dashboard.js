const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { SSC_CGL_SYLLABUS, isTopicCompleted } = require('../data/syllabus');

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
    const timerTodayMinutes = todaySessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0);

    // Use daily commitment total when available so dashboard includes manually logged time,
    // while still protecting against stale/partial values.
    const todayCommitment = await prisma.dailyCommitment.findUnique({
      where: { userId_date: { userId: req.user.id, date: today } },
      select: { studyMinutes: true },
    });
    const loggedTodayMinutes = Number(todayCommitment?.studyMinutes || 0);
    const todayMinutes = Math.max(timerTodayMinutes, loggedTodayMinutes);

    const subjectBreakdown = {};
    todaySessions.forEach((sess) => {
      subjectBreakdown[sess.subject] = (subjectBreakdown[sess.subject] || 0) + (sess.durationMinutes || 0);
    });

    // Weekly stats with subject breakdown for colored bars by subject
    const weekStats = dates.map((dateStr) => {
      const daySessions = weekSessions.filter((s) => s.date === dateStr);
      const daySubjectBreakdown = {};
      let minutes = 0;

      daySessions.forEach((sess) => {
        const mins = sess.durationMinutes || 0;
        minutes += mins;
        daySubjectBreakdown[sess.subject] = (daySubjectBreakdown[sess.subject] || 0) + mins;
      });

      return {
        date: dateStr,
        minutes,
        subjectBreakdown: daySubjectBreakdown,
      };
    });

    // Topic progress
    const progress = await prisma.topicProgress.findMany({ where: { userId: req.user.id } });
    const progressMap = {};
    progress.forEach((p) => {
      progressMap[`${p.subject}::${p.topicName}`] = p;
    });
    const totalTopics = Object.values(SSC_CGL_SYLLABUS).flat().length;
    let completedTopics = 0;
    let inProgressTopics = 0;

    Object.entries(SSC_CGL_SYLLABUS).forEach(([subject, topics]) => {
      topics.forEach((topicName) => {
        const p = progressMap[`${subject}::${topicName}`];
        if (!p) return;
        if (isTopicCompleted({ ...p, subject, topicName })) completedTopics++;
        else if (p.status === 'in_progress' || (p.videosWatched || 0) > 0 || (p.assignmentsCompleted || 0) > 0) inProgressTopics++;
      });
    });

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
        consistency: {
          offDays: user.offDaysCount || 0,
          inefficientDays: user.inefficientDaysCount || 0,
          lastEvaluatedDate: user.lastEfficiencyEvaluatedDate || null,
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
