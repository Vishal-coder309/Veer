const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { SSC_CGL_SYLLABUS } = require('../data/syllabus');

// GET /api/topics — get all topics with user's progress
router.get('/', protect, async (req, res) => {
  try {
    const { subject } = req.query;
    const where = { userId: req.user.id };
    if (subject) where.subject = subject;

    const progress = await prisma.topicProgress.findMany({ where });
    const progressMap = {};
    progress.forEach((p) => {
      progressMap[`${p.subject}::${p.topicName}`] = p;
    });

    const result = {};
    Object.entries(SSC_CGL_SYLLABUS).forEach(([subj, topics]) => {
      if (subject && subj !== subject) return;
      result[subj] = topics.map((topicName) => {
        const prog = progressMap[`${subj}::${topicName}`];
        return {
          subject: subj,
          topicName,
          status: prog ? prog.status : 'not_started',
          lastStudied: prog ? prog.lastStudied : null,
          notes: prog ? prog.notes : '',
          difficulty: prog ? prog.difficulty : 'medium',
          totalTimeSpentMinutes: prog ? prog.totalTimeSpentMinutes : 0,
          id: prog ? prog.id : null,
        };
      });
    });

    res.json({ success: true, topics: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/topics — update a topic's status (upsert)
router.put('/', protect, async (req, res) => {
  try {
    const { subject, topicName, status, notes, difficulty } = req.body;
    if (!subject || !topicName) {
      return res.status(400).json({ success: false, message: 'Subject and topicName required' });
    }

    const data = { lastStudied: new Date() };
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (difficulty !== undefined) data.difficulty = difficulty;

    const topic = await prisma.topicProgress.upsert({
      where: { userId_topicName: { userId: req.user.id, topicName } },
      update: data,
      create: { userId: req.user.id, subject, topicName, ...data },
    });

    res.json({ success: true, topic });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/topics/summary — subject-wise completion %
router.get('/summary', protect, async (req, res) => {
  try {
    const progress = await prisma.topicProgress.findMany({ where: { userId: req.user.id } });
    const summary = {};

    Object.keys(SSC_CGL_SYLLABUS).forEach((subj) => {
      const total = SSC_CGL_SYLLABUS[subj].length;
      const subjectProgress = progress.filter((p) => p.subject === subj);
      const completed = subjectProgress.filter((p) => p.status === 'completed').length;
      const inProgress = subjectProgress.filter((p) => p.status === 'in_progress').length;

      summary[subj] = {
        total,
        completed,
        inProgress,
        notStarted: total - completed - inProgress,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
