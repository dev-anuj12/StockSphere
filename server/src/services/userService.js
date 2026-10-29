import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function listUsers(params) {
  const result = await userRepo.listUsers(params);
  // Attach assigned warehouses for staff
  for (const u of result.data) {
    if (u.role === 'staff') {
      u.warehouses = await userRepo.findStaffWarehouses(u.id);
    }
  }
  return result;
}

export async function createUser(data, adminUserId) {
  // Check unique username and email
  const existingUsername = await userRepo.findByUsernameOrEmail(data.username);
  if (existingUsername) {
    throw new AppError(`Username '${data.username}' is already taken`, 409);
  }

  const existingEmail = await userRepo.findByUsernameOrEmail(data.email);
  if (existingEmail) {
    throw new AppError(`Email '${data.email}' is already registered`, 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const newUser = await userRepo.createUser({
    username: data.username.toLowerCase(),
    email: data.email.toLowerCase(),
    password_hash: passwordHash,
    full_name: data.full_name,
    role: data.role,
    status: data.status || 'active',
  });

  if (data.role === 'staff' && Array.isArray(data.warehouse_ids)) {
    await userRepo.assignUserWarehouses(newUser.id, data.warehouse_ids);
  }

  await auditRepo.logAction({
    userId: adminUserId,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: newUser.id,
    newValues: { username: newUser.username, role: newUser.role, full_name: newUser.full_name },
  });

  return newUser;
}

export async function updateUser(id, updates, adminUserId) {
  const targetUser = await userRepo.findById(id);
  if (!targetUser) {
    throw new AppError('User not found', 404);
  }

  // Safety check: Cannot demote the last active Admin!
  if (targetUser.role === 'admin' && updates.role && updates.role !== 'admin') {
    const adminCount = await userRepo.countActiveAdmins();
    if (adminCount <= 1) {
      throw new AppError('Operation rejected: Cannot demote the last active Administrator in the system.', 403);
    }
  }

  let passwordHash = undefined;
  if (updates.password && updates.password.trim().length >= 8) {
    passwordHash = await bcrypt.hash(updates.password, 12);
  }

  const updated = await userRepo.updateUser(id, {
    full_name: updates.full_name,
    role: updates.role,
    email: updates.email,
    password_hash: passwordHash,
  });

  if (updates.warehouse_ids && Array.isArray(updates.warehouse_ids)) {
    await userRepo.assignUserWarehouses(id, updates.warehouse_ids);
  }

  await auditRepo.logAction({
    userId: adminUserId,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: id,
    oldValues: { role: targetUser.role, full_name: targetUser.full_name },
    newValues: { role: updated.role, full_name: updated.full_name },
  });

  return updated;
}

export async function updateUserStatus(id, status, adminUserId) {
  const targetUser = await userRepo.findById(id);
  if (!targetUser) {
    throw new AppError('User not found', 404);
  }

  // Safety check: Cannot deactivate the last active Admin!
  if (targetUser.role === 'admin' && status === 'inactive') {
    const adminCount = await userRepo.countActiveAdmins();
    if (adminCount <= 1) {
      throw new AppError('Operation rejected: Cannot deactivate the last active Administrator in the system.', 403);
    }
  }

  const updated = await userRepo.updateUserStatus(id, status);

  // If deactivated, revoke all refresh tokens
  if (status === 'inactive') {
    await userRepo.revokeAllUserRefreshTokens(id);
  }

  await auditRepo.logAction({
    userId: adminUserId,
    action: status === 'active' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    entityType: 'USER',
    entityId: id,
    oldValues: { status: targetUser.status },
    newValues: { status: updated.status },
  });

  return updated;
}
