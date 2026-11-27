import * as authService from './auth.service.js';

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    // In JWT architecture, client discards token; if sessions table used, revoke here
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const result = await authService.getCurrentUser(req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPassword(req, res, next) {
  try {
    const result = await authService.verifyUserPassword(req.user.id, req.body.password);
    res.json({
      success: true,
      message: 'Password verified successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.requestPasswordResetOtp(req.body);
    res.json({
      success: true,
      message: 'Verification OTP has been sent to your email address.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const result = await authService.verifyPasswordResetOtp(req.body);
    res.json({
      success: true,
      message: 'OTP verified successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await authService.resetPasswordWithToken(req.body);
    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function setupStatus(req, res, next) {
  try {
    const result = await authService.getSetupStatus();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateWorkspace(req, res, next) {
  try {
    const result = await authService.updateWorkspaceProfile(req.businessId, req.body);
    res.json({
      success: true,
      message: 'Workspace profile updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  setupStatus,
  register,
  login,
  logout,
  me,
  verifyPassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updateWorkspace
};
