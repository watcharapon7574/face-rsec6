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
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';

    // Version-based auto update: if version changed, clear caches and reload
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion && storedVersion !== appVersion) {
      localStorage.setItem('app_version', appVersion);
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
          window.location.reload();
        });
        return;
      }
    }
    localStorage.setItem('app_version', appVersion);

    // Register SW + listen for updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${appVersion}`).then(reg => {
        reg.update().catch(() => {});
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      }).catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // When app resumes from background (iOS PWA), check server for new version
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/version', { cache: 'no-store' })
        .then(r => r.json() as Promise<{ version: string }>)
        .then(data => {
          if (data.version && data.version !== appVersion) {
            localStorage.setItem('app_version', data.version);
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
              window.location.reload();
            });
          }
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
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
