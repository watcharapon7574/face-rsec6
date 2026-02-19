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
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'checking':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-slate-300" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'passed':
      return 'text-emerald-600';
    case 'failed':
      return 'text-red-500';
    case 'checking':
      return 'text-blue-600';
    default:
      return 'text-slate-500';
  }
}

export default function StatusCheck({ status }: { status: CheckStatus }) {
  return (
    <div className="w-full max-w-sm mx-auto space-y-2 px-2">
      {/* Location */}
      <div className="flex items-center gap-3 bg-blue-50/80 backdrop-blur rounded-xl px-4 py-2.5 border border-blue-100">
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.location)}`}>
          {status.locationMsg || 'ตำแหน่งที่ตั้ง'}
        </span>
        <StatusIcon status={status.location} />
      </div>

      {/* Time */}
      <div className="flex items-center gap-3 bg-blue-50/80 backdrop-blur rounded-xl px-4 py-2.5 border border-blue-100">
        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.time)}`}>
          {status.timeMsg || 'ช่วงเวลา'}
        </span>
        <StatusIcon status={status.time} />
      </div>

      {/* Device */}
      <div className="flex items-center gap-3 bg-blue-50/80 backdrop-blur rounded-xl px-4 py-2.5 border border-blue-100">
        <Fingerprint className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`text-xs flex-1 ${statusColor(status.device)}`}>
          {status.deviceMsg || 'อุปกรณ์'}
        </span>
        <StatusIcon status={status.device} />
      </div>
    </div>
  );
}
