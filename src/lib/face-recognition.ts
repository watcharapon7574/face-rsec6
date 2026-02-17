import { FACE_MATCH } from './constants';

let faceApiLoaded = false;
let faceApi: typeof import('@vladmandic/face-api');

export async function loadFaceApi() {
  if (faceApiLoaded) return faceApi;

  faceApi = await import('@vladmandic/face-api');

  await Promise.all([
    faceApi.nets.ssdMobilenetv1.loadFromUri(FACE_MATCH.MODEL_URL),
    faceApi.nets.faceLandmark68Net.loadFromUri(FACE_MATCH.MODEL_URL),
    faceApi.nets.faceRecognitionNet.loadFromUri(FACE_MATCH.MODEL_URL),
  ]);

  faceApiLoaded = true;
  return faceApi;
}

export async function extractDescriptor(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const api = await loadFaceApi();
  const detection = await api
    .detectSingleFace(videoOrCanvas)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
}

export function computeDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export function isMatch(
  liveDescriptor: Float32Array,
  storedDescriptor: number[],
  threshold: number = FACE_MATCH.DEFAULT_THRESHOLD
): { match: boolean; distance: number } {
  const distance = computeDistance(liveDescriptor, storedDescriptor);
  return { match: distance < threshold, distance };
}

export function blendDescriptors(
  stored: number[],
  live: Float32Array | number[],
  liveWeight: number = 0.2
): number[] {
  const oldWeight = 1 - liveWeight;
  return stored.map((v, i) => v * oldWeight + (live[i] ?? v) * liveWeight);
}

export function averageDescriptors(descriptors: Float32Array[]): number[] {
  if (descriptors.length === 0) return [];
  const len = descriptors[0].length;
  const avg = new Array(len).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) {
      avg[i] += d[i];
    }
  }
  for (let i = 0; i < len; i++) {
    avg[i] /= descriptors.length;
  }
  return avg;
}
