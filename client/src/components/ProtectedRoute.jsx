import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium">Loading VEER...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}
