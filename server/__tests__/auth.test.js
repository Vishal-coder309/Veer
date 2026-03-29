/**
 * Auth route tests — mocks Prisma and Mailer so no DB needed.
 */
const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');

// ── Mock Prisma ──────────────────────────────────────────────────────────────
jest.mock('../prisma/client', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

// ── Mock Mailer ──────────────────────────────────────────────────────────────
jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({}),
  otpEmail: jest.fn().mockReturnValue({ subject: 'OTP', html: '<p>123456</p>' }),
  welcomeEmail: jest.fn().mockReturnValue({ subject: 'Welcome', html: '<p>hi</p>' }),
  motivationEmail: jest.fn().mockReturnValue({ subject: 'Motivate', html: '<p>go</p>' }),
  studyReminderEmail: jest.fn().mockReturnValue({ subject: 'Reminder', html: '<p>study</p>' }),
  weeklyReportEmail: jest.fn().mockReturnValue({ subject: 'Report', html: '<p>report</p>' }),
}));

const prisma = require('../prisma/client');

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'user123',
  email: 'test@veer.com',
  username: 'testuser',
  name: 'testuser',
  password: '$2a$12$hashedpassword',
  pin: null,
  emailVerified: true,
  profileComplete: true,
  dailyGoalMinutes: 240,
  streakCurrent: 0,
  streakLongest: 0,
  streakLastStudied: null,
  reminderEnabled: false,
  reminderTime: '20:00',
  reminderDays: [1, 2, 3, 4, 5, 6, 0],
  theme: 'light',
  ...overrides,
});

const validToken = () => jwt.sign({ id: 'user123' }, process.env.JWT_SECRET || 'test_secret');

beforeEach(() => jest.clearAllMocks());

// ── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 if email already verified', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ emailVerified: true }));
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@veer.com', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('creates user and sends OTP for new email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(makeUser({ emailVerified: false }));
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@veer.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe('new@veer.com');
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 400 for missing credential', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@veer.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@veer.com', credential: 'pass' });
    expect(res.status).toBe(401);
  });

  it('returns 403 if email not verified', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@veer.com', credential: 'pass' });
    expect(res.status).toBe(403);
    expect(res.body.action).toBe('verify');
  });

  it('returns 401 for wrong password', async () => {
    // bcrypt hash of "correctpass"
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('correctpass', 10);
    prisma.user.findUnique.mockResolvedValue(makeUser({ password: hash }));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@veer.com', credential: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns token on valid password login', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('secret123', 10);
    prisma.user.findUnique.mockResolvedValue(makeUser({ password: hash }));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@veer.com', credential: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('test@veer.com');
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user with valid token', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const token = validToken();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('test@veer.com');
    // sensitive fields stripped
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.pin).toBeUndefined();
  });
});
