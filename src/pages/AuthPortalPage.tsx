import React, { useState, useEffect } from 'react';
import {
  Shield,
  GraduationCap,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { StudentUser, AdminUser } from '../types';

interface AuthPortalPageProps {
  onStudentAuthenticated: (student: StudentUser) => void;
  onAdminAuthenticated: (admin: AdminUser) => void;
  initialTab?: 'student-login' | 'student-signup' | 'admin-login';
}

declare global {
  interface Window {
    google?: any;
  }
}

export const AuthPortalPage: React.FC<AuthPortalPageProps> = ({
  onStudentAuthenticated,
  onAdminAuthenticated,
  initialTab = 'student-login',
}) => {
  const [activeTab, setActiveTab] = useState<'student-login' | 'student-signup' | 'admin-login'>(initialTab);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');

  // Synchronize activeTab when initialTab prop updates from navigation buttons
  useEffect(() => {
    setActiveTab(initialTab);
    setIsForgotMode(false);
    setError('');
  }, [initialTab]);

  // Student Login State
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Student Signup State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupYear, setSignupYear] = useState('1st Year');
  const [signupSemester, setSignupSemester] = useState('Semester 1');

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Password Recovery State
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotNotification, setForgotNotification] = useState<string | null>(null);

  // Status & Google Auth State
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Google Client ID
  useEffect(() => {
    async function loadGoogleConfig() {
      try {
        const cfg = await api.getAuthConfig();
        if (cfg.googleClientId) {
          setGoogleClientId(cfg.googleClientId);
        }
      } catch {
        // Non-fatal
      }
    }
    loadGoogleConfig();
  }, []);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      const res = await api.studentLogin(studentEmail, studentPassword, rememberMe);
      onStudentAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your student email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.studentSignup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        year: signupYear,
        semester: signupSemester,
      });
      onStudentAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Account registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);

    try {
      const res = await api.adminLogin(adminEmail, adminPassword);
      onAdminAuthenticated(res.admin);
    } catch (err: any) {
      setError(err.message || 'Administrative authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError('');
    if (!googleClientId) {
      setError(
        'Google OAuth Client ID is not configured on this server. Please contact administrator or sign in using your college email and password.'
      );
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError('Google Identity Services script is loading. Please retry in a moment.');
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setError(`Google authorization error: ${tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            setSubmitting(true);
            try {
              const res = await api.googleLogin({ accessToken: tokenResponse.access_token });
              if (res.user) {
                onStudentAuthenticated(res.user);
              }
            } catch (err: any) {
              setError(err.message || 'Google account verification failed on server.');
            } finally {
              setSubmitting(false);
            }
          }
        },
      });

      client.requestAccessToken();
    } catch (err: any) {
      setError(`Failed to open Google authorization: ${err.message}`);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotNotification(res.message);
      if (res.resetCode) {
        setResetCode(res.resetCode);
      }
      setForgotStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to generate password recovery code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
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

    setSubmitting(true);

    try {
      const res = await api.resetPassword({
        email: forgotEmail,
        resetCode,
        newPassword,
      });
      setSuccessMessage(res.message);
      setIsForgotMode(false);
      setForgotStep('request');
      setStudentEmail(forgotEmail);
      setActiveTab('student-login');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="w-full max-w-xl">
        {/* Security Shield Banner */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#E8F5E9] border border-[#A7F3D0] rounded-full text-[#0F5132] text-xs font-semibold tracking-wide uppercase">
            <Shield className="w-3.5 h-3.5" />
            <span>Restricted Institutional Repository</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif-academic font-bold text-[#1C2826] tracking-tight">
            Institutional Authentication Required
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6F68] max-w-md mx-auto leading-relaxed">
            All academic question papers, midterms, unit tests, and downloadable PDF folios are strictly protected. Sign in with your verified credentials to access the academic repository.
          </p>
        </div>

        {/* Main Portal Container */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD5] rounded-2xl shadow-xl overflow-hidden">
          {/* Top Portal Navigation Tabs */}
          {!isForgotMode && (
            <div className="grid grid-cols-3 border-b border-[#E5DFD5] bg-[#FAF8F5]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('student-login');
                  setError('');
                }}
                className={`py-3.5 px-3 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'student-login'
                    ? 'border-[#0F5132] text-[#0F5132] bg-white'
                    : 'border-transparent text-[#5C6F68] hover:text-[#1C2826]'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('student-signup');
                  setError('');
                }}
                className={`py-3.5 px-3 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'student-signup'
                    ? 'border-[#0F5132] text-[#0F5132] bg-white'
                    : 'border-transparent text-[#5C6F68] hover:text-[#1C2826]'
                }`}
              >
                <User className="w-4 h-4" />
                <span>New Student</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin-login');
                  setError('');
                }}
                className={`py-3.5 px-3 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTab === 'admin-login'
                    ? 'border-[#0F5132] text-[#0F5132] bg-white'
                    : 'border-transparent text-[#5C6F68] hover:text-[#1C2826]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Exam Cell Admin</span>
              </button>
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Feedback Alerts */}
            {error && (
              <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-lg flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 bg-[#F0FDF4] border border-[#86EFAC] text-[#166534] text-xs rounded-lg flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{successMessage}</div>
              </div>
            )}

            {/* TAB 1: Student Login */}
            {activeTab === 'student-login' && !isForgotMode && (
              <div className="space-y-5">
                {/* Google Workspace Auth Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-[#CBD5E1] hover:border-[#94A3B8] rounded-lg shadow-2xs hover:bg-[#F8FAFC] transition-colors text-xs font-semibold text-[#1C2826] disabled:opacity-50"
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

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E5DFD5]"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white px-2 text-[#5C6F68] font-mono-code">
                        or sign in with college email
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email + Password Form */}
                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                      College Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="student@college.edu"
                        value={studentEmail}
                        onChange={e => setStudentEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#1C2826]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotMode(true);
                          setForgotEmail(studentEmail);
                          setError('');
                        }}
                        className="text-[11px] text-[#0F5132] hover:underline font-semibold"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={studentPassword}
                        onChange={e => setStudentPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[#5C6F68]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="rounded border-[#E5DFD5] text-[#0F5132] focus:ring-[#0F5132]"
                      />
                      <span>Keep me signed in</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                  >
                    <span>{submitting ? 'Verifying Student Credentials...' : 'Sign In to Student Archive'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Quick Hint */}
                <div className="pt-3 border-t border-[#E5DFD5] text-center">
                  <p className="text-[11px] text-[#5C6F68]">
                    Don't have an institutional account yet?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('student-signup')}
                      className="text-[#0F5132] font-semibold hover:underline"
                    >
                      Register as a student
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Student Sign Up */}
            {activeTab === 'student-signup' && !isForgotMode && (
              <form onSubmit={handleStudentSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Patel"
                      value={signupName}
                      onChange={e => setSignupName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                    College Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="priya.patel@college.edu"
                      value={signupEmail}
                      onChange={e => setSignupEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Academic Enrollment Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                      B.Tech Year
                    </label>
                    <select
                      value={signupYear}
                      onChange={e => setSignupYear(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
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
                      className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                      Password (min. 6 chars)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={e => setSignupConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  <span>{submitting ? 'Creating Student Profile...' : 'Complete Registration & Open Archive'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-3 border-t border-[#E5DFD5] text-center">
                  <p className="text-[11px] text-[#5C6F68]">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('student-login')}
                      className="text-[#0F5132] font-semibold hover:underline"
                    >
                      Sign in to your account
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* TAB 3: Admin Login */}
            {activeTab === 'admin-login' && !isForgotMode && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="p-3 bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-[#0F5132]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Office of the Controller of Examinations</span>
                  </div>
                  <p className="text-[11px] text-[#5C6F68]">
                    Authorized administrative access for question paper curating, student registry moderation, and curricular updates.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                    Administrative Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="admin@college.edu"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                    Security Passkey
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#5C6F68] absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#5C6F68] text-[11px]">Role: Controller of Examinations</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1C2826] hover:bg-[#2D3E3A] rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                >
                  <Shield className="w-4 h-4" />
                  <span>{submitting ? 'Verifying Admin Authority...' : 'Access Admin Dashboard'}</span>
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD MODES */}
            {isForgotMode && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5DFD5]">
                  <h3 className="text-sm font-serif-academic font-bold text-[#1C2826]">
                    Reset Student Account Password
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setError('');
                    }}
                    className="text-xs text-[#5C6F68] hover:text-[#1C2826]"
                  >
                    Back to Sign In
                  </button>
                </div>

                {forgotStep === 'request' ? (
                  <form onSubmit={handleForgotRequest} className="space-y-4">
                    <p className="text-xs text-[#5C6F68]">
                      Enter your college email address. A 6-digit verification code will be issued to confirm your identity.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                        College Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="student@college.edu"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-lg transition-colors shadow-xs"
                    >
                      {submitting ? 'Generating Code...' : 'Send Verification Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetConfirm} className="space-y-4">
                    {forgotNotification && (
                      <div className="p-3 bg-[#E8F5E9] border border-[#A7F3D0] rounded-lg text-xs text-[#0F5132] flex items-start gap-2">
                        <Key className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{forgotNotification}</p>
                          <p className="text-[11px] text-[#5C6F68] mt-0.5">
                            Verification Code:{' '}
                            <span className="font-mono-code font-bold text-[#0F5132]">{resetCode}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={e => setResetCode(e.target.value)}
                        placeholder="123456"
                        className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white font-mono-code text-center tracking-widest text-base"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1C2826] mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={confirmNewPassword}
                          onChange={e => setConfirmNewPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg focus:outline-none focus:border-[#0F5132] focus:bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 px-4 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#064E3B] rounded-lg transition-colors shadow-xs"
                    >
                      {submitting ? 'Resetting Password...' : 'Save New Password & Sign In'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Security Footnote */}
        <p className="text-center text-[11px] text-[#5C6F68] mt-6">
          Athenaeum University Autonomous Examination Wing · Authorized Personnel Only · All access events are audited.
        </p>
      </div>
    </div>
  );
};
