/**
 * Seed script: creates a demo user and sample data
 * Run: node data/seed.js  (from server/ directory)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../prisma/client');
const { hashPassword } = require('../utils/authHelpers');

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];
const SUBJECTS = ['Maths', 'Reasoning', 'English', 'General Knowledge'];

async function seed() {
  // Clean up existing demo user (cascade deletes sessions, tests, etc.)
  const existing = await prisma.user.findUnique({ where: { email: 'demo@veer.com' } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('Cleaned existing demo user');
  }

  // Create demo user
  const user = await prisma.user.create({
    data: {
      name: 'arjun',
      username: 'arjun',
      email: 'demo@veer.com',
      password: await hashPassword('demo123'),
      emailVerified: true,
      profileComplete: true,
      dailyGoalMinutes: 240,
      streakCurrent: 5,
      streakLongest: 12,
      streakLastStudied: new Date(),
    },
  });
  console.log('Demo user created: demo@veer.com / demo123');

  // Create sessions for last 14 days
  const now = new Date();
  const sessions = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);
    const numSessions = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < numSessions; j++) {
      const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
      const duration = Math.floor(Math.random() * 60) + 20;
      sessions.push({
        userId: user.id,
        subject,
        topic: `Sample Topic ${j + 1}`,
        startTime: d,
        endTime: new Date(d.getTime() + duration * 60000),
        durationMinutes: duration,
        status: 'completed',
        date: dateStr,
      });
    }
  }
  await prisma.session.createMany({ data: sessions });
  console.log(`Created ${sessions.length} sessions`);

  // Create topic progress
  const topicEntries = [
    { subject: 'Maths', topicName: 'Number System', status: 'completed' },
    { subject: 'Maths', topicName: 'Percentage', status: 'completed' },
    { subject: 'Maths', topicName: 'Ratio', status: 'in_progress' },
    { subject: 'Maths', topicName: 'Profit & Loss', status: 'in_progress' },
    { subject: 'Reasoning', topicName: 'Analogy', status: 'completed' },
    { subject: 'Reasoning', topicName: 'Series (Number)', status: 'completed' },
    { subject: 'Reasoning', topicName: 'Coding-Decoding', status: 'in_progress' },
    { subject: 'English', topicName: 'Synonyms', status: 'completed' },
    { subject: 'English', topicName: 'Antonyms', status: 'completed' },
    { subject: 'English', topicName: 'Reading Comprehension', status: 'in_progress' },
    { subject: 'General Knowledge', topicName: 'Indian History (Modern)', status: 'completed' },
    { subject: 'General Knowledge', topicName: 'Indian Polity & Constitution', status: 'in_progress' },
  ];

  await prisma.topicProgress.createMany({
    data: topicEntries.map((t) => ({ ...t, userId: user.id, lastStudied: new Date() })),
  });
  console.log('Created topic progress entries');

  // Create sample test results
  const testsData = [
    {
      testName: 'SSC CGL Mock 1',
      testType: 'mock',
      date: new Date(Date.now() - 10 * 86400000),
      totalQuestions: 100, attempted: 85, correct: 60, wrong: 25,
      score: 172.5, totalMarks: 200, accuracy: Math.round((60 / 85) * 100),
      timeTakenMinutes: 60,
      subjectScores: [
        { subject: 'Maths', attempted: 20, correct: 14, wrong: 6, marks: 40, totalMarks: 50 },
        { subject: 'Reasoning', attempted: 22, correct: 17, wrong: 5, marks: 48, totalMarks: 50 },
        { subject: 'English', attempted: 22, correct: 15, wrong: 7, marks: 43, totalMarks: 50 },
        { subject: 'General Knowledge', attempted: 21, correct: 14, wrong: 7, marks: 41.5, totalMarks: 50 },
      ],
    },
    {
      testName: 'SSC CGL Mock 2',
      testType: 'mock',
      date: new Date(Date.now() - 5 * 86400000),
      totalQuestions: 100, attempted: 90, correct: 68, wrong: 22,
      score: 190, totalMarks: 200, accuracy: Math.round((68 / 90) * 100),
      timeTakenMinutes: 60,
      subjectScores: [
        { subject: 'Maths', attempted: 23, correct: 16, wrong: 7, marks: 45, totalMarks: 50 },
        { subject: 'Reasoning', attempted: 24, correct: 19, wrong: 5, marks: 52.5, totalMarks: 50 },
        { subject: 'English', attempted: 22, correct: 17, wrong: 5, marks: 47.5, totalMarks: 50 },
        { subject: 'General Knowledge', attempted: 21, correct: 16, wrong: 5, marks: 45, totalMarks: 50 },
      ],
    },
  ];

  for (const t of testsData) {
    const { subjectScores, ...testData } = t;
    await prisma.test.create({
      data: {
        ...testData,
        userId: user.id,
        subjectScores: { create: subjectScores },
      },
    });
  }
  console.log('Created sample tests');

  console.log('\n✅ Seed complete! Login with: demo@veer.com / demo123');
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
