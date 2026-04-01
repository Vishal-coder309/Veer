/**
 * Sessions route tests.
 */
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');

jest.mock('../prisma/client', () => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
  session: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  dailyCommitment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
}));

jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({}),
  dailyProgressEmail: jest.fn().mockReturnValue({ subject: 'Daily Progress', html: '<p>progress</p>' }),
}));

const prisma = require('../prisma/client');
const SECRET = process.env.JWT_SECRET || 'test_secret';
const token = () => jwt.sign({ id: 'user123' }, SECRET);
const auth = () => ({ Authorization: `Bearer ${token()}` });

const mockUser = {
  id: 'user123', email: 'test@veer.com', username: 'testuser', name: 'testuser',
  profileComplete: true, theme: 'light', dailyGoalMinutes: 240,
  reminderEnabled: false, reminderTime: '20:00', reminderDays: [1,2,3,4,5,6,0],
  streakCurrent: 2, streakLongest: 5, streakLastStudied: new Date('2026-03-28'),
  emailVerified: true,
};

const mockSession = (overrides = {}) => ({
  id: 'sess123',
  userId: 'user123',
  subject: 'Reasoning',
  topic: 'Analogy',
  startTime: new Date(),
  endTime: null,
  durationMinutes: 0,
  status: 'active',
  date: new Date().toISOString().split('T')[0],
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(mockUser);
  prisma.user.update.mockResolvedValue(mockUser);
});

describe('POST /api/sessions', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/sessions').send({ subject: 'Reasoning', topic: 'Analogy' });
    expect(res.status).toBe(401);
  });

  it('returns 400 if subject missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({ topic: 'Analogy' });
    expect(res.status).toBe(400);
  });

  it('creates session successfully', async () => {
    prisma.session.create.mockResolvedValue(mockSession());
    const res = await request(app)
      .post('/api/sessions')
      .set(auth())
      .send({ subject: 'Reasoning', topic: 'Analogy' });
    expect(res.status).toBe(201);
    expect(res.body.session.subject).toBe('Reasoning');
    expect(res.body.session.status).toBe('active');
  });
});

describe('PUT /api/sessions/:id/stop', () => {
  it('returns 404 for unknown session', async () => {
    prisma.session.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .put('/api/sessions/fakeid/stop')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('stops session and records duration', async () => {
    const started = new Date(Date.now() - 30 * 60000); // 30 mins ago
    prisma.session.findFirst.mockResolvedValue(mockSession({ startTime: started }));
    prisma.session.update.mockResolvedValue(mockSession({ status: 'completed', durationMinutes: 30 }));
    prisma.dailyCommitment.findUnique.mockResolvedValue({ studyMinutes: 10 });
    prisma.dailyCommitment.upsert.mockResolvedValue({ studyMinutes: 40 });
    prisma.session.findMany.mockResolvedValue([mockSession({ status: 'completed', durationMinutes: 30 })]);
    const res = await request(app)
      .put('/api/sessions/sess123/stop')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');
    expect(prisma.dailyCommitment.upsert).toHaveBeenCalled();
  });
});

describe('GET /api/sessions/today', () => {
  it('returns today sessions and total', async () => {
    prisma.session.findMany.mockResolvedValue([
      mockSession({ durationMinutes: 45, status: 'completed' }),
      mockSession({ durationMinutes: 30, status: 'completed' }),
    ]);
    const res = await request(app)
      .get('/api/sessions/today')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.totalMinutes).toBe(75);
  });
});

describe('GET /api/sessions', () => {
  it('filters by subject', async () => {
    prisma.session.findMany.mockResolvedValue([mockSession({ subject: 'English' })]);
    const res = await request(app)
      .get('/api/sessions?subject=English')
      .set(auth());
    expect(res.status).toBe(200);
    expect(prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ subject: 'English' }) })
    );
  });
});
