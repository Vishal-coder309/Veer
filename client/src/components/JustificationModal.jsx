import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'health', label: '🤒 Health Issue' },
  { value: 'family', label: '👨‍👩‍👧 Family Emergency' },
  { value: 'work', label: '💼 Work / Exam' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'technical', label: '💻 Technical Problem' },
  { value: 'other', label: '📝 Other' },
];

export default function JustificationModal({ data, onClose }) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('other');
  const [submitting, setSubmitting] = useState(false);

  const { daysStudied, weekStart, threshold = 3 } = data;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 20) {
      return toast.error('Please write at least 20 characters');
    }
    setSubmitting(true);
    try {
      await api.post('/justification', { reason: reason.trim(), category });
      toast.success('Justification submitted ✅');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const missingDays = threshold - daysStudied;

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Study Target Missed</h2>
              <p className="text-red-100 text-sm">Justification required</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Stats */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 p-3 rounded-xl bg-red-50 dark:bg-zinc-800/40 text-center border border-zinc-100 dark:border-zinc-800/30">
              <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-500">{daysStudied}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-500 font-medium">Days studied</p>
            </div>
            <div className="text-gray-300 dark:text-gray-600 text-xl font-light">/</div>
            <div className="flex-1 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 text-center">
              <p className="text-2xl font-bold text-gray-700 dark:text-zinc-200">{threshold}</p>
              <p className="text-xs text-gray-500 font-medium">Weekly target</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 text-center border border-orange-100 dark:border-orange-800/30">
              <p className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">{missingDays}</p>
              <p className="text-xs text-zinc-500 font-medium">Day{missingDays !== 1 ? 's' : ''} short</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-5 leading-relaxed">
            You've studied on only <strong>{daysStudied} day{daysStudied !== 1 ? 's' : ''}</strong> this week
            (week of <strong>{new Date(weekStart + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>).
            The minimum target is <strong>{threshold} days/week</strong>. Please explain your reason below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="label">Reason Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`p-2 rounded-xl border-2 text-xs font-medium text-center transition-all leading-tight ${
                      category === c.value
                        ? 'border-zinc-500 bg-zinc-50 dark:bg-primary-900/20 text-primary-700 dark:text-zinc-400'
                        : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed reason */}
            <div>
              <label className="label">
                Explain in detail
                <span className={`ml-2 font-normal text-xs ${reason.trim().length >= 20 ? 'text-green-500' : 'text-gray-400'}`}>
                  ({reason.trim().length}/20 min)
                </span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input resize-none"
                rows={4}
                placeholder="Describe why you were unable to study for the required days this week..."
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Remind Later
              </button>
              <button
                type="submit"
                disabled={submitting || reason.trim().length < 20}
                className="btn-primary flex-1"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
