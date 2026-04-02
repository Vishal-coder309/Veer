import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI, sessionsAPI } from '../utils/api';

const AuthContext = createContext(null);
const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('veer_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef(null);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('veer_token');
    if (token) {
      authAPI.getMe()
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem('veer_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          localStorage.removeItem('veer_token');
          localStorage.removeItem('veer_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('veer_token');
    localStorage.removeItem('veer_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('veer_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Auto logout after 3h inactivity, but only if no study timer session is running.
  useEffect(() => {
    if (loading || !user) return undefined;

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const handleIdleTimeout = async () => {
      try {
        const res = await sessionsAPI.getToday();
        const sessions = res.data?.sessions || [];
        const hasRunningTimer = sessions.some((s) => s.status === 'active' || s.status === 'paused');

        if (hasRunningTimer) {
          idleTimerRef.current = setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
          return;
        }
      } catch {
        // If timer status cannot be checked, proceed with timeout logout for safety.
      }

      logout();
    };

    const resetIdleTimer = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      clearIdleTimer();
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [loading, user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
