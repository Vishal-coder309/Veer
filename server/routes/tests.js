const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');

// POST /api/tests — add a new test result
router.post('/', protect, async (req, res) => {
  try {
    const {
      testName, testType, date, totalQuestions, attempted,
      correct, wrong, score, totalMarks, timeTakenMinutes,
      subjectScores, notes, rank,
    } = req.body;

    if (!testName || !totalQuestions || attempted === undefined || correct === undefined) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const wrongVal = wrong !== undefined ? wrong : attempted - correct;
    const scoreVal = score !== undefined ? score : correct;
    const totalMarksVal = totalMarks !== undefined ? totalMarks : totalQuestions;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    const test = await prisma.test.create({
      data: {
        userId: req.user.id,
        testName,
        testType: testType || 'mock',
        date: date ? new Date(date) : new Date(),
        totalQuestions,
        attempted,
        correct,
        wrong: wrongVal,
        score: scoreVal,
        totalMarks: totalMarksVal,
        accuracy,
        timeTakenMinutes: timeTakenMinutes || 0,
        notes,
        rank,
        subjectScores: subjectScores?.length
          ? { create: subjectScores.map((s) => ({
              subject: s.subject,
              attempted: s.attempted || 0,
              correct: s.correct || 0,
              wrong: s.wrong || 0,
              marks: s.marks || 0,
              totalMarks: s.totalMarks || 0,
            })) }
          : undefined,
      },
      include: { subjectScores: true },
    });

    res.status(201).json({ success: true, test });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tests — list all tests
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 20, page = 1, testType } = req.query;
    const where = { userId: req.user.id };
    if (testType) where.testType = testType;

    const [tests, total] = await prisma.$transaction([
      prisma.test.findMany({
        where,
        orderBy: { date: 'desc' },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
        include: { subjectScores: true },
      }),
      prisma.test.count({ where }),
    ]);

    res.json({ success: true, tests, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/tests/analytics
router.get('/analytics', protect, async (req, res) => {
  try {
    const tests = await prisma.test.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'asc' },
      include: { subjectScores: true },
    });

    if (tests.length === 0) return res.json({ success: true, analytics: null });

    const SUBJECTS = ['Maths', 'Reasoning', 'English', 'General Knowledge'];
    const subjectAccuracy = {};

    SUBJECTS.forEach((subj) => {
      const scores = tests
        .flatMap((t) => t.subjectScores)
        .filter((s) => s.subject === subj && s.attempted > 0);
      subjectAccuracy[subj] = scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + (s.correct / s.attempted) * 100, 0) / scores.length)
        : 0;
    });

    const trend = tests.map((t) => ({
      date: t.date,
      testName: t.testName,
      score: t.score,
      totalMarks: t.totalMarks,
      accuracy: t.accuracy,
      percentage: Math.round((t.score / t.totalMarks) * 100),
    }));

    const avgAccuracy = Math.round(tests.reduce((s, t) => s + t.accuracy, 0) / tests.length);
    const bestScore = Math.max(...tests.map((t) => Math.round((t.score / t.totalMarks) * 100)));
    const weakSubjects = SUBJECTS.filter((s) => subjectAccuracy[s] < 60 && subjectAccuracy[s] > 0);

    res.json({
      success: true,
      analytics: { totalTests: tests.length, avgAccuracy, bestScore, subjectAccuracy, trend, weakSubjects },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tests/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const test = await prisma.test.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    await prisma.test.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Test deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
