'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { loadFaceApi, extractDescriptor, averageDescriptors } from '@/lib/face-recognition';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { FACE_MATCH, ORG_SHORT } from '@/lib/constants';
import type { UserSession } from '@/lib/types';
import { Camera, Loader2, CheckCircle2, AlertCircle, ScanFace } from 'lucide-react';

interface FaceEnrollmentProps {
  session: UserSession;
  onComplete: () => void;
}

export default function FaceEnrollment({ session, onComplete }: FaceEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'capturing' | 'saving' | 'done' | 'error'>('loading');
  const [samples, setSamples] = useState<Float32Array[]>([]);
  const [message, setMessage] = useState('กำลังโหลดโมเดล...');
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await loadFaceApi();
        if (!mounted) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (mounted) {
          setPhase('ready');
          setMessage(`ถ่ายภาพใบหน้า ${FACE_MATCH.ENROLLMENT_SAMPLES} มุม เพื่อลงทะเบียน`);
        }
      } catch (err) {
        if (mounted) {
          setPhase('error');
          setError(err instanceof Error ? err.message : 'ไม่สามารถเปิดกล้องหรือโหลดโมเดลได้');
        }
      }
    }

    init();
    return () => { mounted = false; stopCamera(); };
  }, [stopCamera]);

  const captureSample = useCallback(async () => {
    if (!videoRef.current || phase !== 'ready') return;
    setPhase('capturing');
    setMessage('กำลังวิเคราะห์ใบหน้า...');

    // Run extraction with minimum display time so user sees the overlay
    const [descriptor] = await Promise.all([
      extractDescriptor(videoRef.current),
      new Promise(r => setTimeout(r, 1000)),
    ]);

    if (!descriptor) {
      setPhase('ready');
      setMessage('ตรวจไม่พบใบหน้า กรุณาหันหน้าตรงแล้วลองอีกครั้ง');
      return;
    }

    const newSamples = [...samples, descriptor];
    setSamples(newSamples);

    if (newSamples.length >= FACE_MATCH.ENROLLMENT_SAMPLES) {
      setPhase('saving');
      setMessage('กำลังบันทึกข้อมูลใบหน้า...');

      try {
        const avgDescriptor = averageDescriptors(newSamples);
        const fp = await getDeviceFingerprint();

        const res = await fetch('/api/enrollment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_uuid: session.teacherUuid,
            face_descriptor: avgDescriptor,
            device_fingerprint: fp,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          stopCamera();
          setPhase('done');
          setMessage('ลงทะเบียนใบหน้าสำเร็จ!');
        } else {
          setPhase('error');
          setError(data.error || 'บันทึกไม่สำเร็จ');
        }
      } catch {
        setPhase('error');
        setError('ไม่สามารถเชื่อมต่อระบบได้');
      }
    } else {
      setPhase('ready');
      const remaining = FACE_MATCH.ENROLLMENT_SAMPLES - newSamples.length;
      const hints = ['ตรงหน้า', 'เอียงซ้ายเล็กน้อย', 'เอียงขวาเล็กน้อย'];
      setMessage(`สำเร็จ! เหลืออีก ${remaining} ภาพ — ${hints[newSamples.length] || 'ถ่ายอีกครั้ง'}`);
    }
  }, [phase, samples, session.teacherUuid, stopCamera]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <header className="px-4 py-3 bg-slate-900/80 backdrop-blur flex items-center justify-center gap-2.5">
        <img src="/icons/fastface.png" alt="FastFace" className="w-9 h-9" />
        <div>
          <h1 className="text-white font-bold text-sm leading-tight">{ORG_SHORT}</h1>
          <p className="text-blue-400 text-xs">ลงทะเบียนใบหน้า</p>
          <p className="text-slate-400 text-[11px]">{session.fullName}</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-4">
        {/* Camera */}
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline muted autoPlay
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Face guide */}
          {(phase === 'ready' || phase === 'capturing') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-64 border-4 border-dashed border-blue-400/50 rounded-full" />
            </div>
          )}

          {/* Loading overlay */}
          {phase === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
              <p className="text-white text-sm">กำลังโหลดโมเดล AI...</p>
            </div>
          )}

          {/* Capturing overlay */}
          {phase === 'capturing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm">
              <ScanFace className="w-16 h-16 text-blue-400 animate-pulse mb-4" />
              <p className="text-white font-semibold">กำลังวิเคราะห์ใบหน้า...</p>
              <p className="text-slate-400 text-xs mt-1">กรุณารอสักครู่</p>
            </div>
          )}

          {/* Saving overlay */}
          {phase === 'saving' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm">
              <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mb-4" />
              <p className="text-white font-semibold">กำลังบันทึกข้อมูลใบหน้า...</p>
              <p className="text-slate-400 text-xs mt-1">({samples.length}/{FACE_MATCH.ENROLLMENT_SAMPLES} ภาพ)</p>
            </div>
          )}

          {/* Progress indicator */}
          <div className="absolute top-4 left-4 right-4 flex gap-2">
            {Array.from({ length: FACE_MATCH.ENROLLMENT_SAMPLES }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < samples.length ? 'bg-blue-400' : 'bg-white/20'}`} />
            ))}
          </div>

          {/* Status at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2 justify-center">
              {phase === 'capturing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
              {phase === 'ready' && <Camera className="w-4 h-4 text-blue-400" />}
              {phase === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {phase === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className={`text-sm ${phase === 'done' ? 'text-emerald-400' : phase === 'error' ? 'text-red-400' : 'text-white'}`}>
                {error || message}
              </span>
            </div>
          </div>
        </div>

        {/* Capture button - visible in both ready and capturing states */}
        {(phase === 'ready' || phase === 'capturing') && (
          <button
            onClick={captureSample}
            disabled={phase === 'capturing'}
            className="w-full max-w-sm py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition active:scale-[0.97] shadow-lg shadow-blue-500/30"
          >
            {phase === 'capturing' ? (
              <><Loader2 className="w-6 h-6 animate-spin" />กำลังวิเคราะห์...</>
            ) : (
              <><ScanFace className="w-6 h-6" />ถ่ายภาพ ({samples.length + 1}/{FACE_MATCH.ENROLLMENT_SAMPLES})</>
            )}
          </button>
        )}

        {phase === 'saving' && (
          <div className="flex items-center gap-2 text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">กำลังบันทึก...</span>
          </div>
        )}

        {phase === 'done' && (
          <button
            onClick={onComplete}
            className="w-full max-w-sm py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition"
          >
            <CheckCircle2 className="w-6 h-6" />
            เริ่มใช้งาน
          </button>
        )}

        {phase === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="w-full max-w-sm py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm"
          >
            ลองใหม่
          </button>
        )}
      </main>
    </div>
  );
}
