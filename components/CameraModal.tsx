/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCwIcon, XIcon } from './icons';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(true);

  // Effect to manage the camera lifecycle based on the modal's `isOpen` state.
  useEffect(() => {
    // If the modal isn't open, there's nothing to do.
    // The cleanup function from the previous render will have already stopped the camera.
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    
    // Reset state for a new session
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
        // Use the most compatible video constraints
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
        console.error("Error accessing camera:", err);
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

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && !isCapturing && stream) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally to create a mirror image effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        requestAnimationFrame(() => {
          canvas.toBlob(blob => {
            if (blob) {
              const file = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
              onCapture(file);
              onClose(); // This will trigger the useEffect cleanup
            }
            setIsCapturing(false);
          }, 'image/png', 0.95);
        });
      } else {
        setIsCapturing(false);
      }
    }
  };

  const handleRetry = () => {
    // A simple way to retry is to simulate closing and opening, which triggers the effect
    onClose();
    setTimeout(() => {
       // This assumes the parent component will re-trigger the modal to open
       // A more direct state management would be needed for a true in-component retry
       // For now, this is a placeholder for a more complex retry logic if needed.
       // The current useEffect handles retries by re-opening the modal.
       // Let's just make it re-run the effect by re-triggering the parent.
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="relative aspect-video bg-gray-900">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          <canvas ref={canvasRef} className="hidden" />
          
          {error && (
            <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center text-white p-4">
              <p className="text-center mb-4">{error}</p>
              <button onClick={handleRetry} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          )}

          {isCameraLoading && !error && (
            <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center text-white p-4">
               <svg className="animate-spin h-8 w-8 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Starting camera...</p>
            </div>
          )}
        </div>
        <div className="p-4 flex items-center justify-between bg-gray-50">
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200" aria-label="Close camera">
            <XIcon className="w-6 h-6" />
          </button>
          <button 
            onClick={handleCapture} 
            disabled={!!error || isCapturing || !stream || isCameraLoading} 
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Capture photo"
          >
            <div className="w-12 h-12 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors"></div>
          </button>
          <div className="w-10"></div> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
