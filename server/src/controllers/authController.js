import * as authService from '../services/authService.js';
import { loginSchema } from '../validators/authValidator.js';

const isProduction = process.env.NODE_ENV === 'production';

export async function login(req, res, next) {
  try {
    const validated = loginSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;

    const { user, accessToken, refreshToken } = await authService.login({
      username: validated.username,
      password: validated.password,
      ipAddress,
    });

    // Set JWT access token cookie (15m)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    // Set Refresh Token cookie (7d)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Login successful',
      user,
      token: accessToken, // Also returned for non-cookie HTTP clients/tests
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    const { accessToken } = await authService.refresh(rawRefreshToken);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      message: 'Token refreshed',
      token: accessToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    await authService.logout(rawRefreshToken, req.user?.id);

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.status(200).json({ message: 'Successfully logged out' });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const { changePassword: doChange } = await import('../services/passwordService.js');
    const result = await doChange(req.user.id, currentPassword, newPassword);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
