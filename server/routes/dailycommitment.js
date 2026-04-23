const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const { protect } = require('../middleware/auth');
const { sendMail, motivationEmail, motivationVariantCount } = require('../services/mailer');

const toDateStr = () => new Date().toISOString().split('T')[0];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildFreshOrder(count, lastSentVariantIndex = null) {
  let order = shuffle(Array.from({ length: count }, (_, i) => i));
  if (count > 1 && lastSentVariantIndex !== null && order[0] === lastSentVariantIndex) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

function normalizeOrder(order, count) {
  if (!Array.isArray(order) || order.length !== count) {
    return null;
  }

  const expected = new Set(Array.from({ length: count }, (_, i) => i));
  for (const value of order) {
    if (!Number.isInteger(value) || !expected.has(value)) {
      return null;
    }
    expected.delete(value);
  }

  return expected.size === 0 ? order : null;
}

// GET /api/daily/today
router.get('/today', protect, async (req, res) => {
  try {
    const date = toDateStr();
    let commitment = await prisma.dailyCommitment.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    res.json({ success: true, commitment, date });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/daily/commit — user says "I will study today"
router.post('/commit', protect, async (req, res) => {
  try {
    const date = toDateStr();
    const commitment = await prisma.dailyCommitment.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      update: { status: 'committed' },
      create: { userId: req.user.id, date, status: 'committed' },
    });
    res.json({ success: true, commitment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/daily/skip — user says "not studying today" → sends motivation email
router.post('/skip', protect, async (req, res) => {
  try {
    const date = toDateStr();
    const commitment = await prisma.dailyCommitment.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      update: { status: 'skipped' },
      create: { userId: req.user.id, date, status: 'skipped' },
    });
    // Send motivation email async (non-blocking)
    (async () => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          motivationVariantOrder: true,
          motivationVariantCursor: true,
        },
      });

      if (!user?.email || motivationVariantCount <= 0) return;

      const currentOrder = normalizeOrder(user.motivationVariantOrder, motivationVariantCount)
        || buildFreshOrder(motivationVariantCount);
      const currentCursor = Number.isInteger(user.motivationVariantCursor)
        && user.motivationVariantCursor >= 0
        && user.motivationVariantCursor < motivationVariantCount
        ? user.motivationVariantCursor
        : 0;

      const variantIndex = currentOrder[currentCursor] ?? currentOrder[0] ?? 0;
      let nextCursor = currentCursor + 1;
      let nextOrder = currentOrder;

      if (nextCursor >= motivationVariantCount) {
        nextCursor = 0;
        nextOrder = buildFreshOrder(motivationVariantCount, variantIndex);
      }

      const { subject, html } = motivationEmail(user.name || user.username || 'there', { variantIndex });
      await sendMail(user.email, subject, html);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          motivationVariantOrder: nextOrder,
          motivationVariantCursor: nextCursor,
        },
      });
    })().catch((e) => console.warn('Motivation email failed:', e.message));

    res.json({ success: true, commitment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/daily/update — update studyMinutes, youtubeLinks, notes
router.put('/update', protect, async (req, res) => {
  try {
    const date = toDateStr();
    const { studyMinutes, youtubeLinks, notes } = req.body;
    const data = {};
    if (studyMinutes !== undefined) data.studyMinutes = Number(studyMinutes);
    if (youtubeLinks !== undefined) data.youtubeLinks = youtubeLinks;
    if (notes !== undefined) data.notes = notes;

    const commitment = await prisma.dailyCommitment.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      update: data,
      create: { userId: req.user.id, date, status: 'committed', ...data },
    });
    res.json({ success: true, commitment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/daily/history — last 30 days
router.get('/history', protect, async (req, res) => {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const history = await prisma.dailyCommitment.findMany({
      where: { userId: req.user.id, date: { gte: startStr, lte: endStr } },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
