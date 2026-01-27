/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CameraIcon, CheckCircleIcon } from './icons';
import { fileToDataUrl } from '../lib/utils';
import Spinner from './Spinner';

interface Create3DViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (poseImages: Record<string, string>) => void;
}

const CAPTURE_STEPS = [
  { instruction: "Look straight at the camera", key: "Frontal view", guideClass: "" },
  { instruction: "Turn your head to the left", key: "Slight right turn", guideClass: "animate-turn-left" },
  { instruction: "Turn your head to the right", key: "Slight left turn", guideClass: "animate-turn-right" },
];

const Create3DViewModal: React.FC<Create3DViewModalProps> = ({ isOpen, onClose, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedImages, setCapturedImages] = useState<Record<string, File>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Corrected useEffect to manage camera lifecycle robustly.
  useEffect(() => {
    // If the modal isn't open, there's nothing to do.
    // The cleanup function from the previous render will have already stopped the camera.
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    
    // Reset all state for a new session *every time* the modal opens.
    setCurrentStep(0);
    setCapturedImages({});
    setIsProcessing(false);
    setIsCameraLoading(true);
    setError(null);

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!isCancelled) {
          setError("Camera access is not supported by your browser.");
          setIsCameraLoading(false);
        }
        return;
      }

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (!isCancelled) {
          setStream(newStream);
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
          }
        } else {
          // If the component unmounted while we were waiting for the camera, clean up.
          newStream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Error accessing 3D view camera:", err);
        let message = "Could not access camera. Please check permissions.";
        if (err instanceof DOMException) {
          switch (err.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
              message = "Camera access denied. Please enable permissions in your browser settings.";
              break;
            case "NotFoundError":
            case "DevicesNotFoundError":
              message = "No camera found on this device.";
              break;
            case "NotReadableError":
            case "TrackStartError":
              message = "Camera is in use by another application.";
              break;
            default:
              message = "Could not start camera due to an unknown error.";
              break;
          }
        }
        if (!isCancelled) {
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsCameraLoading(false);
        }
      }
    };

    startCamera();

    // Cleanup function: This runs when `isOpen` becomes false or the component unmounts.
    return () => {
      isCancelled = true;
      setStream(prevStream => {
        if (prevStream) {
          prevStream.getTracks().forEach(track => track.stop());
        }
        return null;
      });
    };
  }, [isOpen]);

  const handleCapture = async () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], `${CAPTURE_STEPS[currentStep].key}.png`, { type: 'image/png' });
          const newCapturedImages = { ...capturedImages, [CAPTURE_STEPS[currentStep].key]: file };
          setCapturedImages(newCapturedImages);

          if (currentStep < CAPTURE_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
          } else {
            // Last step, process and complete
            setIsProcessing(true);
            try {
                const poseImagesDataUrls: Record<string, string> = {};
                for (const key in newCapturedImages) {
                    poseImagesDataUrls[key] = await fileToDataUrl(newCapturedImages[key]);
                }
                onComplete(poseImagesDataUrls);
            } catch (e) {
                setError("Failed to process images.");
                setIsProcessing(false);
            }
          }
        }
      }
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:bg-gray-100 z-20">
            <XIcon className="w-6 h-6" />
        </button>

        {isProcessing ? (
            <div className="p-8 h-96 flex flex-col items-center justify-center">
                <Spinner />
                <p className="mt-4 font-serif text-lg text-gray-700">Finalizing your 3D view...</p>
            </div>
        ) : (
            <>
                <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                    
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center text-white p-4 text-center bg-gray-900">{error}</div>
                    )}
                    {isCameraLoading && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center bg-gray-900">
                            <Spinner />
                            <p className="mt-3">Starting camera...</p>
                        </div>
                    )}
                    {!stream && !isCameraLoading && !error && (
                        <div className="absolute inset-0 flex items-center justify-center text-white p-4 text-center bg-gray-900">Camera not available.</div>
                    )}
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <svg viewBox="0 0 100 100" className="w-48 h-48 opacity-20">
                            <defs><mask id="face-mask"><rect width="100" height="100" fill="white"></rect><ellipse cx="50" cy="48" rx="25" ry="32" fill="black"></ellipse></mask></defs>
                            <rect width="100" height="100" mask="url(#face-mask)" fill="white"></rect>
                        </svg>
                    </div>
                </div>
                <div className="p-6 text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-2xl font-serif text-gray-800 mb-2">Create 3D View ({currentStep + 1}/{CAPTURE_STEPS.length})</h2>
                            <p className="text-gray-600 mb-6">{CAPTURE_STEPS[currentStep].instruction}</p>
                        </motion.div>
                    </AnimatePresence>
                    
                    <div className="flex items-center justify-center space-x-4 mb-6">
                        {CAPTURE_STEPS.map((step, index) => (
                            <div key={step.key} className="flex items-center gap-2">
                                {Object.keys(capturedImages).length > index ? (
                                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                ) : (
                                    <div className={`w-5 h-5 rounded-full border-2 ${currentStep === index ? 'border-indigo-600' : 'border-gray-300'}`}></div>
                                )}
                                <span className={`text-sm ${currentStep === index ? 'font-bold text-indigo-600' : 'text-gray-500'}`}>{step.key.split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleCapture} 
                        disabled={!stream || !!error || isCameraLoading} 
                        className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mx-auto"
                        aria-label="Capture photo"
                    >
                        <div className="w-16 h-16 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors flex items-center justify-center">
                            <CameraIcon className="w-8 h-8 text-white" />
                        </div>
                    </button>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default Create3DViewModal;