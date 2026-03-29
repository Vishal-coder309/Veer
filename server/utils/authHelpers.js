/**
 * Auth utility functions — replaces Mongoose model instance methods
 * since Prisma returns plain objects, not class instances.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prisma/client');

const hashPassword = async (plain) => bcrypt.hash(plain, 12);
const hashPin = async (plain) => bcrypt.hash(plain, 10);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
const comparePin = (plain, hash) => bcrypt.compare(plain, hash);

const hashOtp = (plain) =>
  crypto.createHash('sha256').update(plain).digest('hex');

const generateOTP = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const otpExpiresAt = () =>
  new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

const verifyOtp = (plain, storedHash, expiresAt) => {
  if (!storedHash || !expiresAt) return false;
  if (new Date() > new Date(expiresAt)) return false;
  return hashOtp(plain) === storedHash;
};

/** Generate a unique username from email prefix */
async function buildUsername(email) {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20) || 'user';

  let username = base;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}${counter++}`;
  }
  return username;
}

module.exports = {
  hashPassword,
  hashPin,
  comparePassword,
  comparePin,
  hashOtp,
  generateOTP,
  otpExpiresAt,
  verifyOtp,
  buildUsername,
};
