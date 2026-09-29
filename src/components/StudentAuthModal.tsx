import React, { useState } from 'react';
import { X, Mail, Lock, User, CheckCircle2, ArrowRight, Key, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { StudentUser } from '../types';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: StudentUser) => void;
  initialMode?: 'login' | 'signup';
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset-code'>(initialMode);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
    }
  }, [isOpen, initialMode]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Sign up form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupYear, setSignupYear] = useState('3rd Year');
  const [signupSemester, setSignupSemester] = useState('Semester 5');

  // Forgot / Reset password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [generatedCodeNotification, setGeneratedCodeNotification] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.studentLogin(loginEmail, loginPassword, rememberMe);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.studentSignup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        year: signupYear,
        semester: signupSemester,
      });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setGeneratedCodeNotification(null);

    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotSuccess(res.message);
      if (res.resetCode) {
        setGeneratedCodeNotification(res.resetCode);
        setResetCode(res.resetCode); // pre-populate for convenience
      }
      setMode('reset-code');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch password recovery request.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.resetPassword({
        email: forgotEmail,
        resetCode,
        newPassword,
      });
      setForgotSuccess(res.message);
      setLoginEmail(forgotEmail);
      setLoginPassword('');
      setGeneratedCodeNotification(null);
      setMode('login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Resolve Google Client ID from environment variable or backend configuration
      let googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      if (!googleClientId || googleClientId.trim() === '') {
        const config = await api.getAuthConfig();
        googleClientId = config.googleClientId;
      }

      if (!googleClientId || googleClientId.trim() === '') {
        setError(
          'Google Client ID is not configured. Please define VITE_GOOGLE_CLIENT_ID in your environment variables to enable Google Workspace Sign-In.'
        );
        setLoading(false);
        return;
      }

      // 2. Ensure Google Identity Services SDK is loaded
      let google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        // Wait or dynamically load script if not yet ready
        await new Promise<void>((resolve, reject) => {
          if ((window as any).google?.accounts?.oauth2) {
            resolve();
            return;
          }
          const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services library.')));
            // Safety timeout
            setTimeout(() => {
              if ((window as any).google?.accounts?.oauth2) resolve();
              else reject(new Error('Timed out waiting for Google Identity Services SDK.'));
            }, 3000);
          } else {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Identity Services library.'));
            document.head.appendChild(script);
          }
        });
        google = (window as any).google;
      }

      if (!google?.accounts?.oauth2) {
        throw new Error('Google Identity Services SDK is unavailable in this browser environment.');
      }

      // 3. Initialize real Google OAuth 2.0 Token Client
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        error_callback: (errorResponse: any) => {
          setLoading(false);
          const detail = errorResponse?.message || errorResponse?.type || 'Authorization popup was closed or blocked.';
          setError(`Google authorization error: ${detail}`);
        },
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.access_token) {
            try {
              const res = await api.googleLogin({ accessToken: tokenResponse.access_token });
              onSuccess(res.user);
              onClose();
            } catch (authErr: any) {
              setError(authErr.message || 'Google authentication failed on verification.');
            }
          } else if (tokenResponse?.error) {
            setError(`Google authorization error: ${tokenResponse.error_description || tokenResponse.error}`);
          }
          setLoading(false);
        },
      });

      // 4. Trigger real Google account selection popup
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] border border-[#E5DFD5] w-full max-w-md rounded-xl shadow-2xl p-6 sm:p-8 relative animate-in fade-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#5C6F68] hover:text-[#1C2826] hover:bg-[#E5DFD5]/50 rounded-md transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <span className="text-[10px] tracking-widest uppercase text-[#0F5132] font-semibold block mb-1">
            Student Examination Repository
          </span>
          <h3 className="text-2xl font-serif-academic font-bold text-[#1C2826]">
            {mode === 'login'
              ? 'Student Sign In'
              : mode === 'signup'
              ? 'Create Student Account'
              : mode === 'forgot'
              ? 'Password Recovery'
              : 'Set New Password'}
          </h3>
          <p className="text-xs text-[#5C6F68] mt-1">
            {mode === 'login'
              ? 'Sign in with your verified college credentials to download papers and track bookmarks'
              : mode === 'signup'
              ? 'Register with your college email address to access question archives'
              : mode === 'forgot'
              ? 'Enter your registered college email to generate an authentic reset verification code'
              : 'Enter the verification code and your new account password'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-md">
            {error}
          </div>
        )}

        {forgotSuccess && (
          <div className="mb-4 p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs rounded-md flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
            <span>{forgotSuccess}</span>
          </div>
        )}

        {generatedCodeNotification && (
          <div className="mb-4 p-3 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF] text-xs rounded-md space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Key className="w-4 h-4 text-[#2563EB]" />
              <span>Academic Reset Code Generated:</span>
            </div>
            <p className="text-[11px] text-[#1E3A8A]">
              Your 6-digit authorization code is: <strong className="font-mono text-sm tracking-wider text-[#1D4ED8] bg-white px-2 py-0.5 rounded border border-[#93C5FD] ml-1">{generatedCodeNotification}</strong>
            </p>
          </div>
        )}

        {/* Mode: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] text-[#1C2826]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#1C2826]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setForgotSuccess('');
                    setMode('forgot');
                  }}
                  className="text-[11px] text-[#0F5132] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132] text-[#1C2826]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#5C6F68]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded text-[#0F5132] focus:ring-[#0F5132]"
                />
                <span>Remember Me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail('student@college.edu');
                  setLoginPassword('password123');
                  setError('');
                }}
                className="text-[11px] text-[#0F5132] font-semibold hover:underline"
              >
                Fill Demo Credentials
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? 'Authenticating...' : 'Sign In to Archive'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5DFD5]"></div>
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-[#FAF8F5] px-2 text-[#5C6F68]">Institutional Single Sign-On</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-2 px-3 text-xs font-medium text-[#1C2826] bg-white border border-[#E5DFD5] hover:bg-[#F5F1EB] rounded-md transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google Workspace</span>
            </button>

            <div className="text-center pt-3 text-xs text-[#5C6F68]">
              Don't have an archive account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotSuccess('');
                  setMode('signup');
                }}
                className="text-[#0F5132] font-semibold hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* Mode: SIGNUP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="your.roll@college.edu"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  B.Tech Year
                </label>
                <select
                  value={signupYear}
                  onChange={e => setSignupYear(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                  Semester
                </label>
                <select
                  value={signupSemester}
                  onChange={e => setSignupSemester(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Repeat your password"
                  value={signupConfirmPassword}
                  onChange={e => setSignupConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="text-center pt-2 text-xs text-[#5C6F68]">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotSuccess('');
                  setMode('login');
                }}
                className="text-[#0F5132] font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* Mode: FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Enter Registered College Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-60"
            >
              {loading ? 'Generating Code...' : 'Request Verification Code'}
            </button>

            <div className="text-center pt-2 text-xs text-[#5C6F68]">
              Remembered your credentials?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotSuccess('');
                  setMode('login');
                }}
                className="text-[#0F5132] font-semibold hover:underline"
              >
                Return to Login
              </button>
            </div>
          </form>
        )}

        {/* Mode: RESET CODE & NEW PASSWORD */}
        {mode === 'reset-code' && (
          <form onSubmit={handleResetSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono tracking-widest bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E5DFD5] rounded-md focus:outline-none focus:border-[#0F5132]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-md transition-colors shadow-xs disabled:opacity-60"
            >
              {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
            </button>

            <div className="text-center pt-2 text-xs text-[#5C6F68]">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setForgotSuccess('');
                  setMode('login');
                }}
                className="text-[#0F5132] font-semibold hover:underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
