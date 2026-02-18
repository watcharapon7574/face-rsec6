'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CameraLiveness from './CameraLiveness';
import StatusCheck, { type CheckStatus } from './StatusCheck';
import { createClient } from '@/lib/supabase/client';
import { getCurrentPosition, isWithinRadius } from '@/lib/geolocation';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { getTimeStatus } from '@/lib/time-utils';
import { loadFaceApi, extractDescriptor, isMatch, blendDescriptors } from '@/lib/face-recognition';
import { ORG_SHORT } from '@/lib/constants';
import type { AttendanceSettings, Location, AttendanceAction, UserSession } from '@/lib/types';
import {
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Settings as SettingsIcon,
  Shield,
  RotateCcw,
  Loader2,
  MapPin,
  ScanFace,
  X,
  Save,
} from 'lucide-react';
import { SESSION_KEY } from '@/lib/constants';

interface AttendancePageProps {
  session: UserSession;
  onLogout: () => void;
}

type Phase = 'checking' | 'ready_to_verify' | 'face_verify' | 'scanning' | 'submitting' | 'success' | 'error';

export default function AttendancePage({ session, onLogout }: AttendancePageProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [action, setAction] = useState<AttendanceAction | null>(null);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>({
    location: 'idle', locationMsg: '',
    time: 'idle', timeMsg: '',
    device: 'idle', deviceMsg: '',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceFp, setDeviceFp] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [todayRecord, setTodayRecord] = useState<{
    check_in_time: string | null;
    check_out_time: string | null;
  } | null>(null);
  const [matchedLocation, setMatchedLocation] = useState<Location | null>(null);
  const [currentTime, setCurrentTime] = useState('');
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [storedDescriptor, setStoredDescriptor] = useState<number[] | null>(null);
  const [liveDescriptor, setLiveDescriptor] = useState<Float32Array | null>(null);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', position: '', pin_code: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date().toLocaleTimeString('th-TH', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const runChecks = useCallback(async () => {
    setPhase('checking');
    setResultMsg('');
    setAction(null);
    setMatchedLocation(null);
    setFaceMatchScore(null);
    setCheckStatus({
      location: 'checking', locationMsg: 'กำลังตรวจสอบตำแหน่ง...',
      time: 'checking', timeMsg: 'กำลังตรวจสอบเวลา...',
      device: 'checking', deviceMsg: 'กำลังตรวจสอบอุปกรณ์...',
    });

    const supabase = createClient();

    // 1. Fetch settings
    let s: AttendanceSettings | null = null;
    try {
      const { data } = await supabase.from('attendance_settings').select('*').single();
      if (data) { s = data as AttendanceSettings; setSettings(s); }
    } catch { /* */ }
    if (!s) {
      setCheckStatus(p => ({ ...p, time: 'failed', timeMsg: 'ไม่พบการตั้งค่าระบบ' }));
      return;
    }

    // 2. Get teacher face descriptor
    try {
      const { data: t } = await supabase
        .from('teachers')
        .select('face_descriptor')
        .eq('id', session.teacherUuid)
        .eq('enrollment_status', 'enrolled')
        .single();
      if (t?.face_descriptor) {
        setStoredDescriptor(t.face_descriptor);
      } else {
        setCheckStatus(p => ({ ...p, device: 'failed', deviceMsg: 'ยังไม่ได้ลงทะเบียนใบหน้า' }));
        return;
      }
    } catch {
      setCheckStatus(p => ({ ...p, device: 'failed', deviceMsg: 'ไม่พบข้อมูลครู' }));
      return;
    }

    // 3. Today's record
    const today = new Date().toISOString().split('T')[0];
    let todayRec: { check_in_time: string | null; check_out_time: string | null } | null = null;
    try {
      const { data: rec } = await supabase
        .from('attendance_records')
        .select('check_in_time, check_out_time')
        .eq('teacher_id', session.teacherUuid)
        .eq('date', today)
        .maybeSingle();
      todayRec = rec;
      setTodayRecord(rec);
    } catch { /* */ }

    // 4. Time check — also consider today's record
    const timeStatus = getTimeStatus(s);
    let resolvedAction: AttendanceAction | null = null;
    let timeOk = timeStatus.canCheckIn || timeStatus.canCheckOut;
    let timeMsg = timeStatus.message;

    if (timeStatus.canCheckIn) {
      resolvedAction = 'check_in';
    } else if (timeStatus.canCheckOut) {
      resolvedAction = 'check_out';
    }

    // If check-in window passed but teacher hasn't checked in yet,
    // still allow late check-in until check_out_start
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const [coH, coM] = (s.check_out_start || '15:30').split(':').map(Number);
    const coStartMin = coH * 60 + coM;

    if (!resolvedAction && !todayRec?.check_in_time && nowMin < coStartMin) {
      resolvedAction = 'check_in';
      timeOk = true;
      timeMsg = `เข้างานล่าช้า (ก่อน ${s.check_out_start})`;
    }

    setCheckStatus(p => ({
      ...p,
      time: timeOk ? 'passed' : 'failed',
      timeMsg,
    }));
    if (resolvedAction) setAction(resolvedAction);

    // 5. Location check
    let locationOk = false;
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      const { data: locations } = await supabase.from('locations').select('*').eq('is_active', true);

      if (locations && locations.length > 0) {
        const assignedLoc = session.locationId ? locations.find(l => l.id === session.locationId) : null;
        if (assignedLoc) {
          const res = isWithinRadius(pos, { lat: assignedLoc.lat, lng: assignedLoc.lng }, assignedLoc.radius_meters);
          if (res.within) {
            setMatchedLocation(assignedLoc as Location);
            setCheckStatus(p => ({ ...p, location: 'passed', locationMsg: `${assignedLoc.short_name} (${res.distance}m)` }));
            locationOk = true;
          }
        }
        if (!locationOk) {
          let nearest: { loc: Location; dist: number } | null = null;
          for (const loc of locations) {
            const res = isWithinRadius(pos, { lat: loc.lat, lng: loc.lng }, loc.radius_meters);
            if (res.within && (!nearest || res.distance < nearest.dist)) {
              nearest = { loc: loc as Location, dist: res.distance };
            }
          }
          if (nearest) {
            setMatchedLocation(nearest.loc);
            setCheckStatus(p => ({ ...p, location: 'passed', locationMsg: `${nearest!.loc.short_name} (${nearest!.dist}m)` }));
            locationOk = true;
          } else {
            let closestDist = Infinity, closestName = '';
            for (const loc of locations) {
              const res = isWithinRadius(pos, { lat: loc.lat, lng: loc.lng }, loc.radius_meters);
              if (res.distance < closestDist) { closestDist = res.distance; closestName = loc.short_name; }
            }
            setCheckStatus(p => ({ ...p, location: 'failed', locationMsg: `ไม่อยู่ในรัศมีหน่วยบริการใด (ใกล้สุด: ${closestName} ${closestDist}m)` }));
          }
        }
      } else {
        setCheckStatus(p => ({ ...p, location: 'failed', locationMsg: 'ไม่พบข้อมูลหน่วยบริการ' }));
      }
    } catch (err) {
      setCheckStatus(p => ({ ...p, location: 'failed', locationMsg: err instanceof Error ? err.message : 'ตรวจสอบตำแหน่งไม่ได้' }));
    }

    // 6. Device fingerprint
    try {
      const fp = await getDeviceFingerprint();
      setDeviceFp(fp);
      setCheckStatus(p => ({ ...p, device: 'passed', deviceMsg: 'อุปกรณ์พร้อม' }));
    } catch {
      setCheckStatus(p => ({ ...p, device: 'failed', deviceMsg: 'ไม่สามารถระบุอุปกรณ์ได้' }));
    }

    if (resolvedAction && locationOk) {
      setPhase('ready_to_verify');
    }
  }, [session]);

  useEffect(() => { runChecks(); }, [runChecks]);

  // Face verification: open camera, extract descriptor, compare with stored
  useEffect(() => {
    if (phase !== 'face_verify' || !storedDescriptor) return;
    let mounted = true;

    async function verifyFace() {
      try {
        await loadFaceApi();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Give camera 1 second to stabilize
        await new Promise(r => setTimeout(r, 1000));

        // Try up to 5 times
        let bestScore: number | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          if (!mounted || !videoRef.current) break;
          const desc = await extractDescriptor(videoRef.current);
          if (desc) {
            const threshold = settings?.face_match_threshold || 0.5;
            const result = isMatch(desc, storedDescriptor!, threshold);
            if (bestScore === null || result.distance < bestScore) {
              bestScore = result.distance;
              setLiveDescriptor(desc);
            }
            if (result.match) break;
          }
          await new Promise(r => setTimeout(r, 500));
        }

        if (!mounted) return;
        stopCamera();

        if (bestScore !== null && bestScore < (settings?.face_match_threshold || 0.5)) {
          setFaceMatchScore(bestScore);
          setPhase('scanning');
        } else {
          setFaceMatchScore(bestScore);
          setPhase('error');
          setResultMsg(`ใบหน้าไม่ตรงกับที่ลงทะเบียน${bestScore !== null ? ` (ค่าความต่าง: ${bestScore.toFixed(3)})` : ''}`);
        }
      } catch (err) {
        if (mounted) {
          stopCamera();
          setPhase('error');
          setResultMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยืนยันใบหน้า');
        }
      }
    }

    verifyFace();
    return () => { mounted = false; stopCamera(); };
  }, [phase, storedDescriptor, settings, stopCamera]);

  const handleLivenessComplete = useCallback((passed: boolean) => {
    if (passed && faceMatchScore !== null) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceMatchScore]);

  const handleSubmit = async () => {
    if (!action || !coords || !deviceFp || faceMatchScore === null) return;
    setPhase('submitting');

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_uuid: session.teacherUuid,
          action,
          lat: coords.lat,
          lng: coords.lng,
          location_id: matchedLocation?.id || null,
          device_fingerprint: deviceFp,
          liveness_passed: true,
          face_match_score: faceMatchScore,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhase('success');
        setResultMsg(data.message);

        // Adaptive face update: blend stored descriptor with live one
        if (liveDescriptor && storedDescriptor) {
          const blended = blendDescriptors(storedDescriptor, liveDescriptor, 0.2);
          const supabase = createClient();
          supabase.from('teachers').update({ face_descriptor: blended }).eq('id', session.teacherUuid).then(() => {});
        }
      } else {
        setPhase('error');
        setResultMsg(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setPhase('error');
      setResultMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const openProfile = async () => {
    setProfileMsg('');
    const supabase = createClient();
    const { data } = await supabase.from('teachers').select('full_name, position, pin_code').eq('id', session.teacherUuid).single();
    if (data) setProfileForm({ full_name: data.full_name, position: data.position || '', pin_code: data.pin_code });
    setShowProfile(true);
  };

  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) { setProfileMsg('กรุณากรอกชื่อ'); return; }
    if (!profileForm.pin_code || profileForm.pin_code.length < 4) { setProfileMsg('PIN อย่างน้อย 4 หลัก'); return; }
    setProfileSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('teachers').update({
      full_name: profileForm.full_name.trim(),
      position: profileForm.position.trim(),
      pin_code: profileForm.pin_code,
    }).eq('id', session.teacherUuid);
    setProfileSaving(false);
    if (error) { setProfileMsg('บันทึกไม่สำเร็จ: ' + error.message); return; }
    // Update local session
    const updated = { ...session, fullName: profileForm.full_name.trim() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setProfileMsg('บันทึกสำเร็จ');
    setTimeout(() => setShowProfile(false), 800);
  };

  const allChecksPassed =
    checkStatus.location === 'passed' &&
    checkStatus.time === 'passed' &&
    checkStatus.device === 'passed';

  const alreadyDone =
    (action === 'check_in' && todayRecord?.check_in_time) ||
    (action === 'check_out' && todayRecord?.check_out_time);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div>
          {session.isAdmin && <p className="text-slate-600 text-[10px] leading-none">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>}
          <h1 className="text-white font-bold text-base leading-tight">{ORG_SHORT}</h1>
          <p className="text-slate-400 text-xs">{session.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-mono text-sm tabular-nums">{currentTime}</span>
          {session.isAdmin && (
            <a href="/admin" className="p-2 text-amber-400 hover:text-amber-300 transition" title="จัดการระบบ">
              <Shield className="w-5 h-5" />
            </a>
          )}
          <button onClick={openProfile} className="p-2 text-slate-400 hover:text-white transition" title="ข้อมูลส่วนตัว">
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-4 gap-4 overflow-auto">
        {matchedLocation && (
          <div className="w-full max-w-sm bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-blue-300 text-sm font-medium">{matchedLocation.short_name}</p>
              <p className="text-slate-500 text-xs">อ.{matchedLocation.district}</p>
            </div>
          </div>
        )}

        {todayRecord && (
          <div className="w-full max-w-sm bg-slate-800/60 backdrop-blur rounded-xl p-3">
            <p className="text-slate-400 text-xs mb-1">สถานะวันนี้</p>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-slate-500">เข้า: </span>
                <span className="text-emerald-400">
                  {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">ออก: </span>
                <span className="text-orange-400">
                  {todayRecord.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
            </div>
          </div>
        )}

        <StatusCheck status={checkStatus} />

        {/* Ready to verify - user must tap to start camera */}
        {phase === 'ready_to_verify' && allChecksPassed && !alreadyDone && (
          <div className="w-full max-w-sm text-center py-4">
            <button
              onClick={() => setPhase('face_verify')}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition active:scale-[0.97] shadow-lg shadow-blue-500/30"
            >
              <ScanFace className="w-6 h-6" />
              {action === 'check_in' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน'}
            </button>
            <p className="text-slate-500 text-xs mt-2">กดปุ่มเพื่อเปิดกล้องยืนยันใบหน้า</p>
          </div>
        )}

        {/* Face verification phase */}
        {phase === 'face_verify' && allChecksPassed && !alreadyDone && (
          <div className="w-full max-w-sm">
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-64 border-4 border-dashed border-blue-400/50 rounded-full" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2 justify-center">
                  <ScanFace className="w-5 h-5 text-blue-400 animate-pulse" />
                  <span className="text-white text-sm">กำลังยืนยันใบหน้า...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liveness phase - after face verified */}
        {phase === 'scanning' && allChecksPassed && !alreadyDone && (
          <>
            <div className="w-full max-w-sm">
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-400 text-sm font-medium">ยืนยันใบหน้าสำเร็จ</p>
                  <p className="text-slate-400 text-xs">ขั้นตอนที่ 2: กะพริบตาและขยับหน้าเล็กน้อย</p>
                </div>
              </div>
            </div>
            <CameraLiveness onLivenessComplete={handleLivenessComplete} enabled={true} showDebug={session.isAdmin} />
          </>
        )}

        {alreadyDone && (
          <div className="w-full max-w-sm text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
            <p className="text-white text-lg font-semibold">
              {action === 'check_in' ? 'ลงเวลาเข้างานแล้ววันนี้' : 'ลงเวลาออกงานแล้ววันนี้'}
            </p>
          </div>
        )}

        {phase === 'submitting' && (
          <div className="w-full max-w-sm text-center py-8">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-white">กำลังบันทึก...</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="w-full max-w-sm text-center py-8">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <p className="text-emerald-400 text-xl font-bold mb-2">สำเร็จ!</p>
            <p className="text-white">{resultMsg}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="w-full max-w-sm text-center py-8">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-12 h-12 text-red-400" />
            </div>
            <p className="text-red-400 text-xl font-bold mb-2">ไม่สำเร็จ</p>
            <p className="text-white text-sm">{resultMsg}</p>
            <button onClick={runChecks} className="mt-4 px-6 py-2.5 bg-slate-700 text-white rounded-xl text-sm flex items-center gap-2 mx-auto hover:bg-slate-600 transition">
              <RotateCcw className="w-4 h-4" />ลองใหม่
            </button>
          </div>
        )}

        {phase === 'checking' && (checkStatus.time === 'failed' || checkStatus.location === 'failed') && (
          <div className="w-full max-w-sm text-center py-4">
            <button onClick={runChecks} className="px-6 py-2.5 bg-slate-700 text-white rounded-xl text-sm flex items-center gap-2 mx-auto hover:bg-slate-600 transition">
              <RotateCcw className="w-4 h-4" />ตรวจสอบใหม่
            </button>
          </div>
        )}
      </main>

      <footer className="px-4 py-3 bg-slate-900/80 backdrop-blur text-center">
        <button onClick={onLogout} className="text-slate-500 text-xs hover:text-red-400 transition">
          เปลี่ยนบัญชี
        </button>
      </footer>

      {/* Profile modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-sm bg-slate-800 rounded-t-2xl sm:rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">ข้อมูลส่วนตัว</h2>
              <button onClick={() => setShowProfile(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs block mb-1">ชื่อ-นามสกุล</label>
                <input value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">ตำแหน่ง</label>
                <input value={profileForm.position} onChange={e => setProfileForm({ ...profileForm, position: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">PIN</label>
                <input value={profileForm.pin_code} onChange={e => setProfileForm({ ...profileForm, pin_code: e.target.value.replace(/\D/g, '') })}
                  maxLength={6} inputMode="numeric"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm tracking-widest focus:outline-none focus:border-blue-500" />
              </div>
              {profileMsg && <p className={`text-xs text-center ${profileMsg.includes('สำเร็จ') ? 'text-emerald-400' : 'text-red-400'}`}>{profileMsg}</p>}
              <button onClick={saveProfile} disabled={profileSaving}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition">
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {profileSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
