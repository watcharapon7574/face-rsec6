import type { AttendanceSettings, TimeStatus } from './types';

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getTimeStatus(settings: AttendanceSettings): TimeStatus {
  const now = nowMinutes();
  const currentTime = formatTime(new Date());

  const ciStart = timeToMinutes(settings.check_in_start);
  const ciEnd = timeToMinutes(settings.check_in_end);
  const coStart = timeToMinutes(settings.check_out_start);
  const coEnd = timeToMinutes(settings.check_out_end);

  const canCheckIn = now >= ciStart && now <= ciEnd;
  const canCheckOut = now >= coStart && now <= coEnd;

  let message = '';
  if (canCheckIn) {
    message = `เวลาเข้างาน (${settings.check_in_start} - ${settings.check_in_end})`;
  } else if (canCheckOut) {
    message = `เวลาออกงาน (${settings.check_out_start} - ${settings.check_out_end})`;
  } else if (now < ciStart) {
    message = `ยังไม่ถึงเวลาเข้างาน (เริ่ม ${settings.check_in_start})`;
  } else if (now > ciEnd && now < coStart) {
    message = `รอเวลาออกงาน (เริ่ม ${settings.check_out_start})`;
  } else {
    message = 'หมดเวลาลงเวลาวันนี้';
  }

  return { canCheckIn, canCheckOut, message, currentTime };
}

export function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
