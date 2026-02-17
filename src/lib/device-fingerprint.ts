import { DEVICE_FP_KEY } from './constants';

export async function getDeviceFingerprint(): Promise<string> {
  const stored = localStorage.getItem(DEVICE_FP_KEY);
  if (stored) return stored;

  const fp = await generateFingerprint();
  localStorage.setItem(DEVICE_FP_KEY, fp);
  return fp;
}

async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  components.push(navigator.userAgent);
  components.push(navigator.language);
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(navigator.hardwareConcurrency?.toString() || '0');
  components.push((navigator as unknown as Record<string, string>).deviceMemory?.toString() || '0');

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('FaceAttend fingerprint', 2, 2);
      components.push(canvas.toDataURL());
    }
  } catch {
    // canvas fingerprint not available
  }

  const raw = components.join('|||');
  const msgBuffer = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
