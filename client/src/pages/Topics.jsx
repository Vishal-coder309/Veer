import React, { useEffect, useState } from 'react';
import { topicsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const SUBJECTS = ['Maths', 'Reasoning', 'English', 'General Knowledge'];

const SUBJECT_META = {
  Maths: { icon: '🔢', color: 'blue' },
  Reasoning: { icon: '🧠', color: 'purple' },
  English: { icon: '📖', color: 'green' },
  'General Knowledge': { icon: '🌍', color: 'orange' },
};

const STATUS_STYLES = {
  not_started: 'badge-red',
  in_progress: 'badge-yellow',
  completed: 'badge-green',
};

const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_ICONS = {
  not_started: '○',
  in_progress: '◑',
  completed: '●',
};

export default function Topics() {
  const [topics, setTopics] = useState({});
  const [summary, setSummary] = useState({});
  const [activeSubject, setActiveSubject] = useState('Maths');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | not_started | in_progress | completed
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [topicsRes, summaryRes] = await Promise.all([
        topicsAPI.getAll(),
        topicsAPI.getSummary(),
      ]);
      setTopics(topicsRes.data.topics);
      setSummary(summaryRes.data.summary);
    } catch (err) {
      toast.error('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (subject, topicName, newStatus) => {
    setSaving(`${subject}::${topicName}`);
    try {
      await topicsAPI.update({ subject, topicName, status: newStatus });
      setTopics((prev) => {
        const updated = { ...prev };
        updated[subject] = updated[subject].map((t) =>
          t.topicName === topicName ? { ...t, status: newStatus } : t
        );
        return updated;
      });

      // Update summary
      setSummary((prev) => {
        const subj = { ...prev[subject] };
        const oldTopic = topics[subject]?.find((t) => t.topicName === topicName);
        const oldStatus = oldTopic?.status || 'not_started';

        if (oldStatus !== 'not_started') subj[oldStatus === 'completed' ? 'completed' : 'inProgress']--;
        if (newStatus === 'completed') subj.completed++;
        else if (newStatus === 'in_progress') subj.inProgress++;
        else subj.notStarted++;

        subj.percentage = Math.round((subj.completed / subj.total) * 100);
        return { ...prev, [subject]: subj };
      });

      toast.success(newStatus === 'completed' ? '✅ Marked complete!' : 'Updated', { duration: 1500 });
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const filtered = (topics[activeSubject] || []).filter((t) => {
    const matchFilter = filter === 'all' || t.status === filter;
    const matchSearch = !search || t.topicName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Topic Tracker</h2>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Track your SSC CGL syllabus coverage</p>
      </div>

      {/* Subject tabs with progress */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SUBJECTS.map((subj) => {
          const meta = SUBJECT_META[subj];
          const s = summary[subj];
          const isActive = activeSubject === subj;
          return (
            <button
              key={subj}
              onClick={() => setActiveSubject(subj)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                isActive
                  ? `border-${meta.color}-500 bg-${meta.color}-50 dark:bg-${meta.color}-900/20`
                  : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{meta.icon}</span>
                <span className={`text-xs font-bold ${isActive ? `text-${meta.color}-700 dark:text-${meta.color}-300` : 'text-gray-500 dark:text-zinc-400'}`}>
                  {subj.split(' ')[0]}
                </span>
              </div>
              {s && (
                <>
                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full bg-${meta.color}-500 rounded-full transition-all`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {s.completed}/{s.total} done ({s.percentage}%)
                  </p>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters & search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topics..."
          className="input flex-1"
        />
        <div className="flex gap-2">
          {['all', 'not_started', 'in_progress', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-zinc-800 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Topics list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">{activeSubject}</h3>
          <span className="text-xs text-gray-400">{filtered.length} topics</span>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No topics match your filter</p>
          ) : (
            filtered.map((t) => (
              <div
                key={t.topicName}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${
                    t.status === 'completed' ? 'text-green-500' :
                    t.status === 'in_progress' ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'
                  }`}>
                    {STATUS_ICONS[t.status]}
                  </span>
                  <span className={`text-sm font-medium ${
                    t.status === 'completed'
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {t.topicName}
                  </span>
                </div>

                {/* Status cycle buttons */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {['not_started', 'in_progress', 'completed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(activeSubject, t.topicName, s)}
                      disabled={saving === `${activeSubject}::${t.topicName}`}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                        t.status === s
                          ? STATUS_STYLES[s] + ' opacity-100'
                          : 'bg-gray-100 dark:bg-zinc-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={STATUS_LABELS[s]}
                    >
                      {s === 'not_started' ? 'Not Started' : s === 'in_progress' ? 'In Progress' : '✓ Done'}
                    </button>
                  ))}
                </div>

                {/* Show badge on mobile (no hover) */}
                <span className={`sm:hidden text-xs ${STATUS_STYLES[t.status]} badge`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
