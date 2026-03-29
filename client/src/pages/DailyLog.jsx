import React, { useEffect, useState, useRef } from 'react';
import { sessionsAPI, dailyAPI } from '../utils/api';
import toast from 'react-hot-toast';

function toDateStr(d) {
  return new Date(d).toISOString().split('T')[0];
}

function getYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function YouTubeCard({ url, onRemove }) {
  const id = getYouTubeId(url);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
      {id ? (
        <img
          src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
          alt="thumbnail"
          className="w-20 h-12 rounded-lg object-cover flex-shrink-0"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-20 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">▶</span>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 hover:underline truncate"
      >
        {url}
      </a>
      <button
        onClick={onRemove}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}


export default function DailyLog() {
  const today = toDateStr(new Date());
  const [commitment, setCommitment] = useState(null); // null = loading
  const [sessions, setSessions] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Study log form state
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [linkInput, setLinkInput] = useState('');
  const [youtubeLinks, setYoutubeLinks] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const linkRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const [commitRes, sessRes] = await Promise.all([
        dailyAPI.getToday(),
        sessionsAPI.getAll({ startDate: today, endDate: today }),
      ]);
      const c = commitRes.data.commitment;
      setCommitment(c);
      if (c) {
        setStudyMinutes(c.studyMinutes || 0);
        setYoutubeLinks(c.youtubeLinks || []);
        setNotes(c.notes || '');
      }
      setSessions(sessRes.data.sessions);
      setTotalMinutes(sessRes.data.sessions.reduce((s, sess) => s + (sess.durationMinutes || 0), 0));
    } catch {
      toast.error('Failed to load today\'s data');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setActing(true);
    try {
      const res = await dailyAPI.commit();
      setCommitment(res.data.commitment);
      toast.success('Great! Let\'s get studying 🎯');
    } catch { toast.error('Failed to update'); }
    finally { setActing(false); }
  };

  const handleSkip = async () => {
    setActing(true);
    try {
      const res = await dailyAPI.skip();
      setCommitment(res.data.commitment);
      toast('Rest well. A motivation email has been sent 💌', { icon: '🌙' });
    } catch { toast.error('Failed to update'); }
    finally { setActing(false); }
  };

  const handleSaveLog = async () => {
    setSaving(true);
    try {
      const res = await dailyAPI.update({ studyMinutes: Number(studyMinutes), youtubeLinks, notes });
      setCommitment(res.data.commitment);
      toast.success('Today\'s log saved!');
    } catch { toast.error('Failed to save log'); }
    finally { setSaving(false); }
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) return toast.error('Enter a valid URL');
    if (youtubeLinks.includes(url)) return toast.error('Link already added');
    setYoutubeLinks((l) => [...l, url]);
    setLinkInput('');
    linkRef.current?.focus();
  };

  const removeLink = (idx) => setYoutubeLinks((l) => l.filter((_, i) => i !== idx));

  const fmtTime = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const subjectBreakdown = sessions.reduce((acc, s) => {
    acc[s.subject] = (acc[s.subject] || 0) + (s.durationMinutes || 0);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-zinc-300 dark:border-zinc-600 border-t-zinc-800 dark:border-t-zinc-200 rounded-full animate-spin" />
      </div>
    );
  }

  const dayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Today's Learning</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">{dayLabel}</p>
      </div>

      {/* ── Commitment card ── */}
      {!commitment || commitment.status === 'pending' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📖</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Will you study today?</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
              Mark your commitment for the day. This helps track your consistency.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleCommit}
                disabled={acting}
                className="flex-1 max-w-[180px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-3.5 px-6 rounded-xl hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-all disabled:opacity-50"
              >
                {acting ? '...' : '✓ Yes, I will study'}
              </button>
              <button
                onClick={handleSkip}
                disabled={acting}
                className="flex-1 max-w-[160px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold py-3.5 px-6 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
              >
                {acting ? '...' : '✗ Rest day'}
              </button>
            </div>
          </div>
        </div>
      ) : commitment.status === 'skipped' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-2xl">
              🌙
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Rest day marked</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                A motivation email has been sent to you. Come back tomorrow stronger!
              </p>
              <button
                onClick={handleCommit}
                disabled={acting}
                className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-300 hover:underline"
              >
                Changed your mind? Mark as study day →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* committed — show study log */
        <>
          {/* Status banner */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">
            <span className="text-xl">🎯</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Committed to study today!</p>
              <p className="text-xs opacity-70 mt-0.5">Log your progress below</p>
            </div>
            <button
              onClick={handleSkip}
              disabled={acting}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity"
            >
              Mark as rest day
            </button>
          </div>

          {/* Study time + quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Timer Sessions', value: sessions.length, unit: '' },
              { label: 'Timer Time', value: fmtTime(totalMinutes), unit: '' },
              { label: 'Logged Time', value: fmtTime(commitment.studyMinutes), unit: '' },
            ].map((s) => (
              <div key={s.label} className="card text-center p-4">
                <p className="text-xl font-bold text-zinc-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-zinc-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Study log form */}
          <div className="card space-y-5">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Update Today's Log</h3>

            {/* Manual study time */}
            <div>
              <label className="label">Total study time today (minutes)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={studyMinutes}
                  onChange={(e) => setStudyMinutes(Math.max(0, Number(e.target.value)))}
                  className="input w-32"
                  min={0}
                  max={720}
                  step={5}
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  = {fmtTime(Number(studyMinutes))}
                </span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[30, 60, 90, 120, 180, 240].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStudyMinutes(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                      Number(studyMinutes) === m
                        ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input resize-none h-20"
                placeholder="What did you study today? Any challenges?"
              />
            </div>

            {/* YouTube links */}
            <div>
              <label className="label">YouTube / Resource Links</label>
              <div className="flex gap-2">
                <input
                  ref={linkRef}
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  className="input flex-1"
                  placeholder="https://youtube.com/watch?v=..."
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="btn-secondary px-4 flex-shrink-0"
                >
                  Add
                </button>
              </div>
              {youtubeLinks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {youtubeLinks.map((url, i) => (
                    <YouTubeCard key={i} url={url} onRemove={() => removeLink(i)} />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveLog}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? 'Saving...' : 'Save Today\'s Log'}
            </button>
          </div>
        </>
      )}

      {/* Today's timer sessions */}
      {sessions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Timer Sessions Today</h3>
            <span className="text-xs text-zinc-400">{fmtTime(totalMinutes)} total</span>
          </div>

          {/* Subject breakdown bars */}
          {Object.keys(subjectBreakdown).length > 0 && (
            <div className="mb-4 space-y-2">
              {Object.entries(subjectBreakdown).sort(([, a], [, b]) => b - a).map(([subj, mins]) => (
                <div key={subj}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">{subj}</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{fmtTime(mins)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-700 dark:bg-zinc-300 rounded-full" style={{ width: `${Math.round((mins / totalMinutes) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id || s._id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{s.topic}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{s.subject}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{s.durationMinutes}m</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(s.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && commitment?.status === 'committed' && (
        <div className="card text-center py-8">
          <p className="text-3xl mb-3">⏱️</p>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">No timer sessions yet today.</p>
          <p className="text-xs text-zinc-400 mt-1">Use the Study Timer to start tracking automatically.</p>
        </div>
      )}
    </div>
  );
}
