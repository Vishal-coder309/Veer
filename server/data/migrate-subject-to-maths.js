/**
 * One-time data migration:
 * Rename subject "Quantitative Aptitude" to "Maths" in existing data.
 *
 * Run from server/: npm run migrate:maths
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../prisma/client');

async function migrateSubjectToMaths() {
  const FROM = 'Quantitative Aptitude';
  const TO = 'Maths';

  const [sessionsRes, topicsRes, subjectScoresRes] = await prisma.$transaction([
    prisma.session.updateMany({
      where: { subject: FROM },
      data: { subject: TO },
    }),
    prisma.topicProgress.updateMany({
      where: { subject: FROM },
      data: { subject: TO },
    }),
    prisma.testSubjectScore.updateMany({
      where: { subject: FROM },
      data: { subject: TO },
    }),
  ]);

  console.log('Migration complete');
  console.log(`Sessions updated: ${sessionsRes.count}`);
  console.log(`Topic progress updated: ${topicsRes.count}`);
  console.log(`Test subject scores updated: ${subjectScoresRes.count}`);
}

migrateSubjectToMaths()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
