import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Login() {
  useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [credentialType, setCredentialType] = useState('password'); // 'password' | 'pin'
  const [showCredential, setShowCredential] = useState(false);
  const [loading, setLoading] = useState(false);

  // For unverified redirect
  const [needsVerify, setNeedsVerify] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Call API directly so we can pass credentialType
      const res = await api.post('/auth/login', { email, credential, credentialType });
      const { token, user } = res.data;
      localStorage.setItem('veer_token', token);
      localStorage.setItem('veer_user', JSON.stringify(user));
      // Manually update auth context state via re-read
      window.location.href = '/dashboard';
    } catch (err) {
      const data = err.response?.data;
      if (data?.action === 'verify') {
        // Email not verified — send user to signup step 1 continuation
        setNeedsVerify(true);
        toast.error('Email not verified. Please check your inbox for the OTP.');
      } else {
        toast.error(data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('demo@veer.com');
    setCredential('demo123');
    setCredentialType('password');
  };

  const isPinMode = credentialType === 'pin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-500 to-zinc-600 items-center justify-center mb-4 shadow-2xl">
            <span className="text-white font-bold text-3xl">V</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 mt-1">Sign in to VEER</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            {/* Credential type toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">
                  {isPinMode ? 'PIN' : 'Password'}
                </label>
                {/* Toggle pill */}
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 text-xs">
                  <button
                    type="button"
                    onClick={() => { setCredentialType('password'); setCredential(''); setShowCredential(false); }}
                    className={`px-3 py-1 font-semibold transition-colors ${
                      !isPinMode
                        ? 'bg-zinc-800 text-white'
                        : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    🔐 Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCredentialType('pin'); setCredential(''); setShowCredential(false); }}
                    className={`px-3 py-1 font-semibold transition-colors ${
                      isPinMode
                        ? 'bg-zinc-800 text-white'
                        : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    🔢 PIN
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showCredential ? 'text' : 'password'}
                  inputMode={isPinMode ? 'numeric' : 'text'}
                  maxLength={isPinMode ? 6 : undefined}
                  value={credential}
                  onChange={(e) => {
                    const val = isPinMode
                      ? e.target.value.replace(/\D/g, '').slice(0, 6)
                      : e.target.value;
                    setCredential(val);
                  }}
                  className={`input pr-11 ${isPinMode ? 'text-center text-xl tracking-widest font-bold' : ''}`}
                  placeholder={isPinMode ? '● ● ● ●' : '••••••••'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCredential((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showCredential ? '🙈' : '👁️'}
                </button>
              </div>

              {isPinMode && (
                <p className="text-xs text-gray-400 mt-1">
                  Enter the 4–6 digit PIN you set during signup
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : `Sign In with ${isPinMode ? 'PIN' : 'Password'}`}
            </button>
          </form>

          {/* Unverified email message */}
          {needsVerify && (
            <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
              <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
                ⚠️ Your email isn't verified yet.{' '}
                <Link to="/signup" className="underline font-semibold">
                  Go back to signup to enter OTP
                </Link>
              </p>
            </div>
          )}

          {/* Demo account */}
          <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs text-zinc-800 dark:text-zinc-400 font-medium mb-1">Try Demo Account</p>
            <button type="button" onClick={fillDemo} className="text-xs text-zinc-800 dark:text-zinc-500 hover:underline">
              Click to fill: demo@veer.com / demo123
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-zinc-800 dark:text-zinc-500 font-semibold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
