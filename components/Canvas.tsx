/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, ShareIcon, PlayIcon, PauseIcon, CameraIcon, HeartIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import { dataUrlToFile } from '../lib/utils';
import LivePreviewFeed from './LivePreviewFeed';
import { WardrobeItem } from '../types';

interface CanvasProps {
  poseImages: Record<string, string>;
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  isLivePreviewActive: boolean;
  setIsLivePreviewActive: (isActive: boolean) => void;
  livePreviewHat: WardrobeItem | null;
  onLiveCapture: (file: File) => void;
  onSaveLook: () => void;
  isLookSavable: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
  poseImages, onStartOver, isLoading, loadingMessage, onSelectPose, poseInstructions, currentPoseIndex,
  isLivePreviewActive, setIsLivePreviewActive, livePreviewHat, onLiveCapture, onSaveLook, isLookSavable
}) => {
  const [isPoseMenuOpen, setIsPoseMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const imageArray = useMemo(() => {
    if (!poseImages) return [];
    const orderedKeys = ["Slight left turn", "Frontal view", "Slight right turn"];
    const presentKeys = orderedKeys.filter(key => poseImages[key]);

    if (presentKeys.length === 3) {
      return [poseImages[presentKeys[0]], poseImages[presentKeys[1]], poseImages[presentKeys[2]], poseImages[presentKeys[1]]];
    }
    return Object.values(poseImages);
  }, [poseImages]);

  const displayImageUrl = useMemo(() => {
    if (imageArray.length > 1) {
      return imageArray[activeImageIndex];
    }
    const singleKey = Object.keys(poseImages)[0];
    return poseImages[singleKey] || null;
  }, [imageArray, activeImageIndex, poseImages]);
  
  const is3DView = useMemo(() => imageArray.length > 1, [imageArray]);

  useEffect(() => {
    if (is3DView && isAnimating && !isLivePreviewActive) {
      const interval = setInterval(() => {
        setActiveImageIndex(prevIndex => (prevIndex + 1) % imageArray.length);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [is3DView, isAnimating, imageArray.length, isLivePreviewActive]);

  const handlePreviousPose = () => {
    if (is3DView) {
        setActiveImageIndex(prev => (prev - 1 + imageArray.length) % imageArray.length);
        return;
    }
    onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
  };

  const handleNextPose = () => {
    if (is3DView) {
        setActiveImageIndex(prev => (prev + 1) % imageArray.length);
        return;
    }
    onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
  };
  
  const handleShare = async () => {
    if (!displayImageUrl) return;

    try {
      const file = await dataUrlToFile(displayImageUrl, 'my-biggar-hat-look.png');
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My New Look from Biggar Hats!',
          text: 'Check out this hat I tried on virtually with Biggar Hats.',
        });
      } else {
        const link = document.createElement('a');
        link.href = displayImageUrl;
        link.download = 'my-biggar-hat-look.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error sharing:', error);
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const link = document.createElement('a');
      link.href = displayImageUrl;
      link.download = 'my-biggar-hat-look.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative animate-zoom-in group">
      <div className="absolute top-4 left-4 right-4 z-30 flex justify-between">
        <button 
            onClick={onStartOver}
            className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
        >
            <RotateCcwIcon className="w-4 h-4 mr-2" />
            Start Over
        </button>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsLivePreviewActive(!isLivePreviewActive)}
                className={`flex items-center justify-center text-center border font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out active:scale-95 text-sm backdrop-blur-sm ${
                    isLivePreviewActive 
                    ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700' 
                    : 'bg-white/60 border-gray-300/80 text-gray-700 hover:bg-white hover:border-gray-400'
                }`}
                aria-label={isLivePreviewActive ? 'Exit Live Preview' : 'Enter Live Preview'}
            >
                <CameraIcon className="w-4 h-4 mr-2" />
                {isLivePreviewActive ? 'Exit Live' : 'Live Preview'}
            </button>
            {isLookSavable && !isLivePreviewActive && (
                <button
                    onClick={onSaveLook}
                    className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
                    aria-label="Save this look"
                >
                    <HeartIcon className="w-4 h-4 mr-2" />
                    Save
                </button>
            )}
            {displayImageUrl && !isLoading && (
            <button 
                onClick={handleShare}
                className="flex items-center justify-center text-center bg-white/60 border border-gray-300/80 text-gray-700 font-semibold py-2 px-4 rounded-full transition-all duration-200 ease-in-out hover:bg-white hover:border-gray-400 active:scale-95 text-sm backdrop-blur-sm"
                aria-label="Share your look"
            >
                <ShareIcon className="w-4 h-4 mr-2" />
                Share
            </button>
            )}
        </div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center">
        <div className="aspect-[2/3] h-full max-h-full w-auto max-w-full relative overflow-hidden rounded-lg">
            {isLivePreviewActive ? (
              <LivePreviewFeed
                activeHat={livePreviewHat}
                onCapture={onLiveCapture}
                isAppLoading={isLoading}
              />
            ) : (
              <>
                {displayImageUrl ? (
                    <AnimatePresence mode="popLayout">
                        <motion.img
                            key={displayImageUrl}
                            src={displayImageUrl}
                            alt="Virtual try-on model"
                            className="absolute inset-0 w-full h-full object-contain"
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0.8 }}
                            transition={{ duration: is3DView ? 0.4 : 0.2, ease: 'easeInOut' }}
                        />
                    </AnimatePresence>
                ) : (
                    <div className="w-full h-full bg-gray-100 border border-gray-200 flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="text-md font-serif text-gray-600 mt-4">Loading Model...</p>
                    </div>
                )}
              </>
            )}
        </div>
        
        <AnimatePresence>
          {isLoading && !isLivePreviewActive && (
              <motion.div
                  className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
              >
                  <Spinner />
                  {loadingMessage && (
                      <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {displayImageUrl && !isLoading && !isLivePreviewActive && (
        <div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div className="flex items-center justify-center gap-2 bg-white/60 backdrop-blur-md rounded-full p-2 border border-gray-300/50">
            <button 
              onClick={handlePreviousPose}
              aria-label="Previous pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-800" />
            </button>

            {is3DView ? (
                <button
                    onClick={() => setIsAnimating(!isAnimating)}
                    className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all"
                    aria-label={isAnimating ? 'Pause animation' : 'Play animation'}
                >
                    {isAnimating ? <PauseIcon className="w-5 h-5 text-gray-800" /> : <PlayIcon className="w-5 h-5 text-gray-800" />}
                </button>
            ) : (
                <span onMouseEnter={() => setIsPoseMenuOpen(true)} onMouseLeave={() => setIsPoseMenuOpen(false)} className="relative text-sm font-semibold text-gray-800 w-48 text-center truncate cursor-pointer" title={poseInstructions[currentPoseIndex]}>
                    {poseInstructions[currentPoseIndex]}
                     <AnimatePresence>
                        {isPoseMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="absolute bottom-full mb-3 w-64 -translate-x-1/2 left-1/2 bg-white/80 backdrop-blur-lg rounded-xl p-2 border border-gray-200/80"
                            >
                                <div className="grid grid-cols-2 gap-2">
                                    {poseInstructions.map((pose, index) => (
                                        <button
                                            key={pose}
                                            onClick={() => onSelectPose(index)}
                                            disabled={isLoading || index === currentPoseIndex}
                                            className="w-full text-left text-sm font-medium text-gray-800 p-2 rounded-md hover:bg-gray-200/70 disabled:opacity-50 disabled:bg-gray-200/70 disabled:font-bold disabled:cursor-not-allowed"
                                        >
                                            {pose}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </span>
            )}
            
            <button 
              onClick={handleNextPose}
              aria-label="Next pose"
              className="p-2 rounded-full hover:bg-white/80 active:scale-90 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-800" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;