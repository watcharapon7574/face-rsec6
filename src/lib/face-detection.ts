import { LIVENESS } from './constants';

// Eye landmark indices for MediaPipe Face Mesh (468 landmarks)
const LEFT_EYE = {
  top: [159, 145],
  bottom: [23, 27],
  inner: [133],
  outer: [33],
  upper: [158, 160],
  lower: [144, 153],
};

const RIGHT_EYE = {
  top: [386, 374],
  bottom: [253, 257],
  inner: [362],
  outer: [263],
  upper: [385, 387],
  lower: [373, 380],
};

// Specific EAR landmarks (6 points per eye)
const LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_EAR = [362, 385, 387, 263, 373, 380];

interface Point {
  x: number;
  y: number;
  z?: number;
}

function euclidean(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeEAR(landmarks: Point[], indices: number[]): number {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const vertical1 = euclidean(p2, p6);
  const vertical2 = euclidean(p3, p5);
  const horizontal = euclidean(p1, p4);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export interface LivenessState {
  blinkCount: number;
  lastEAR: number;
  eyeWasClosed: boolean;
  faceDetected: boolean;
  passed: boolean;
  headPositions: { x: number; y: number; time: number }[];
  headMoved: boolean;
}

export function createLivenessState(): LivenessState {
  return {
    blinkCount: 0,
    lastEAR: 1,
    eyeWasClosed: false,
    faceDetected: false,
    passed: false,
    headPositions: [],
    headMoved: false,
  };
}

export function processLandmarks(
  landmarks: Point[],
  state: LivenessState
): LivenessState {
  if (!landmarks || landmarks.length < 468) {
    return { ...state, faceDetected: false };
  }

  const newState = { ...state, faceDetected: true };

  // Calculate Eye Aspect Ratio
  const leftEAR = computeEAR(landmarks, LEFT_EYE_EAR);
  const rightEAR = computeEAR(landmarks, RIGHT_EYE_EAR);
  const avgEAR = (leftEAR + rightEAR) / 2;

  newState.lastEAR = avgEAR;

  // Blink detection
  if (avgEAR < LIVENESS.BLINK_THRESHOLD) {
    newState.eyeWasClosed = true;
  } else if (newState.eyeWasClosed && avgEAR >= LIVENESS.BLINK_THRESHOLD) {
    newState.blinkCount = state.blinkCount + 1;
    newState.eyeWasClosed = false;
  }

  // Head movement detection (nose tip = landmark 1)
  const noseTip = landmarks[1];
  const now = Date.now();
  const positions = [
    ...state.headPositions,
    { x: noseTip.x, y: noseTip.y, time: now },
  ].filter((p) => now - p.time < 3000); // Keep last 3 seconds

  newState.headPositions = positions;

  if (positions.length >= 10) {
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    if (xRange > 15 || yRange > 15) {
      newState.headMoved = true;
    }
  }

  // Check if liveness passed
  if (newState.blinkCount >= LIVENESS.REQUIRED_BLINKS && newState.headMoved) {
    newState.passed = true;
  }

  return newState;
}

export function getLivenessMessage(state: LivenessState): string {
  if (!state.faceDetected) {
    return 'กรุณาหันหน้าเข้าหากล้อง';
  }
  if (state.blinkCount < LIVENESS.REQUIRED_BLINKS) {
    return `กะพริบตา (${state.blinkCount}/${LIVENESS.REQUIRED_BLINKS})`;
  }
  if (!state.headMoved) {
    return 'ขยับหน้าเล็กน้อย ซ้าย-ขวา';
  }
  return 'ผ่านการตรวจสอบ ✓';
}
