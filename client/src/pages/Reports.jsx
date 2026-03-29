import React, { useEffect, useState } from 'react';
import { sessionsAPI, testsAPI } from '../utils/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement
);

const SUBJECT_COLORS_CHART = {
  'Quantitative Aptitude': '#3b82f6',
  Reasoning: '#8b5cf6',
  English: '#10b981',
  'General Knowledge': '#f97316',
};

const SHORT = {
  'Quantitative Aptitude': 'Quant',
  Reasoning: 'Reasoning',
  English: 'English',
  'General Knowledge': 'GK',
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

export default function Reports() {
  const [weekStats, setWeekStats] = useState([]);
  const [monthStats, setMonthStats] = useState(null);
  const [testAnalytics, setTestAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [weekRes, monthRes, testRes] = await Promise.all([
        sessionsAPI.getWeeklyStats(),
        sessionsAPI.getMonthlyStats(year, month),
        testsAPI.getAnalytics(),
      ]);
      setWeekStats(weekRes.data.stats);
      setMonthStats(monthRes.data);
      setTestAnalytics(testRes.data.analytics);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // Weekly bar chart
  const weekBarData = {
    labels: weekStats.map((s) => new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })),
    datasets: [{
      label: 'Minutes',
      data: weekStats.map((s) => s.totalMinutes),
      backgroundColor: '#3b82f6',
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  // Monthly calendar heatmap data (daily minutes)
  const monthDays = Object.entries(monthStats?.byDate || {})
    .sort(([a], [b]) => a.localeCompare(b));

  const monthBarData = {
    labels: monthDays.map(([d]) => new Date(d + 'T00:00:00').getDate()),
    datasets: [{
      label: 'Minutes',
      data: monthDays.map(([, v]) => v),
      backgroundColor: '#8b5cf6',
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  // Subject doughnut (monthly)
  const subjKeys = Object.keys(monthStats?.bySubject || {});
  const subjDoughnut = {
    labels: subjKeys.map((s) => SHORT[s] || s),
    datasets: [{
      data: subjKeys.map((s) => monthStats.bySubject[s]),
      backgroundColor: subjKeys.map((s) => SUBJECT_COLORS_CHART[s] || '#6b7280'),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  // Test score trend line chart
  const trendData = testAnalytics?.trend || [];
  const lineData = {
    labels: trendData.map((t) => new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
    datasets: [{
      label: 'Score %',
      data: trendData.map((t) => t.percentage),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#3b82f6',
    }],
  };

  const totalMonthMinutes = monthStats?.totalMinutes || 0;
  const totalWeekMinutes = weekStats.reduce((s, w) => s + w.totalMinutes, 0);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Your study performance over time</p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="select w-28"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="select w-24"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'This Week', value: `${Math.floor(totalWeekMinutes / 60)}h ${totalWeekMinutes % 60}m`, icon: '📅' },
              { label: `${MONTHS[month - 1]} ${year}`, value: `${Math.floor(totalMonthMinutes / 60)}h ${totalMonthMinutes % 60}m`, icon: '📆' },
              { label: 'Tests Taken', value: testAnalytics?.totalTests || 0, icon: '📝' },
              { label: 'Avg Accuracy', value: `${testAnalytics?.avgAccuracy || 0}%`, icon: '🎯' },
            ].map((s) => (
              <div key={s.label} className="card text-center p-4">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Weekly chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Last 7 Days — Study Time (min)</h3>
            <div className="h-52">
              {weekStats.some((s) => s.totalMinutes > 0) ? (
                <Bar data={weekBarData} options={{
                  ...chartDefaults,
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                    y: { grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                  },
                }} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data for this week</div>
              )}
            </div>
          </div>

          {/* Monthly bar + subject doughnut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                {MONTHS[month - 1]} {year} — Daily Study (min)
              </h3>
              <div className="h-52">
                {monthDays.length > 0 ? (
                  <Bar data={monthBarData} options={{
                    ...chartDefaults,
                    scales: {
                      x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
                      y: { grid: { color: 'rgba(156,163,175,0.1)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                    },
                  }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">No sessions this month</div>
                )}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subject Distribution</h3>
              {subjKeys.length > 0 ? (
                <>
                  <div className="h-36 mx-auto w-36">
                    <Doughnut data={subjDoughnut} options={{
                      ...chartDefaults,
                      plugins: { legend: { display: false } },
                      cutout: '70%',
                    }} />
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {subjKeys.map((s) => {
                      const mins = monthStats.bySubject[s];
                      const pct = Math.round((mins / totalMonthMinutes) * 100);
                      return (
                        <div key={s} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: SUBJECT_COLORS_CHART[s] }} />
                            <span className="text-gray-600 dark:text-zinc-400">{SHORT[s]}</span>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-36 flex items-center justify-center text-gray-400 text-sm text-center">
                  No sessions<br />this month
                </div>
              )}
            </div>
          </div>

          {/* Test score trend */}
          {trendData.length > 1 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Test Score Trend (%)</h3>
              <div className="h-52">
                <Line data={lineData} options={{
                  ...chartDefaults,
                  scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                    y: {
                      min: 0, max: 100,
                      grid: { color: 'rgba(156,163,175,0.1)' },
                      ticks: { color: '#9ca3af', font: { size: 11 }, callback: (v) => v + '%' },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => ` ${c.raw}%` } },
                  },
                }} />
              </div>
            </div>
          )}

          {/* Subject accuracy (from tests) */}
          {testAnalytics && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subject-wise Accuracy (All Tests)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(testAnalytics.subjectAccuracy).map(([subj, acc]) => (
                  <div key={subj} className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800 text-center">
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-16 h-16 -rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
                        <circle
                          cx="32" cy="32" r="26" fill="none"
                          stroke={acc >= 70 ? '#10b981' : acc >= 50 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="6"
                          strokeDasharray={`${(acc / 100) * 163.4} 163.4`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-white">
                        {acc}%
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">{SHORT[subj]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
