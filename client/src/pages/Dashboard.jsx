import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../utils/api';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import JustificationModal from '../components/JustificationModal';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const SUBJECT_COLORS = {
  Maths:                   { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', chart: '#3b82f6' },
  Reasoning:               { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', chart: '#8b5cf6' },
  English:                 { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', chart: '#10b981' },
  'General Knowledge':     { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', chart: '#f59e0b' },
};

const SHORT_SUBJECT = {
  Maths: 'Maths',
  Reasoning: 'Reasoning',
  English: 'English',
  'General Knowledge': 'GK',
};

function StatCard({ icon, label, value, sub, color = 'blue' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justificationData, setJustificationData] = useState(null); // non-null = show modal

  const fetchDashboard = () => {
    dashboardAPI.get()
      .then((res) => setData(res.data.dashboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();

    // Refetch whenever the user comes back to this tab (e.g. after studying)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboard();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Check if justification is required (only on Sunday/Monday)
    const day = new Date().getUTCDay(); // Sunday=0, Monday=1
    if (day === 0 || day === 1) {
      api.get('/justification/check')
        .then((res) => { if (res.data.required) setJustificationData(res.data); })
        .catch(() => {/* non-critical */});
    }

    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const goalPct = data ? Math.min(Math.round((data.todayMinutes / data.dailyGoalMinutes) * 100), 100) : 0;
  const progressBarClass =
    goalPct >= 100
      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
      : goalPct >= 70
        ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
        : goalPct >= 40
          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
          : 'bg-gradient-to-r from-rose-400 to-red-500';

  // Weekly bar chart data
  const weekLabels = data?.weekStats?.map((s) => {
    const d = new Date(s.date);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  }) || [];

  const orderedSubjects = Object.keys(SUBJECT_COLORS);
  const weekData = {
    labels: weekLabels,
    datasets: orderedSubjects.map((subject) => ({
      label: SHORT_SUBJECT[subject] || subject,
      data: data?.weekStats?.map((s) => s.subjectBreakdown?.[subject] || 0) || [],
      backgroundColor: SUBJECT_COLORS[subject].chart,
      borderRadius: 6,
      borderSkipped: false,
      stack: 'weekly',
    })),
  };

  // Subject doughnut
  const subjectKeys = Object.keys(data?.subjectBreakdown || {});
  const doughnutData = {
    labels: subjectKeys.map((s) => SHORT_SUBJECT[s] || s),
    datasets: [{
      data: subjectKeys.map((s) => data.subjectBreakdown[s]),
      backgroundColor: subjectKeys.map((s) => SUBJECT_COLORS[s]?.chart || '#6b7280'),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { boxWidth: 10, color: '#9ca3af', font: { size: 11 } } } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
      y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#9ca3af', font: { size: 11 } } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Justification modal — shown when weekly target is missed */}
      {justificationData && (
        <JustificationModal
          data={justificationData}
          onClose={() => setJustificationData(null)}
        />
      )}

      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Good {getGreeting()}, {user?.username || user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
          {data?.streak?.current > 0
            ? `🔥 ${data.streak.current} day streak — keep it up!`
            : 'Start studying to build your streak!'}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="⏰"
          label="Today"
          value={`${Math.floor((data?.todayMinutes || 0) / 60)}h ${(data?.todayMinutes || 0) % 60}m`}
          sub={`Goal: ${data?.dailyGoalMinutes || 240} min`}
          color="blue"
        />
        <StatCard
          icon="🔥"
          label="Streak"
          value={`${data?.streak?.current || 0} days`}
          sub={`Best: ${data?.streak?.longest || 0} days`}
          color="orange"
        />
        <StatCard
          icon="📚"
          label="Topics Done"
          value={`${data?.topicsProgress?.completed || 0}/${data?.topicsProgress?.total || 0}`}
          sub={`${data?.topicsProgress?.percentage || 0}% complete`}
          color="green"
        />
        <StatCard
          icon="🕐"
          label="Total Hours"
          value={`${Math.round((data?.totalMinutesAllTime || 0) / 60)}h`}
          sub="All time"
          color="purple"
        />
      </div>

      {/* Daily goal progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Today's Goal Progress</h3>
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-500">{goalPct}%</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressBarClass} rounded-full transition-all duration-700`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{data?.todayMinutes || 0} min studied</span>
          <span className="text-xs text-gray-400">{data?.dailyGoalMinutes || 240} min goal</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly bar chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Weekly Study (minutes)</h3>
          <div className="h-48">
            {weekData.datasets[0].data.some(Boolean) ? (
              <Bar data={weekData} options={chartOpts} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No study sessions this week yet
              </div>
            )}
          </div>
        </div>

        {/* Subject breakdown doughnut */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Today's Subjects</h3>
          {subjectKeys.length > 0 ? (
            <>
              <div className="h-32 mx-auto w-32">
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }} />
              </div>
              <div className="mt-3 space-y-1.5">
                {subjectKeys.map((s) => (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${SUBJECT_COLORS[s]?.bg}`} />
                      <span className="text-gray-600 dark:text-zinc-400">{SHORT_SUBJECT[s]}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{data.subjectBreakdown[s]}m</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm text-center">
              No sessions today.<br />Start studying!
            </div>
          )}
        </div>
      </div>

      {/* Quick actions & recent tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick actions */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/study', icon: '▶️', label: 'Start Studying', color: 'from-zinc-800 to-zinc-700' },
              { to: '/topics', icon: '📚', label: 'View Topics', color: 'from-zinc-800 to-zinc-700' },
              { to: '/tests', icon: '📝', label: 'Add Test Score', color: 'from-zinc-800 to-zinc-700' },
              { to: '/reports', icon: '📊', label: 'View Reports', color: 'from-zinc-800 to-zinc-700' },
            ].map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${action.color} text-white hover:opacity-90 transition-opacity`}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent tests */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Tests</h3>
            <Link to="/tests" className="text-xs text-zinc-800 dark:text-zinc-500 hover:underline">View all</Link>
          </div>
          {data?.recentTests?.length > 0 ? (
            <div className="space-y-3">
              {data.recentTests.map((test, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">{test.testName}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(test.date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {test.score}/{test.totalMarks}
                    </p>
                    <p className={`text-xs font-semibold ${test.accuracy >= 70 ? 'text-zinc-600' : test.accuracy >= 50 ? 'text-zinc-500' : 'text-zinc-600'}`}>
                      {test.accuracy}% accuracy
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p className="text-2xl mb-2">📝</p>
              <p>No test scores yet</p>
              <Link to="/tests" className="text-zinc-800 dark:text-zinc-500 text-xs hover:underline mt-1 block">
                Add your first test →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}