import React, { useEffect, useState } from 'react';
import { testsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const SUBJECTS = ['Maths', 'Reasoning', 'English', 'General Knowledge'];

const emptySubjectScore = (subject) => ({
  subject, attempted: '', correct: '', wrong: '', marks: '', totalMarks: '',
});

function AccuracyBadge({ accuracy }) {
  const cls = accuracy >= 70 ? 'badge-green' : accuracy >= 50 ? 'badge-yellow' : 'badge-red';
  return <span className={`badge ${cls}`}>{accuracy}% accuracy</span>;
}

export default function Tests() {
  const [tests, setTests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState('list'); // list | analytics

  const emptyForm = {
    testName: '', testType: 'mock', date: new Date().toISOString().split('T')[0],
    totalQuestions: '', attempted: '', correct: '', wrong: '',
    score: '', totalMarks: '', timeTakenMinutes: '', notes: '',
    subjectScores: SUBJECTS.map(emptySubjectScore),
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [testsRes, analyticsRes] = await Promise.all([
        testsAPI.getAll(),
        testsAPI.getAnalytics(),
      ]);
      setTests(testsRes.data.tests);
      setAnalytics(analyticsRes.data.analytics);
    } catch {
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubjectChange = (idx, field, value) => {
    setForm((p) => {
      const ss = [...p.subjectScores];
      ss[idx] = { ...ss[idx], [field]: value };
      // Auto-calculate wrong
      if (field === 'attempted' || field === 'correct') {
        const a = Number(field === 'attempted' ? value : ss[idx].attempted);
        const c = Number(field === 'correct' ? value : ss[idx].correct);
        if (!isNaN(a) && !isNaN(c)) ss[idx].wrong = Math.max(0, a - c);
      }
      return { ...p, subjectScores: ss };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.testName || !form.totalQuestions || !form.attempted || form.correct === '') {
      return toast.error('Fill in required fields');
    }
    setSubmitting(true);
    try {
      const subjectScores = form.subjectScores.filter((s) => s.attempted !== '');
      await testsAPI.add({
        ...form,
        totalQuestions: Number(form.totalQuestions),
        attempted: Number(form.attempted),
        correct: Number(form.correct),
        wrong: Number(form.wrong || Number(form.attempted) - Number(form.correct)),
        score: Number(form.score || form.correct),
        totalMarks: Number(form.totalMarks || form.totalQuestions),
        timeTakenMinutes: Number(form.timeTakenMinutes || 0),
        subjectScores: subjectScores.map((s) => ({
          ...s,
          attempted: Number(s.attempted),
          correct: Number(s.correct),
          wrong: Number(s.wrong || Number(s.attempted) - Number(s.correct)),
          marks: Number(s.marks || s.correct),
          totalMarks: Number(s.totalMarks || 0),
        })),
      });
      toast.success('Test score saved!');
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test?')) return;
    try {
      await testsAPI.delete(id);
      setTests((p) => p.filter((t) => t._id !== id));
      toast.success('Test deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mock Test Tracker</h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Record and analyze your performance</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          {showForm ? '✕ Cancel' : '+ Add Test Score'}
        </button>
      </div>

      {/* Add test form */}
      {showForm && (
        <div className="card animate-fade-in">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-5">New Test Result</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Test Name *</label>
                <input name="testName" value={form.testName} onChange={handleChange} className="input" placeholder="SSC CGL Mock 1" required />
              </div>
              <div>
                <label className="label">Test Type</label>
                <select name="testType" value={form.testType} onChange={handleChange} className="select">
                  <option value="mock">Full Mock</option>
                  <option value="sectional">Sectional</option>
                  <option value="previous_year">Previous Year</option>
                  <option value="practice">Practice Set</option>
                </select>
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} className="input" required />
              </div>
              <div>
                <label className="label">Time Taken (minutes)</label>
                <input type="number" name="timeTakenMinutes" value={form.timeTakenMinutes} onChange={handleChange} className="input" placeholder="60" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="label">Total Qs *</label>
                <input type="number" name="totalQuestions" value={form.totalQuestions} onChange={handleChange} className="input" placeholder="100" required min="1" />
              </div>
              <div>
                <label className="label">Attempted *</label>
                <input type="number" name="attempted" value={form.attempted} onChange={handleChange} className="input" placeholder="85" required min="0" />
              </div>
              <div>
                <label className="label">Correct *</label>
                <input type="number" name="correct" value={form.correct} onChange={handleChange} className="input" placeholder="60" required min="0" />
              </div>
              <div>
                <label className="label">Score</label>
                <input type="number" name="score" value={form.score} onChange={handleChange} className="input" placeholder="180" min="0" step="0.5" />
              </div>
            </div>

            {/* Subject-wise scores */}
            <div>
              <p className="label mb-2">Subject-wise Breakdown (optional)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left pb-2 font-medium">Subject</th>
                      <th className="text-center pb-2 font-medium">Attempted</th>
                      <th className="text-center pb-2 font-medium">Correct</th>
                      <th className="text-center pb-2 font-medium">Marks</th>
                      <th className="text-center pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {form.subjectScores.map((ss, idx) => (
                      <tr key={ss.subject} className="border-t border-gray-100 dark:border-zinc-800">
                        <td className="py-2 pr-3 text-xs font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                          {ss.subject.split(' ')[0]}
                        </td>
                        {['attempted', 'correct', 'marks', 'totalMarks'].map((field) => (
                          <td key={field} className="py-1 px-1">
                            <input
                              type="number"
                              value={ss[field]}
                              onChange={(e) => handleSubjectChange(idx, field, e.target.value)}
                              className="w-16 px-2 py-1 text-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
                              min="0"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} className="input resize-none" rows={2} placeholder="Observations, areas to improve..." />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Saving...' : 'Save Test Result'}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {['list', 'analytics'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${
              tab === t ? 'bg-zinc-800 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
            }`}
          >
            {t === 'list' ? '📋 Tests' : '📊 Analytics'}
          </button>
        ))}
      </div>

      {/* Tests list */}
      {tab === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tests.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-gray-500 dark:text-zinc-400">No test results yet</p>
            </div>
          ) : (
            tests.map((test) => (
              <div key={test._id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{test.testName}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {new Date(test.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="badge badge-blue capitalize">{test.testType.replace('_', ' ')}</span>
                      <AccuracyBadge accuracy={test.accuracy} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {test.score}<span className="text-sm text-gray-400">/{test.totalMarks}</span>
                    </p>
                    <p className="text-sm text-gray-500">{test.correct}/{test.attempted} correct</p>
                  </div>
                </div>

                {test.subjectScores?.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {test.subjectScores.map((ss) => (
                      <div key={ss.subject} className="p-2 rounded-lg bg-gray-50 dark:bg-zinc-800 text-center">
                        <p className="text-xs text-gray-400 truncate">{ss.subject.split(' ')[0]}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {ss.attempted > 0 ? Math.round((ss.correct / ss.attempted) * 100) : 0}%
                        </p>
                        <p className="text-xs text-gray-400">{ss.correct}/{ss.attempted}</p>
                      </div>
                    ))}
                  </div>
                )}

                {test.notes && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400 italic">{test.notes}</p>
                )}

                <button
                  onClick={() => handleDelete(test._id)}
                  className="mt-3 text-xs text-zinc-500 hover:text-zinc-600"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics tab */}
      {tab === 'analytics' && (
        <div className="space-y-4">
          {!analytics ? (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-500 dark:text-zinc-400">Add test results to see analytics</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Tests', value: analytics.totalTests, icon: '📝' },
                  { label: 'Avg Accuracy', value: `${analytics.avgAccuracy}%`, icon: '🎯' },
                  { label: 'Best Score', value: `${analytics.bestScore}%`, icon: '🏆' },
                  { label: 'Weak Subjects', value: analytics.weakSubjects?.length || 0, icon: '⚠️' },
                ].map((s) => (
                  <div key={s.label} className="card text-center p-4">
                    <p className="text-2xl mb-1">{s.icon}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Subject accuracy */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subject-wise Accuracy</h3>
                <div className="space-y-3">
                  {SUBJECTS.map((subj) => {
                    const acc = analytics.subjectAccuracy[subj] || 0;
                    return (
                      <div key={subj}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{subj}</span>
                          <span className={`text-sm font-bold ${acc >= 70 ? 'text-green-500' : acc >= 50 ? 'text-yellow-500' : 'text-zinc-600'}`}>
                            {acc}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${acc >= 70 ? 'bg-zinc-600' : acc >= 50 ? 'bg-zinc-500' : 'bg-zinc-700'}`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weak subjects */}
              {analytics.weakSubjects?.length > 0 && (
                <div className="card border-l-4 border-zinc-400">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">⚠️ Focus Areas</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
                    Subjects with accuracy below 60% — need more practice:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analytics.weakSubjects.map((s) => (
                      <span key={s} className="badge badge-red">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Score trend */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Score Trend</h3>
                <div className="space-y-2">
                  {analytics.trend.slice(-5).reverse().map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-zinc-800">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t.testName}</p>
                        <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t.percentage}%</p>
                        <p className="text-xs text-gray-400">{t.score}/{t.totalMarks}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
