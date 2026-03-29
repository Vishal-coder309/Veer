/**
 * Daily commitment route tests.
 */
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');

jest.mock('../prisma/client', () => ({
  user: { findUnique: jest.fn() },
  dailyCommitment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({}),
  motivationEmail: jest.fn().mockReturnValue({ subject: 'Motivate', html: '<p>go</p>' }),
}));

const prisma = require('../prisma/client');
const SECRET = process.env.JWT_SECRET || 'test_secret';

const token = () => jwt.sign({ id: 'user123' }, SECRET);
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

const mockUser = {
  id: 'user123', email: 'test@veer.com', username: 'testuser', name: 'testuser',
  profileComplete: true, theme: 'light', dailyGoalMinutes: 240,
  reminderEnabled: false, reminderTime: '20:00', reminderDays: [1,2,3,4,5,6,0],
  streakCurrent: 0, streakLongest: 0, streakLastStudied: null, emailVerified: true,
};

const mockCommitment = (overrides = {}) => ({
  id: 'commit123',
  userId: 'user123',
  date: new Date().toISOString().split('T')[0],
  status: 'committed',
  studyMinutes: 0,
  youtubeLinks: [],
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(mockUser);
});

describe('GET /api/daily/today', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/daily/today');
    expect(res.status).toBe(401);
  });

  it('returns null commitment when none exists', async () => {
    prisma.dailyCommitment.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/daily/today')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.commitment).toBeNull();
    expect(res.body.date).toBeTruthy();
  });

  it('returns existing commitment', async () => {
    prisma.dailyCommitment.findUnique.mockResolvedValue(mockCommitment());
    const res = await request(app)
      .get('/api/daily/today')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.commitment.status).toBe('committed');
  });
});

describe('POST /api/daily/commit', () => {
  it('creates a committed record', async () => {
    const c = mockCommitment({ status: 'committed' });
    prisma.dailyCommitment.upsert.mockResolvedValue(c);
    const res = await request(app)
      .post('/api/daily/commit')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.commitment.status).toBe('committed');
  });
});

describe('POST /api/daily/skip', () => {
  it('creates a skipped record and sends email', async () => {
    const c = mockCommitment({ status: 'skipped' });
    prisma.dailyCommitment.upsert.mockResolvedValue(c);
    const { sendMail } = require('../services/mailer');
    const res = await request(app)
      .post('/api/daily/skip')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.commitment.status).toBe('skipped');
    // email sent async — give it a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(sendMail).toHaveBeenCalled();
  });
});

describe('PUT /api/daily/update', () => {
  it('updates studyMinutes and youtubeLinks', async () => {
    const updated = mockCommitment({ studyMinutes: 120, youtubeLinks: ['https://youtube.com/watch?v=abc'] });
    prisma.dailyCommitment.upsert.mockResolvedValue(updated);
    const res = await request(app)
      .put('/api/daily/update')
      .set(authHeader())
      .send({ studyMinutes: 120, youtubeLinks: ['https://youtube.com/watch?v=abc'], notes: 'good session' });
    expect(res.status).toBe(200);
    expect(res.body.commitment.studyMinutes).toBe(120);
    expect(res.body.commitment.youtubeLinks).toContain('https://youtube.com/watch?v=abc');
  });
});

describe('GET /api/daily/history', () => {
  it('returns last 30 days of commitments', async () => {
    prisma.dailyCommitment.findMany.mockResolvedValue([
      mockCommitment({ date: '2026-03-28', status: 'committed', studyMinutes: 90 }),
      mockCommitment({ date: '2026-03-27', status: 'skipped' }),
    ]);
    const res = await request(app)
      .get('/api/daily/history')
      .set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[0].status).toBe('committed');
  });
});
