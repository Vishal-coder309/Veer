const prisma = require('../prisma/client');

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateStr = (d = new Date()) => new Date(d).toISOString().split('T')[0];

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const diffDays = (fromDateStr, toDateStrValue = toDateStr()) => {
  const from = parseDate(fromDateStr);
  const to = parseDate(toDateStrValue);
  if (!from || !to) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
};

const getLongBreakThreshold = () => {
  const configured = Number(process.env.LONG_BREAK_DAYS || 5);
  if (!Number.isFinite(configured)) return 5;
  return Math.max(3, Math.floor(configured));
};

const getLongBreakRequirement = async (userId, longBreakJustifiedFor) => {
  const threshold = getLongBreakThreshold();
  const today = toDateStr();

  const lastCompletedSession = await prisma.session.findFirst({
    where: { userId, status: 'completed' },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  if (!lastCompletedSession?.date) {
    return { required: false };
  }

  const lastStudyDate = lastCompletedSession.date;
  const daysSinceLastStudy = diffDays(lastStudyDate, today);

  if (daysSinceLastStudy < threshold) {
    return { required: false };
  }

  if (longBreakJustifiedFor && longBreakJustifiedFor === lastStudyDate) {
    return { required: false };
  }

  return {
    required: true,
    type: 'long_break',
    threshold,
    lastStudyDate,
    daysSinceLastStudy,
    returnDate: today,
  };
};

module.exports = {
  toDateStr,
  getLongBreakThreshold,
  getLongBreakRequirement,
};
