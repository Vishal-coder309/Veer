import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../utils/api';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({
    name: user?.name || '',
    dailyGoalMinutes: user?.dailyGoalMinutes || 240,
    targetYear: user?.targetYear || new Date().getFullYear() + 1,
    notificationsEnabled: user?.notificationsEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [mailing, setMailing] = useState(null); // 'test' | 'reminder' | 'report' | null
  const [reminder, setReminder] = useState({
    enabled: user?.reminderSettings?.enabled ?? false,
    time: user?.reminderSettings?.time || '20:00',
    days: user?.reminderSettings?.days || [1, 2, 3, 4, 5, 6, 0],
  });
  const [savingReminder, setSavingReminder] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [pinForm, setPinForm] = useState({ pin: '', confirm: '' });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({
        name: form.name,
        dailyGoalMinutes: Number(form.dailyGoalMinutes),
        targetYear: Number(form.targetYear),
        notificationsEnabled: form.notificationsEnabled,
      });
      updateUser(res.data.user);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const GOAL_PRESETS = [
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
    { label: '4h', value: 240 },
    { label: '5h', value: 300 },
    { label: '6h', value: 360 },
    { label: '8h', value: 480 },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Customize your VEER experience</p>
      </div>

      {/* Profile */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Profile</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input"
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              className="input opacity-60 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="label">Target Exam Year</label>
            <select name="targetYear" value={form.targetYear} onChange={handleChange} className="select">
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>SSC CGL {y}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Daily Goal */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Daily Study Goal</h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
          Set how many minutes you aim to study each day
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {GOAL_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, dailyGoalMinutes: p.value }))}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                Number(form.dailyGoalMinutes) === p.value
                  ? 'bg-zinc-800 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="dailyGoalMinutes"
            value={form.dailyGoalMinutes}
            onChange={handleChange}
            className="input w-28"
            min={30}
            max={720}
            step={15}
          />
          <span className="text-sm text-gray-500 dark:text-zinc-400">minutes per day</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary mt-4">
          {saving ? 'Saving...' : 'Save Goal'}
        </button>
      </div>

      {/* Appearance */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Easy on the eyes at night</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 ${
              theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Daily Study Reminder</p>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Get reminded if you haven't studied today</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, notificationsEnabled: !f.notificationsEnabled }))}
            className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 ${
              form.notificationsEnabled ? 'bg-zinc-800' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${
                form.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary mt-4">
          {saving ? 'Saving...' : 'Save Notification Settings'}
        </button>

        {/* Email action buttons */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Email Actions</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                setMailing('test');
                try {
                  await api.post('/notifications/test');
                  toast.success(`Test email sent to ${user?.email}`);
                } catch { toast.error('Failed to send email'); }
                finally { setMailing(null); }
              }}
              disabled={!!mailing}
              className="btn-secondary text-sm py-2 px-4"
            >
              {mailing === 'test' ? 'Sending...' : '✉️ Send Test Email'}
            </button>
            <button
              onClick={async () => {
                setMailing('reminder');
                try {
                  await api.post('/notifications/reminder');
                  toast.success('Study reminder sent!');
                } catch { toast.error('Failed to send reminder'); }
                finally { setMailing(null); }
              }}
              disabled={!!mailing}
              className="btn-secondary text-sm py-2 px-4"
            >
              {mailing === 'reminder' ? 'Sending...' : '⏰ Send Study Reminder'}
            </button>
            <button
              onClick={async () => {
                setMailing('report');
                try {
                  await api.post('/notifications/weekly-report');
                  toast.success('Weekly report sent!');
                } catch { toast.error('Failed to send report'); }
                finally { setMailing(null); }
              }}
              disabled={!!mailing}
              className="btn-secondary text-sm py-2 px-4"
            >
              {mailing === 'report' ? 'Sending...' : '📊 Send Weekly Report'}
            </button>
          </div>
          <p className="text-xs text-gray-400">All emails are sent to: {user?.email}</p>
        </div>
      </div>

      {/* ── Email Reminder Scheduler ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Study Reminder Schedule</h3>
        <p className="text-xs text-gray-400 mb-4">Sends a daily email asking if you will study today. Reply in the app to log your commitment.</p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-gray-900 dark:text-white text-sm">Enable daily reminder</p>
          </div>
          <button
            type="button"
            onClick={() => setReminder((r) => ({ ...r, enabled: !r.enabled }))}
            className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 ${
              reminder.enabled ? 'bg-zinc-800' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${reminder.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {reminder.enabled && (
          <div className="space-y-4 animate-fade-in">
            {/* Time picker */}
            <div>
              <label className="label">Reminder Time (IST)</label>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => setReminder((r) => ({ ...r, time: e.target.value }))}
                className="input w-36"
              />
            </div>

            {/* Days picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Reminder Days</label>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Working day
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Rest day
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Mon', val: 1 }, { label: 'Tue', val: 2 }, { label: 'Wed', val: 3 },
                  { label: 'Thu', val: 4 }, { label: 'Fri', val: 5 }, { label: 'Sat', val: 6 }, { label: 'Sun', val: 0 },
                ].map(({ label, val }) => {
                  const active = reminder.days.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReminder((r) => ({
                        ...r,
                        days: active
                          ? r.days.filter((d) => d !== val)
                          : [...r.days, val],
                      }))}
                      className={`w-12 h-10 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-400/60 text-rose-700 dark:text-rose-300'
                      }`}
                      title={active ? 'Working day (reminder ON)' : 'Rest day (reminder OFF)'}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            setSavingReminder(true);
            try {
              await api.put('/auth/reminder-settings', reminder);
              updateUser({ reminderSettings: reminder });
              toast.success('Reminder schedule saved!');
            } catch { toast.error('Failed to save reminder'); }
            finally { setSavingReminder(false); }
          }}
          disabled={savingReminder}
          className="btn-primary mt-4"
        >
          {savingReminder ? 'Saving...' : 'Save Reminder Schedule'}
        </button>
      </div>

      {/* ── Change PIN ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">PIN Management</h3>
        <p className="text-xs text-gray-400 mb-4">Update your quick-login PIN (4–6 digits)</p>
        <div className="space-y-3">
          <div>
            <label className="label">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinForm.pin}
              onChange={(e) => setPinForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className="input w-40 text-center text-xl tracking-widest font-bold"
              placeholder="● ● ● ●"
            />
          </div>
          <div>
            <label className="label">Confirm New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinForm.confirm}
              onChange={(e) => setPinForm((p) => ({ ...p, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className="input w-40 text-center text-xl tracking-widest font-bold"
              placeholder="● ● ● ●"
            />
          </div>
          <button
            onClick={async () => {
              if (pinForm.pin.length < 4) return toast.error('PIN must be at least 4 digits');
              if (pinForm.pin !== pinForm.confirm) return toast.error('PINs do not match');
              setChangingPin(true);
              try {
                await api.put('/auth/change-pin', { pin: pinForm.pin });
                toast.success('PIN updated successfully!');
                setPinForm({ pin: '', confirm: '' });
              } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to update PIN');
              } finally { setChangingPin(false); }
            }}
            disabled={changingPin}
            className="btn-primary"
          >
            {changingPin ? 'Updating...' : 'Update PIN'}
          </button>
        </div>
      </div>

      {/* Exam info */}
      <div className="card bg-gradient-to-r from-zinc-50 to-accent-50/30 dark:from-zinc-900/20 dark:to-accent-900/10 border-zinc-100 dark:border-zinc-800/30">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">SSC CGL Exam Pattern</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { tier: 'Tier I', qs: '100 questions', marks: '200 marks', time: '60 min' },
            { tier: 'Tier II', qs: '390 questions', marks: '390 marks', time: '2.5 hrs' },
          ].map((t) => (
            <div key={t.tier} className="p-3 rounded-xl bg-white dark:bg-zinc-800">
              <p className="font-bold text-zinc-700 dark:text-zinc-400">{t.tier}</p>
              <p className="text-gray-600 dark:text-zinc-400 text-xs mt-1">{t.qs} • {t.marks}</p>
              <p className="text-gray-500 dark:text-gray-500 text-xs">{t.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
