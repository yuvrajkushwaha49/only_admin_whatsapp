import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import '../styles/login.css';

export default function Login({ initialView = 'login' }) {
  const [view, setView] = useState(initialView); // 'login' | 'forgot' | 'otp' | 'reset' | 'success'
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  // Reset password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // UI status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const otpInputRef = useRef(null);
  const { login, forgotPassword, verifyOtp, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/setup-status')
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setRegistrationOpen(Boolean(res.data.data.registrationOpen));
        }
      })
      .catch(() => {});
  }, []);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Focus OTP input when switching to OTP view
  useEffect(() => {
    if (view === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [view]);

  // Calculate password strength
  const getPasswordStrength = (pass) => {
    if (!pass) return { strength: 'none', label: '' };
    if (pass.length < 6) return { strength: 'weak', label: 'Weak' };
    const hasNum = /\d/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    if (pass.length >= 8 && hasNum && hasSpecial) return { strength: 'strong', label: 'Strong' };
    return { strength: 'medium', label: 'Medium' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // 1. Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Forgot Password - Send OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await forgotPassword(forgotEmail);
      if (res.data?.devOtp) {
        setDevOtp(res.data.devOtp);
      }
      setView('otp');
      setResendCountdown(60);
      setSuccessMsg('A 6-digit verification code has been dispatched to your email.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send verification code. Please check the email entered.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await verifyOtp(forgotEmail, otp.trim());
      setResetToken(res.data.resetToken);
      setView('reset');
      setSuccessMsg('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Reset Password Submit
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(forgotEmail, resetToken, newPassword);
      setView('success');
      setPassword('');
      setSuccessMsg('Your password has been changed successfully!');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password. Session may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // Start Forgot Password Flow from Login
  const startForgotPassword = () => {
    setError('');
    setSuccessMsg('');
    setForgotEmail(email || '');
    setOtp('');
    setDevOtp('');
    setView('forgot');
  };

  // Back to Login View
  const handleBackToLogin = () => {
    setError('');
    if (forgotEmail) {
      setEmail(forgotEmail);
    }
    setView('login');
  };

  // ---------------------------------------------------------------------------
  // VIEW: STEP 4 - SUCCESS
  // ---------------------------------------------------------------------------
  if (view === 'success') {
    return (
      <div className="success-state-container">
        <div className="success-icon-badge">
          <i className="bi bi-shield-check"></i>
        </div>
        <h3 className="auth-header-title">Password Reset Complete!</h3>
        <p className="auth-header-subtitle">
          Your account password has been updated securely. You can now log in with your new password.
        </p>

        <button
          type="button"
          onClick={handleBackToLogin}
          className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
        >
          <span>Sign In to Workspace</span>
          <i className="bi bi-arrow-right"></i>
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: STEP 3 - RESET NEW PASSWORD
  // ---------------------------------------------------------------------------
  if (view === 'reset') {
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="auth-back-btn mb-0"
          >
            <i className="bi bi-arrow-left"></i>
            <span>Cancel</span>
          </button>
          <div className="step-indicator active mb-0">
            <i className="bi bi-key-fill"></i>
            <span>Step 3 of 3</span>
          </div>
        </div>
        <h3 className="auth-header-title">Create new password</h3>
        <p className="auth-header-subtitle">
          Enter a secure new password for <strong>{forgotEmail}</strong>
        </p>

        {error && (
          <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleResetPasswordSubmit}>
          <div className="mb-3">
            <label className="form-label small fw-semibold text-secondary">New Password</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-lock text-muted"></i>
              </span>
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="form-control border-start-0 border-end-0 ps-0"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
              <button
                type="button"
                className="btn btn-outline-secondary border-start-0"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex="-1"
                title={showNewPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
            {newPassword && (
              <div className="password-strength-meter">
                <div className={`password-strength-fill strength-${passwordStrength.strength}`}></div>
              </div>
            )}
            <div className="password-requirements">
              Minimum 8 characters with letters, numbers or symbols.
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small fw-semibold text-secondary">Confirm New Password</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-shield-lock text-muted"></i>
              </span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control border-start-0 border-end-0 ps-0"
                placeholder="Re-type your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary border-start-0"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="text-danger small mt-1">Passwords do not match</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (confirmPassword && newPassword !== confirmPassword)}
            className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <>
                <span>Update Password & Save</span>
                <i className="bi bi-check-circle"></i>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="btn btn-light w-100 py-2 text-secondary fw-semibold small"
          >
            Cancel & Return to Sign In
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: STEP 2 - ENTER OTP
  // ---------------------------------------------------------------------------
  if (view === 'otp') {
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <button
            type="button"
            onClick={() => setView('forgot')}
            className="auth-back-btn mb-0"
          >
            <i className="bi bi-arrow-left"></i>
            <span>Change email</span>
          </button>
          <div className="step-indicator active mb-0">
            <i className="bi bi-shield-check"></i>
            <span>Step 2 of 3</span>
          </div>
        </div>

        <h3 className="auth-header-title">Enter verification code</h3>
        <p className="auth-header-subtitle">
          We sent a 6-digit security code to <strong>{forgotEmail}</strong>
        </p>

        {successMsg && (
          <div className="alert alert-success py-2 small d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-check-circle-fill flex-shrink-0"></i>
            <div>{successMsg}</div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
            <div>{error}</div>
          </div>
        )}

        {devOtp && (
          <div className="otp-dev-badge">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-bug-fill"></i>
              <span>Dev Demo OTP: <strong>{devOtp}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setOtp(devOtp)}
              title="Auto-fill OTP"
            >
              Fill Code
            </button>
          </div>
        )}

        <form onSubmit={handleVerifyOtp}>
          <div className="otp-input-container">
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="otp-single-input"
              placeholder="••••••"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setOtp(val);
                if (error) setError('');
              }}
              required
              autoComplete="one-time-code"
            />
          </div>

          <div className="otp-resend-row">
            <span>Didn't receive the email?</span>
            {resendCountdown > 0 ? (
              <span className="resend-timer-badge">
                Resend in {resendCountdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="resend-btn"
              >
                Resend Code
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 4}
            className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <>
                <span>Verify OTP & Continue</span>
                <i className="bi bi-arrow-right"></i>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="btn btn-light w-100 py-2 text-secondary fw-semibold small"
          >
            Cancel & Return to Sign In
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: STEP 1 - REQUEST OTP (FORGOT EMAIL)
  // ---------------------------------------------------------------------------
  if (view === 'forgot') {
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <button
            type="button"
            onClick={handleBackToLogin}
            className="auth-back-btn mb-0"
          >
            <i className="bi bi-arrow-left"></i>
            <span>Back to sign in</span>
          </button>
          <div className="step-indicator active mb-0">
            <i className="bi bi-envelope-paper-fill"></i>
            <span>Step 1 of 3</span>
          </div>
        </div>

        <h3 className="auth-header-title">Forgot your password?</h3>
        <p className="auth-header-subtitle">
          No worries. Enter your registered account email and we'll dispatch a secure verification code to reset it.
        </p>

        {error && (
          <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
            <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSendOtp}>
          <div className="mb-4">
            <label className="form-label small fw-semibold text-secondary">Account Email Address</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-envelope text-muted"></i>
              </span>
              <input
                type="email"
                className="form-control border-start-0 ps-0"
                placeholder="you@company.com"
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value);
                  if (error) setError('');
                }}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status"></span>
            ) : (
              <>
                <span>Send Verification OTP</span>
                <i className="bi bi-send-fill"></i>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="btn btn-light w-100 py-2 text-secondary fw-semibold small"
          >
            Remember password? Sign In
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: DEFAULT - LOGIN FORM
  // ---------------------------------------------------------------------------
  return (
    <div>
      <h3 className="auth-header-title">Welcome back</h3>
      <p className="auth-header-subtitle">Sign in to your WhatsApp marketing workspace</p>

      {successMsg && (
        <div className="alert alert-success py-2 small d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-check-circle-fill flex-shrink-0"></i>
          <div>{successMsg}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleLoginSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Email address</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">
              <i className="bi bi-envelope text-muted"></i>
            </span>
            <input
              type="email"
              className="form-control border-start-0 ps-0"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-semibold text-secondary mb-0">Password</label>
            <button
              type="button"
              onClick={startForgotPassword}
              className="forgot-password-link"
            >
              Forgot password?
            </button>
          </div>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">
              <i className="bi bi-lock text-muted"></i>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control border-start-0 border-end-0 ps-0"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary border-start-0"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
        >
          {loading ? (
            <span className="spinner-border spinner-border-sm" role="status"></span>
          ) : (
            <>
              <span>Sign In to Workspace</span>
              <i className="bi bi-arrow-right"></i>
            </>
          )}
        </button>
      </form>

      {registrationOpen ? (
        <div className="text-center mt-4 text-muted small">
          First-time setup? <Link to="/register" className="fw-semibold text-success text-decoration-none">Create owner workspace</Link>
        </div>
      ) : (
        <div className="text-center mt-4 text-muted small">
          Invite-only workspace. Contact your Workspace Owner for access.
        </div>
      )}

      <div className="auth-footer-links">
        <Link to="/privacy" className="me-2">Privacy Policy</Link>
        <span className="auth-footer-divider">•</span>
        <Link to="/terms" className="ms-2">Terms of Service</Link>
      </div>
    </div>
  );
}
