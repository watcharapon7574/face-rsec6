'use client';

import {
  MapPin,
  Clock,
  Fingerprint,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export interface CheckStatus {
  location: 'checking' | 'passed' | 'failed' | 'idle';
  locationMsg: string;
  time: 'checking' | 'passed' | 'failed' | 'idle';
  timeMsg: string;
  device: 'checking' | 'passed' | 'failed' | 'idle';
  deviceMsg: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'checking':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-slate-600" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'passed':
      return 'text-emerald-300';
    case 'failed':
      return 'text-red-300';
    case 'checking':
      return 'text-blue-300';
    default:
      return 'text-slate-400';
  }
}

export default function StatusCheck({ status }: { status: CheckStatus }) {
  return (
    <div className="w-full max-w-sm mx-auto space-y-2 px-2">
      {/* Location */}
      <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur rounded-xl px-4 py-2.5">
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.location)}`}>
          {status.locationMsg || 'ตำแหน่งที่ตั้ง'}
        </span>
        <StatusIcon status={status.location} />
      </div>

      {/* Time */}
      <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur rounded-xl px-4 py-2.5">
        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.time)}`}>
          {status.timeMsg || 'ช่วงเวลา'}
        </span>
        <StatusIcon status={status.time} />
      </div>

      {/* Device */}
      <div className="flex items-center gap-3 bg-slate-800/60 backdrop-blur rounded-xl px-4 py-2.5">
        <Fingerprint className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.device)}`}>
          {status.deviceMsg || 'อุปกรณ์'}
        </span>
        <StatusIcon status={status.device} />
      </div>
    </div>
  );
}
