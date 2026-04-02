const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { SSC_CGL_SYLLABUS, getTopicRequirements, isTopicCompleted } = require('../data/syllabus');

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
          videosRequired: getTopicRequirements(subj, topicName).videos,
          assignmentsRequired: getTopicRequirements(subj, topicName).assignments,
          videosWatched: prog ? (prog.videosWatched || 0) : 0,
          assignmentsCompleted: prog ? (prog.assignmentsCompleted || 0) : 0,
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
    const { subject, topicName, status, notes, difficulty, videosWatched, assignmentsCompleted } = req.body;
    if (!subject || !topicName) {
      return res.status(400).json({ success: false, message: 'Subject and topicName required' });
    }

    const existing = await prisma.topicProgress.findFirst({
      where: { userId: req.user.id, subject, topicName },
    });

    const data = { lastStudied: new Date() };
    const reqs = getTopicRequirements(subject, topicName);

    if (videosWatched !== undefined) {
      data.videosWatched = Math.max(0, Math.min(Number(videosWatched) || 0, reqs.videos || Number(videosWatched) || 0));
    }
    if (assignmentsCompleted !== undefined) {
      data.assignmentsCompleted = Math.max(0, Math.min(Number(assignmentsCompleted) || 0, reqs.assignments || Number(assignmentsCompleted) || 0));
    }

    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (difficulty !== undefined) data.difficulty = difficulty;

    const currentVideos = data.videosWatched !== undefined ? data.videosWatched : (existing?.videosWatched || 0);
    const currentAssignments = data.assignmentsCompleted !== undefined ? data.assignmentsCompleted : (existing?.assignmentsCompleted || 0);
    if (subject === 'Maths' && (reqs.videos > 0 || reqs.assignments > 0) && status === undefined) {
      if (currentVideos >= reqs.videos && currentAssignments >= reqs.assignments) data.status = 'completed';
      else if (currentVideos > 0 || currentAssignments > 0) data.status = 'in_progress';
      else data.status = 'not_started';
    }

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
    const progressMap = {};
    progress.forEach((p) => {
      progressMap[`${p.subject}::${p.topicName}`] = p;
    });
    const summary = {};

    Object.keys(SSC_CGL_SYLLABUS).forEach((subj) => {
      const total = SSC_CGL_SYLLABUS[subj].length;
      let completed = 0;
      let inProgress = 0;

      SSC_CGL_SYLLABUS[subj].forEach((topicName) => {
        const p = progressMap[`${subj}::${topicName}`];
        if (!p) return;
        if (isTopicCompleted({ ...p, subject: subj, topicName })) {
          completed++;
        } else if (p.status === 'in_progress' || (p.videosWatched || 0) > 0 || (p.assignmentsCompleted || 0) > 0) {
          inProgress++;
        }
      });

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
