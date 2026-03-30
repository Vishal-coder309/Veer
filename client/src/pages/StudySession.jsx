import React, { useState, useEffect, useRef } from 'react';
import { sessionsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const SUBJECTS = ['Quantitative Aptitude', 'Reasoning', 'English', 'General Knowledge'];

const SUBJECT_TOPICS = {
  'Quantitative Aptitude': ['Number System', 'Simplification', 'Percentage', 'Profit & Loss', 'Ratio & Proportion', 'Time & Work', 'Time, Speed & Distance', 'Mensuration', 'Geometry', 'Trigonometry', 'Algebra', 'Data Interpretation', 'Average', 'Simple Interest', 'Compound Interest'],
  Reasoning: ['Analogy', 'Classification', 'Series', 'Coding-Decoding', 'Direction & Distance', 'Blood Relations', 'Syllogism', 'Venn Diagrams', 'Puzzle', 'Seating Arrangement', 'Figure Counting', 'Paper Folding', 'Mirror Image', 'Dice', 'Matrix'],
  English: ['Reading Comprehension', 'Cloze Test', 'Fill in the Blanks', 'Error Detection', 'Synonyms', 'Antonyms', 'One Word Substitution', 'Idioms & Phrases', 'Active & Passive Voice', 'Direct & Indirect Speech', 'Sentence Improvement', 'Para Jumbles'],
  'General Knowledge': ['Indian History', 'Indian Polity', 'Indian Geography', 'World Geography', 'Indian Economy', 'General Science (Physics)', 'General Science (Chemistry)', 'General Science (Biology)', 'Current Affairs', 'Awards & Honours', 'Sports', 'Computer & Technology'],
};

const SUBJECT_COLORS = {
  'Quantitative Aptitude': 'from-blue-500 to-blue-600',
  Reasoning: 'from-purple-500 to-purple-600',
  English: 'from-green-500 to-green-600',
  'General Knowledge': 'from-orange-500 to-orange-600',
};

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudySession() {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | active | paused
  const [elapsed, setElapsed] = useState(0);
  const [todaySessions, setTodaySessions] = useState([]);
  const [totalToday, setTotalToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    loadToday();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadToday();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (status === 'active') {
      startTimeRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadToday = async () => {
    try {
      const res = await sessionsAPI.getToday();
      setTodaySessions(res.data.sessions);
      setTotalToday(res.data.totalMinutes);
    } catch {/* ignore */}
  };

  const handleStart = async () => {
    const finalTopic = customTopic.trim() || topic;
    if (!subject) return toast.error('Please select a subject');
    if (!finalTopic) return toast.error('Please select or enter a topic');
    setLoading(true);
    try {
      const res = await sessionsAPI.start({ subject, topic: finalTopic, notes });
      setSessionId(res.data.session.id);
      setStatus('active');
      setElapsed(0);
      toast.success(`Started: ${finalTopic}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;
    setStatus('paused'); // update UI immediately
    toast('Session paused', { icon: '⏸️' });
    try {
      await sessionsAPI.pause(sessionId);
    } catch (err) {
      console.error('Pause sync failed:', err?.response?.data || err.message);
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    setStatus('active'); // update UI immediately
    toast('Session resumed!', { icon: '▶️' });
    try {
      await sessionsAPI.resume(sessionId);
    } catch (err) {
      console.error('Resume sync failed:', err?.response?.data || err.message);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    setLoading(true);
    const elapsedAtStop = elapsed;
    // Reset UI immediately so user isn't stuck
    setStatus('idle');
    setSessionId(null);
    setElapsed(0);
    setSubject('');
    setTopic('');
    setCustomTopic('');
    setNotes('');
    try {
      const res = await sessionsAPI.stop(sessionId, { elapsedSeconds: elapsedAtStop });
      const duration = res.data.session.durationMinutes;
      toast.success(`Session saved! ${duration} minutes logged 🎉`);
      await loadToday();
    } catch (err) {
      console.error('Stop failed:', err?.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to save session');
    } finally {
      setLoading(false);
    }
  };

  const activeTopic = customTopic.trim() || topic;
  const isIdle = status === 'idle';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Study Timer</h2>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
          Track focused study sessions
        </p>
      </div>

      {/* Timer Card */}
      <div className="card text-center">
        {/* Big timer display */}
        <div className={`text-7xl font-mono font-bold mb-6 transition-colors ${
          status === 'active' ? 'text-zinc-800 dark:text-zinc-500' :
          status === 'paused' ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-700'
        }`}>
          {formatTime(elapsed)}
        </div>

        {/* Active session info */}
        {!isIdle && (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 bg-gradient-to-r ${SUBJECT_COLORS[subject] || 'from-gray-400 to-gray-500'} text-white text-sm font-medium`}>
            <span className={`w-2 h-2 rounded-full bg-white ${status === 'active' ? 'animate-pulse' : 'opacity-50'}`} />
            {activeTopic} — {subject}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {isIdle ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn-primary px-8 flex items-center gap-2 text-lg"
            >
              <span>▶</span> Start Session
            </button>
          ) : (
            <>
              {status === 'active' ? (
                <button onClick={handlePause} className="btn-secondary flex items-center gap-2">
                  <span>⏸</span> Pause
                </button>
              ) : (
                <button onClick={handleResume} className="btn-secondary flex items-center gap-2">
                  <span>▶</span> Resume
                </button>
              )}
              <button
                onClick={handleStop}
                disabled={loading}
                className="btn-danger flex items-center gap-2"
              >
                <span>⏹</span> Stop & Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Session Setup — only when idle */}
      {isIdle && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Configure Session</h3>

          {/* Subject grid */}
          <div>
            <label className="label">Subject</label>
            <div className="grid grid-cols-2 gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSubject(s); setTopic(''); }}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    subject === s
                      ? 'border-zinc-500 bg-zinc-50 dark:bg-primary-900/20 text-primary-700 dark:text-zinc-400'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Topic dropdown */}
          {subject && (
            <div>
              <label className="label">Topic</label>
              <select
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setCustomTopic(''); }}
                className="select"
              >
                <option value="">Select topic...</option>
                {SUBJECT_TOPICS[subject]?.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom topic */}
          {subject && (
            <div>
              <label className="label">Or enter custom topic</label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => { setCustomTopic(e.target.value); if (e.target.value) setTopic(''); }}
                className="input"
                placeholder="e.g., Chapter 5 — Permutations"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="What will you study today?"
            />
          </div>
        </div>
      )}

      {/* Today's sessions summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Today's Sessions</h3>
          <span className="badge badge-blue">
            {Math.floor(totalToday / 60)}h {totalToday % 60}m total
          </span>
        </div>

        {todaySessions.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <p className="text-3xl mb-2">📖</p>
            <p>No sessions today yet. Start studying!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.filter((s) => s.status === 'completed').map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.topic}</p>
                  <p className="text-xs text-gray-400">{s.subject}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{s.durationMinutes} min</p>
                  <p className="text-xs text-gray-400">
                    {new Date(s.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}