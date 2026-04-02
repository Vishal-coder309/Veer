import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/study', icon: '⏱️', label: 'Study Timer' },
  { to: '/topics', icon: '📚', label: 'Topics' },
  { to: '/log', icon: '📖', label: "Today's Learning" },
  { to: '/tests', icon: '📝', label: 'Mock Tests' },
  { to: '/reports', icon: '📊', label: 'Reports' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];


export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="flex items-center px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
        <img src="/veer-logo.svg" alt="VEER" className="h-14 w-auto dark:hidden" />
        <img src="/veer-logo-dark.svg" alt="VEER" className="h-14 w-auto hidden dark:block" />
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`
            }
          >
            <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Streak widget */}
      {user?.streak?.current > 0 && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {user.streak.current} day streak!
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Best: {user.streak.longest} days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150"
        >
          <span className="text-base w-5 text-center">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
