/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useState, useEffect } from 'react';
import { WardrobeItem } from '../types';
import { getFriendlyErrorMessage } from '../lib/utils';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import Spinner from './Spinner';
import { CameraIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

// A higher value means less smoothing and more responsiveness.
const SMOOTHING_FACTOR = 0.4;
const YAW_SENSITIVITY = 280;
const PITCH_SENSITIVITY = 180; 
// Threshold for switching to a side view image.
const YAW_THRESHOLD = 22;

interface LivePreviewFeedProps {
  activeHat: WardrobeItem | null;
  onCapture: (file: File) => void;
  isAppLoading: boolean;
}

const LivePreviewFeed: React.FC<LivePreviewFeedProps> = ({ activeHat, onCapture, isAppLoading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const animationFrameIdRef = useRef<number | null>(null);
  
  const smoothedHatStateRef = useRef({
    x: 0, y: 0, width: 0,
    rotationZ: 0, rotationY: 0, rotationX: 0,
    initialized: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Unified state for hat style and image to ensure synchronized updates
  const [hatDisplayState, setHatDisplayState] = useState<{
    style: React.CSSProperties;
    imageUrl: string | null;
  }>({ style: { display: 'none' }, imageUrl: null });

  const [hatViews, setHatViews] = useState<Record<string, string> | null>(null);

  // Effect to update available hat views when the active hat changes
  useEffect(() => {
    if (activeHat) {
      const viewsAvailable = activeHat.views &&
        'Front View' in activeHat.views &&
        'Left Side View' in activeHat.views &&
        'Right Side View' in activeHat.views;

      if (viewsAvailable) {
        setHatViews(activeHat.views!);
      } else {
        // Fallback for hats without a 3D preview, using only the front view
        setHatViews({ 'Front View': activeHat.url });
      }
    } else {
      setHatViews(null);
    }
  }, [activeHat]);

  useEffect(() => {
    let isCancelled = false;
    
    setIsInitializing(true);
    setError(null);
    setHatDisplayState({ style: { display: 'none' }, imageUrl: null });
    smoothedHatStateRef.current.initialized = false;

    const initialize = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (!isCancelled) setError("Could not access camera. Please check permissions.");
        setIsInitializing(false);
        return;
      }

      try {
        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm");
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO", numFaces: 1,
        });
        if (isCancelled) {
            landmarker.close();
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        faceLandmarkerRef.current = landmarker;
        setIsInitializing(false);
        startPredictionLoop();
      } catch (e) {
        if (!isCancelled) setError("Could not load face tracking model.");
        setIsInitializing(false);
        stream.getTracks().forEach(track => track.stop());
      }
    };

    const startPredictionLoop = () => {
        const video = videoRef.current;
        if (!faceLandmarkerRef.current || !video) return;

        const predictWebcam = () => {
          if (!faceLandmarkerRef.current || video.readyState < 2) {
            animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
            return;
          }
    
          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = faceLandmarkerRef.current.detectForVideo(video, Date.now());
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0 && hatViews) {
                const landmarks = results.faceLandmarks[0];
                const p1 = landmarks[130], p2 = landmarks[359], forehead = landmarks[10];
                const chin = landmarks[152], leftCheekContour = landmarks[234], rightCheekContour = landmarks[454];

                const videoWidth = video.clientWidth, videoHeight = video.clientHeight;
                const p1x = (1 - p1.x) * videoWidth, p2x = (1 - p2.x) * videoWidth, foreheadX = (1 - forehead.x) * videoWidth;
    
                const rawHatWidth = Math.hypot(p2x - p1x, p2.y * videoHeight - p1.y * videoHeight) * 1.5;
                const rawRotationZ = Math.atan2(p2.y - p1.y, p2x - p1x) * (180 / Math.PI);
                const rawHatX = foreheadX - (rawHatWidth / 2), rawHatY = (forehead.y * videoHeight) - (rawHatWidth * 0.6);
                
                const zYaw = rightCheekContour.z - leftCheekContour.z;
                const zPitch = chin.z - forehead.z;
                const rawRotationY = zYaw * YAW_SENSITIVITY;
                const rawRotationX = zPitch * PITCH_SENSITIVITY;
                
                const smoothed = smoothedHatStateRef.current;

                if (!smoothed.initialized) {
                    Object.assign(smoothed, { x: rawHatX, y: rawHatY, width: rawHatWidth, rotationZ: rawRotationZ, rotationY: rawRotationY, rotationX: rawRotationX, initialized: true });
                } else {
                    smoothed.x += (rawHatX - smoothed.x) * SMOOTHING_FACTOR;
                    smoothed.y += (rawHatY - smoothed.y) * SMOOTHING_FACTOR;
                    smoothed.width += (rawHatWidth - smoothed.width) * SMOOTHING_FACTOR;
                    smoothed.rotationZ += (rawRotationZ - smoothed.rotationZ) * SMOOTHING_FACTOR;
                    smoothed.rotationY += (rawRotationY - smoothed.rotationY) * SMOOTHING_FACTOR;
                    smoothed.rotationX += (rawRotationX - smoothed.rotationX) * SMOOTHING_FACTOR;
                }
    
                // Logic to switch views based on yaw
                let activeViewKey = 'Front View';
                let transformY = smoothed.rotationY;

                const has3DViews = 'Left Side View' in hatViews && 'Right Side View' in hatViews;

                if (has3DViews) {
                  if (smoothed.rotationY > YAW_THRESHOLD) {
                    activeViewKey = 'Right Side View';
                    transformY = 0; // The image itself provides the rotation, so we reset the CSS rotation
                  } else if (smoothed.rotationY < -YAW_THRESHOLD) {
                    activeViewKey = 'Left Side View';
                    transformY = 0;
                  }
                }
                
                setHatDisplayState({
                  imageUrl: hatViews[activeViewKey],
                  style: {
                    position: 'absolute', left: `${smoothed.x}px`, top: `${smoothed.y}px`,
                    width: `${smoothed.width}px`,
                    transform: `rotateZ(${smoothed.rotationZ}deg) rotateY(${transformY}deg) rotateX(${smoothed.rotationX}deg)`,
                    display: 'block',
                  },
                });

            } else {
              setHatDisplayState(s => ({ ...s, style: { ...s.style, display: 'none' }}));
              smoothedHatStateRef.current.initialized = false;
            }
          }
          animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
        };
        predictWebcam();
    }

    initialize();

    return () => {
      isCancelled = true;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handleCapture = async () => {
    if (videoRef.current && !isCapturing && activeHat) {
      setIsCapturing(true);
      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
          context.translate(canvas.width, 0);
          context.scale(-1, 1); // Mirror the captured image
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
          if (blob) {
              const capturedFile = new File([blob], `live-capture.png`, { type: 'image/png' });
              onCapture(capturedFile);
          }
        }
      } catch (err) {
        setError(getFriendlyErrorMessage(err, "Failed to prepare captured image."));
      } finally {
        setIsCapturing(false);
      }
    }
  };

  return (
    <div className="w-full h-full bg-gray-900 relative flex items-center justify-center" style={{ perspective: '700px' }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
        
        <AnimatePresence>
          {activeHat && hatDisplayState.imageUrl && (
            <motion.img 
              key={hatDisplayState.imageUrl}
              src={hatDisplayState.imageUrl}
              alt="Hat" 
              style={{ ...hatDisplayState.style, transformStyle: 'preserve-3d', filter: 'drop-shadow(0px 8px 15px rgba(0,0,0,0.35))' }} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              draggable="false" 
              className="pointer-events-none absolute" 
            />
          )}
        </AnimatePresence>
    
        {(error || isInitializing) && (
            <div className="absolute inset-0 bg-gray-800/90 flex flex-col items-center justify-center text-white p-4 text-center">
            {error ? (
                <p>{error}</p>
            ) : (
                <>
                    <Spinner />
                    <p className="mt-3 font-serif">Initializing camera...</p>
                </>
            )}
            </div>
        )}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <button
                onClick={handleCapture}
                disabled={!activeHat || isAppLoading || isCapturing || isInitializing || !!error}
                className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-label="Capture photo"
            >
                <div className="w-12 h-12 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors flex items-center justify-center">
                  <CameraIcon className="w-6 h-6 text-white"/>
                </div>
            </button>
        </div>
    </div>
  );
};

export default LivePreviewFeed;
