'use client';

import { useState, useEffect } from 'react';
import SetupForm from '@/components/SetupForm';
import FaceEnrollment from '@/components/FaceEnrollment';
import AttendancePage from '@/components/AttendancePage';
import { SESSION_KEY } from '@/lib/constants';
import type { UserSession } from '@/lib/types';

export default function Home() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const handleEnrollmentComplete = () => {
    if (session) {
      const updated: UserSession = { ...session, enrollmentStatus: 'enrolled' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      setSession(updated);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Step 1: No session → Link account
  if (!session) {
    return <SetupForm onComplete={(s) => setSession(s)} />;
  }

  // Step 2: Not enrolled → Face enrollment
  if (session.enrollmentStatus !== 'enrolled') {
    return <FaceEnrollment session={session} onComplete={handleEnrollmentComplete} />;
  }

  // Step 3: Enrolled → Daily attendance (face verify + liveness)
  return <AttendancePage session={session} onLogout={handleLogout} />;
}
