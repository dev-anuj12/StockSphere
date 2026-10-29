import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as userRepo from '../repositories/userRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'stocksphere-jwt-access-secret-minimum-32-characters-key!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'stocksphere-jwt-refresh-secret-minimum-32-characters-key!';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function login({ username, password, ipAddress }) {
  const user = await userRepo.findByUsernameOrEmail(username);

  if (!user) {
    throw new AppError('Invalid username/email or password', 401);
  }

  // Check if locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
    throw new AppError(`Account is temporarily locked due to multiple failed attempts. Try again in ${minutesLeft} minute(s).`, 403);
  }

  if (user.status !== 'active') {
    throw new AppError('This user account has been deactivated.', 403);
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    const lockoutInfo = await userRepo.recordFailedLogin(user.id, 5, 15);
    if (lockoutInfo && lockoutInfo.lockedUntil) {
      throw new AppError('Too many failed login attempts. Your account is locked for 15 minutes.', 403);
    }
    const remaining = 5 - (lockoutInfo ? lockoutInfo.attempts : 1);
    throw new AppError(`Invalid username/email or password. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : ''}`, 401);
  }

  // Reset failed logins on successful authentication
  await userRepo.resetFailedLogins(user.id);

  // Generate Access Token
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  // Generate Refresh Token
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await userRepo.storeRefreshToken(user.id, tokenHash, expiresAt);

  // Fetch warehouses if staff
  let warehouses = null;
  if (user.role === 'staff') {
    warehouses = await userRepo.findStaffWarehouses(user.id);
  }

  // Audit log
  await auditRepo.logAction({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    ipAddress,
  });

  const safeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    status: user.status,
    warehouses,
  };

  return { user: safeUser, accessToken, refreshToken: rawRefreshToken };
}

export async function refresh(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AppError('Refresh token required', 401);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenRecord = await userRepo.findRefreshToken(tokenHash);

  if (!tokenRecord) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await userRepo.findById(tokenRecord.user_id);
  if (!user || user.status !== 'active') {
    throw new AppError('User not authorized or inactive', 401);
  }

  // Generate new Access Token
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  return { accessToken };
}

export async function logout(rawRefreshToken, userId) {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await userRepo.revokeRefreshToken(tokenHash);
  }

  if (userId) {
    await auditRepo.logAction({
      userId,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: userId,
    });
  }

  return { message: 'Logged out successfully' };
}

export async function getMe(userId) {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  let warehouses = null;
  if (user.role === 'staff') {
    warehouses = await userRepo.findStaffWarehouses(user.id);
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    status: user.status,
    warehouses,
  };
}
