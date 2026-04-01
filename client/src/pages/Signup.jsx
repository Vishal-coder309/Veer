import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }) {
  const labels = ['Email & Password', 'Verify OTP', 'Set Username & PIN'];
  return (
    <div className="flex items-center gap-1 mb-8">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current ? 'bg-zinc-600 text-white' :
              i === current ? 'bg-zinc-800 text-white' :
              'bg-gray-200 dark:bg-zinc-700 text-gray-400'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <p className={`text-xs mt-1 text-center leading-tight hidden sm:block ${
              i === current ? 'text-zinc-800 dark:text-zinc-500 font-semibold' : 'text-gray-400'
            }`}>{label}</p>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 transition-all ${i < current ? 'bg-zinc-600' : 'bg-gray-200 dark:bg-zinc-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── OTP boxes (6 individual inputs) ─────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = val;
    onChange(next.join(''));
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center my-6" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          className={`w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 focus:outline-none transition-all
            ${digits[i]
              ? 'border-zinc-500 bg-zinc-50 dark:bg-primary-900/20 text-primary-700 dark:text-zinc-400'
              : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100'
            } focus:border-zinc-500`}
        />
      ))}
    </div>
  );
}

// ─── PIN input (4–6 digits, shown as dots) ────────────────────────────────────
function PinInput({ label, value, onChange, placeholder = '● ● ● ●' }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input pr-12 text-center text-xl tracking-widest font-bold"
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Signup() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 0 fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Step 1 fields
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');       // JWT after OTP verify

  // Step 2 fields
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Step 0 → send OTP ─────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/auth/register', { email, password });
      toast.success(`OTP sent to ${email}`);
      setStep(1);
      setResendCooldown(30);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1 → verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp });
      setToken(res.data.token);
      setUsername(res.data.user.username);
      localStorage.setItem('veer_token', res.data.token);
      toast.success('Email verified! ✅');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New OTP sent!');
      setResendCooldown(30);
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → complete profile ─────────────────────────────────────────────
  const handleSetupProfile = async (e) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      return toast.error('Username: 3–30 chars, lowercase letters/numbers/underscore only');
    if (pin.length < 4) return toast.error('PIN must be at least 4 digits');
    if (pin !== pinConfirm) return toast.error('PINs do not match');

    setLoading(true);
    try {
      const res = await api.post(
        '/auth/setup-profile',
        { username: username.toLowerCase(), pin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update auth context AND localStorage so the app recognizes the logged-in user
      const user = { ...res.data.user };
      localStorage.setItem('veer_user', JSON.stringify(user));
      updateUser(user);
      toast.success('Account ready! Welcome to VEER 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-500 to-zinc-600 items-center justify-center mb-3 shadow-2xl">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your VEER account</h1>
          <p className="text-slate-400 mt-1 text-sm">SSC CGL Study Tracker</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-7">
          <Steps current={step} />

          {/* ── STEP 0: Email + Password ── */}
          {step === 0 && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
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
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-11"
                    placeholder="Min. 6 characters"
                    required
                  />
                  <button type="button" onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending OTP...</span>
                  : 'Send Verification OTP →'}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-zinc-400 pt-1">
                Already have an account?{' '}
                <Link to="/login" className="text-zinc-800 dark:text-zinc-500 font-semibold hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {/* ── STEP 1: OTP Verification ── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <p className="text-center text-gray-600 dark:text-zinc-400 text-sm mb-1">
                We sent a <strong>6-digit OTP</strong> to
              </p>
              <p className="text-center font-semibold text-gray-900 dark:text-white text-sm">{email}</p>
              <p className="text-center text-xs text-zinc-500 mt-1">⏱ Expires in 5 minutes</p>

              <OtpInput value={otp} onChange={setOtp} />

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                className="btn-primary w-full"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verifying...</span>
                  : 'Verify OTP ✓'}
              </button>

              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={() => { setStep(0); setOtp(''); }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="text-sm text-zinc-800 dark:text-zinc-500 disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Username + PIN ── */}
          {step === 2 && (
            <form onSubmit={handleSetupProfile} className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="input pl-8"
                    placeholder="username"
                    maxLength={30}
                    required
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Auto-generated from your email. You can change it.</p>
              </div>

              <PinInput
                label="Set your PIN (4–6 digits)"
                value={pin}
                onChange={setPin}
                placeholder="Enter PIN"
              />
              <PinInput
                label="Confirm PIN"
                value={pinConfirm}
                onChange={setPinConfirm}
                placeholder="Re-enter PIN"
              />

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-zinc-800 dark:text-zinc-400">
                  💡 You can use this PIN instead of your password to log in quickly.
                </p>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Setting up...</span>
                  : 'Complete Setup 🚀'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
