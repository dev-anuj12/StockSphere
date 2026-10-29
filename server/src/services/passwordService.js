import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { AppError } from '../utils/errors.js';

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findByUsernameOrEmail((await userRepo.findById(userId))?.username || '');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await userRepo.updateUser(userId, { password_hash: newHash });

  await auditRepo.logAction({
    userId,
    action: 'CHANGE_PASSWORD',
    entityType: 'USER',
    entityId: userId,
  });

  return { message: 'Password changed successfully' };
}
