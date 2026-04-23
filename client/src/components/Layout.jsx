import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import api from '../utils/api';
import JustificationModal from './JustificationModal';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [justificationData, setJustificationData] = useState(null);

  useEffect(() => {
    const checkJustificationGate = async () => {
      try {
        const res = await api.get('/justification/check');
        if (res.data?.required) {
          setJustificationData(res.data);
          return;
        }
      } catch {
        // Non-critical here; protected endpoints will still be blocked by backend gate.
      }
      setJustificationData(null);
    };

    checkJustificationGate();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkJustificationGate();
      }
    };

    window.addEventListener('focus', checkJustificationGate);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', checkJustificationGate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex">
      {justificationData && (
        <JustificationModal
          data={justificationData}
          mandatory
          onClose={() => setJustificationData(null)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile via overlay */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
