'use client';

import { useState } from 'react';
import { SESSION_KEY, ORG_NAME, ORG_SHORT } from '@/lib/constants';
import type { UserSession } from '@/lib/types';
import { UserCircle, KeyRound, Loader2, AlertCircle } from 'lucide-react';

interface SetupFormProps {
  onComplete: (session: UserSession) => void;
}

export default function SetupForm({ onComplete }: SetupFormProps) {
  const [teacherId, setTeacherId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!teacherId.trim()) {
      setError('กรุณากรอกรหัสครู');
      return;
    }
    if (!pinCode.trim() || pinCode.length < 4) {
      setError('กรุณากรอก PIN อย่างน้อย 4 หลัก');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId.trim(), pin_code: pinCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'รหัสครูหรือ PIN ไม่ถูกต้อง');
        setLoading(false);
        return;
      }

      const session: UserSession = {
        teacherUuid: data.teacher.uuid,
        teacherId: data.teacher.teacherId,
        fullName: data.teacher.fullName,
        enrollmentStatus: data.teacher.enrollmentStatus,
        locationId: data.teacher.locationId,
        isAdmin: data.teacher.isAdmin || false,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onComplete(session);
    } catch {
      setError('ไม่สามารถเชื่อมต่อระบบได้');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{ORG_SHORT}</h1>
          <p className="text-blue-400 text-sm">{ORG_NAME}</p>
          <p className="text-slate-400 text-xs mt-2">เชื่อมบัญชีครั้งแรกเพื่อใช้งาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs block mb-1 ml-1">รหัสครู / รหัสบุคลากร</label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value.toUpperCase())}
                placeholder="เช่น T001"
                className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition text-sm"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs block mb-1 ml-1">PIN</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN 4-6 หลัก"
                className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition text-sm tracking-widest"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'กำลังตรวจสอบ...' : 'เชื่อมบัญชี'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          ใช้รหัสครูและ PIN เดียวกับที่ผู้ดูแลระบบกำหนดให้<br />
          เชื่อมบัญชีครั้งเดียว ใช้งานได้ทุกวัน
        </p>
      </div>
    </div>
  );
}
