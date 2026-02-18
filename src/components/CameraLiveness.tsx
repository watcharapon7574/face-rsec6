'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createLivenessState,
  processLandmarks,
  getLivenessMessage,
  type LivenessState,
} from '@/lib/face-detection';
import { LIVENESS } from '@/lib/constants';
import { Camera, Eye, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface CameraLivenessProps {
  onLivenessComplete: (passed: boolean) => void;
  enabled: boolean;
  showDebug?: boolean;
}

export default function CameraLiveness({
  onLivenessComplete,
  enabled,
  showDebug = false,
}: CameraLivenessProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<unknown>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const [livenessState, setLivenessState] = useState<LivenessState>(
    createLivenessState()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    modelLoaded: false,
    loopRunning: false,
    facesFound: 0,
    keypointsCount: 0,
    videoReady: 0,
    lastError: '',
    frameCount: 0,
  });

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }

      setLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
      setLoading(false);
    }
  }, []);

  const loadModel = useCallback(async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );

      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        }
      );

      detectorRef.current = faceLandmarker;
      setDebugInfo((p) => ({ ...p, modelLoaded: true }));
      return faceLandmarker;
    } catch (err) {
      console.error('Model load error:', err);
      setDebugInfo((p) => ({ ...p, lastError: `model: ${err}` }));
      setError('ไม่สามารถโหลดโมเดลตรวจจับใบหน้าได้');
      return null;
    }
  }, []);

  const detectLoop = useCallback(async () => {
    const detector = detectorRef.current as {
      detectForVideo: (
        video: HTMLVideoElement,
        timestamp: number
      ) => {
        faceLandmarks: { x: number; y: number; z: number }[][];
      };
    } | null;

    if (
      !detector ||
      !videoRef.current ||
      videoRef.current.readyState < 2
    ) {
      setDebugInfo((p) => ({
        ...p,
        loopRunning: true,
        videoReady: videoRef.current?.readyState ?? -1,
      }));
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    // Check timeout
    if (
      startTimeRef.current &&
      Date.now() - startTimeRef.current > LIVENESS.DETECTION_TIMEOUT_MS
    ) {
      setLivenessState((prev) => {
        if (!prev.passed) {
          onLivenessComplete(false);
        }
        return prev;
      });
      return;
    }

    try {
      const results = detector.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const faceLandmarks = results.faceLandmarks;
      const numFaces = faceLandmarks?.length ?? 0;
      const numKeypoints = faceLandmarks?.[0]?.length ?? 0;

      setDebugInfo((p) => ({
        ...p,
        loopRunning: true,
        videoReady: videoRef.current?.readyState ?? -1,
        facesFound: numFaces,
        keypointsCount: numKeypoints,
        frameCount: p.frameCount + 1,
      }));

      if (numFaces > 0 && numKeypoints > 0) {
        // Convert normalized coords (0-1) to pixel coords
        const w = videoRef.current.videoWidth;
        const h = videoRef.current.videoHeight;
        const landmarks = faceLandmarks[0].map((lm) => ({
          x: lm.x * w,
          y: lm.y * h,
          z: lm.z,
        }));

        setLivenessState((prev) => {
          const next = processLandmarks(landmarks, prev);
          if (next.passed && !prev.passed) {
            onLivenessComplete(true);
          }
          return next;
        });

        // Draw face overlay
        if (canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = w;
            canvasRef.current.height = h;
            ctx.clearRect(0, 0, w, h);

            const noseTip = landmarks[1];
            if (noseTip) {
              ctx.beginPath();
              ctx.ellipse(
                noseTip.x,
                noseTip.y - 20,
                80,
                110,
                0,
                0,
                2 * Math.PI
              );
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 3;
              ctx.stroke();
            }
          }
        }
      } else {
        setLivenessState((prev) => ({ ...prev, faceDetected: false }));
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );
          }
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
      setDebugInfo((p) => ({ ...p, lastError: `detect: ${err}` }));
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, [onLivenessComplete]);

  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }

    let mounted = true;

    async function init() {
      await startCamera();
      const detector = await loadModel();
      if (detector && mounted) {
        startTimeRef.current = Date.now();
        setLivenessState(createLivenessState());
        animFrameRef.current = requestAnimationFrame(detectLoop);
      }
    }

    init();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [enabled, startCamera, loadModel, detectLoop, stopCamera]);

  const message = getLivenessMessage(livenessState);
  const progress =
    ((livenessState.blinkCount / LIVENESS.REQUIRED_BLINKS) * 0.7 +
      (livenessState.headMoved ? 0.3 : 0)) *
    100;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Camera viewport */}
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover mirror"
          playsInline
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Face guide oval */}
        {cameraReady && !livenessState.faceDetected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-64 border-4 border-dashed border-white/40 rounded-full" />
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
            <p className="text-white text-sm font-medium">กำลังเตรียมระบบ Liveness</p>
            <p className="text-slate-400 text-xs mt-1">เปิดกล้อง + โหลดโมเดลตรวจจับ</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-white text-center text-sm">{error}</p>
            <button
              onClick={() => {
                stopCamera();
                startCamera().then(loadModel);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Debug overlay - admin only */}
        {showDebug && cameraReady && !error && (
          <div className="absolute top-0 left-0 right-0 p-2 pointer-events-none">
            <div className="bg-black/70 rounded-lg p-2 text-[10px] font-mono text-white space-y-0.5">
              {/* Pipeline status */}
              <div className="text-[9px] text-gray-400 border-b border-gray-600 pb-1 mb-1">
                <span className={debugInfo.modelLoaded ? 'text-green-400' : 'text-red-400'}>MP:{debugInfo.modelLoaded ? 'OK' : 'NO'}</span>
                {' | '}
                <span className={debugInfo.loopRunning ? 'text-green-400' : 'text-red-400'}>Loop:{debugInfo.loopRunning ? 'OK' : 'NO'}</span>
                {' | '}
                <span>Vid:{debugInfo.videoReady}</span>
              </div>
              <div className="flex justify-between">
                <span>Faces found:</span>
                <span className={debugInfo.facesFound > 0 ? 'text-green-400' : 'text-red-400'}>{debugInfo.facesFound}</span>
              </div>
              <div className="flex justify-between">
                <span>Keypoints:</span>
                <span className={debugInfo.keypointsCount >= 468 ? 'text-green-400' : 'text-yellow-400'}>{debugInfo.keypointsCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Frames:</span>
                <span>{debugInfo.frameCount}</span>
              </div>
              {debugInfo.lastError && (
                <div className="text-red-400 text-[8px] break-all">{debugInfo.lastError}</div>
              )}
              <div className="border-t border-gray-600 pt-1 mt-1" />
              <div className="flex justify-between">
                <span>EAR:</span>
                <span className={livenessState.lastEAR < LIVENESS.BLINK_THRESHOLD ? 'text-red-400 font-bold' : 'text-green-400'}>
                  {livenessState.lastEAR.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Eye closed:</span>
                <span className={livenessState.eyeWasClosed ? 'text-red-400' : 'text-green-400'}>
                  {livenessState.eyeWasClosed ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Blinks:</span>
                <span className="text-cyan-400">{livenessState.blinkCount}/{LIVENESS.REQUIRED_BLINKS}</span>
              </div>
              <div className="flex justify-between">
                <span>Head moved:</span>
                <span className={livenessState.headMoved ? 'text-green-400' : 'text-gray-400'}>
                  {livenessState.headMoved ? 'YES' : 'NO'}
                </span>
              </div>
              {/* EAR bar */}
              <div className="mt-1">
                <div className="w-full h-2 bg-gray-700 rounded relative">
                  <div
                    className="absolute h-full bg-blue-500 rounded transition-all"
                    style={{ width: `${Math.min(livenessState.lastEAR / 0.4 * 100, 100)}%` }}
                  />
                  <div
                    className="absolute h-full w-px bg-yellow-400"
                    style={{ left: `${LIVENESS.BLINK_THRESHOLD / 0.4 * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status bar at bottom */}
        {cameraReady && !error && (
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/20 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            {/* Status message */}
            <div className="flex items-center gap-2 justify-center">
              {livenessState.passed ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : livenessState.faceDetected ? (
                <Eye className="w-5 h-5 text-blue-400 animate-pulse" />
              ) : (
                <Camera className="w-5 h-5 text-yellow-400" />
              )}
              <span
                className={`text-sm font-medium ${
                  livenessState.passed
                    ? 'text-green-400'
                    : 'text-white'
                }`}
              >
                {message}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
