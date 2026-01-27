
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { addHatToImage, generatePoseVariation } from './services/geminiService';
import { OutfitLayer, WardrobeItem, SavedLook } from './types';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage, fileToDataUrl, dataUrlToFile, urlToFile } from './lib/utils';
import Spinner from './components/Spinner';
import Create3DViewModal from './components/Create3DViewModal';
import Generate3DPreviewModal from './components/Generate3DPreviewModal';
import { getSavedLooks, saveLook, deleteLook } from './services/storageService';
import SavedLooksPanel from './components/SavedLooksPanel';
import CameraModal from './components/CameraModal';


const POSE_INSTRUCTIONS = [
  "Frontal view",
  "Slight right turn",
  "Slight left turn",
  "Profile view",
  "Tilted up",
  "Tilted down",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', listener);
    
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  
  const [isLivePreviewActive, setIsLivePreviewActive] = useState(false);
  const [livePreviewHat, setLivePreviewHat] = useState<WardrobeItem | null>(null);

  const [itemFor3DPreview, setItemFor3DPreview] = useState<WardrobeItem | null>(null);
  const [is3DPreviewModalOpen, setIs3DPreviewModalOpen] = useState(false);

  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);

  useEffect(() => {
    setSavedLooks(getSavedLooks());
  }, []);

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const staticActiveGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );

  const activeIds = useMemo(() => {
    if (isLivePreviewActive && livePreviewHat) {
        // In live preview, only the live hat is "active" visually
        return [livePreviewHat.id];
    }
    return staticActiveGarmentIds;
  }, [staticActiveGarmentIds, isLivePreviewActive, livePreviewHat]);
  
  const displayImages = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl ? { [POSE_INSTRUCTIONS[0]]: modelImageUrl } : {};
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl ? { [POSE_INSTRUCTIONS[0]]: modelImageUrl } : {};

    return currentLayer.poseImages;
  }, [outfitHistory, currentOutfitIndex, modelImageUrl]);

  const handle3DModelFinalized = (poseImages: Record<string, string>) => {
    const firstImage = Object.values(poseImages)[0];
    setModelImageUrl(firstImage);
    setOutfitHistory([{
      garment: null,
      poseImages,
    }]);
    setCurrentOutfitIndex(0);
    setIs3DModalOpen(false);
  };

  const handlePhotoCapture = async (file: File) => {
    setIsCameraModalOpen(false);
    setIsLoading(true);
    setLoadingMessage('Preparing your photo...');
    try {
      const imageUrl = await fileToDataUrl(file);
      setModelImageUrl(imageUrl);
      setOutfitHistory([{
        garment: null,
        poseImages: { [POSE_INSTRUCTIONS[0]]: imageUrl },
      }]);
      setCurrentOutfitIndex(0);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to load captured photo."));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    setIsLivePreviewActive(false);
    setLivePreviewHat(null);
  };

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    const baseModelLayer = outfitHistory[0];
    if (!baseModelLayer) return;

    setError(null);
    setIsLoading(true);

    try {
        const poseKeys = Object.keys(baseModelLayer.poseImages);
        const newPoseImages: Record<string, string> = {};

        for (let i = 0; i < poseKeys.length; i++) {
            const poseKey = poseKeys[i];
            const baseImage = baseModelLayer.poseImages[poseKey];
            setLoadingMessage(`Applying ${garmentInfo.name} to ${poseKey.toLowerCase()}... (${i + 1}/${poseKeys.length})`);
            
            const imageFile = await dataUrlToFile(baseImage, `base-${poseKey}.png`);
            
            const newImageUrl = await addHatToImage(imageFile, garmentFile);
            newPoseImages[poseKey] = newImageUrl;
        }
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: newPoseImages,
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(1);
      setCurrentPoseIndex(0);
      
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) return prev;
        return [...prev, garmentInfo];
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply hat'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [outfitHistory]);

  const handleWardrobeSelect = useCallback(async (item: WardrobeItem) => {
    if (isLoading) return;

    if (isLivePreviewActive) {
      setLivePreviewHat(item);
      return;
    }

    // Static image flow
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (currentLayer?.garment?.id === item.id) {
        return; // Already selected
    }
    
    try {
      const garmentFile = await urlToFile(item.url, item.name);
      await handleGarmentSelect(garmentFile, item);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to load wardrobe item'));
    }
  }, [isLoading, isLivePreviewActive, outfitHistory, currentOutfitIndex, handleGarmentSelect]);

  const handleLiveCapture = useCallback(async (capturedImageFile: File) => {
    if (isLoading || !livePreviewHat) return;
    
    const garmentInfo = livePreviewHat;
    setError(null);
    setIsLoading(true);
    setIsLivePreviewActive(false);
    setLivePreviewHat(null);
    setLoadingMessage(`Finalizing with ${garmentInfo.name}...`);
    
    try {
        const garmentFile = await urlToFile(garmentInfo.url, garmentInfo.name);
        const newImageUrl = await addHatToImage(capturedImageFile, garmentFile);
        
        const capturedImageDataUrl = await fileToDataUrl(capturedImageFile);
        const newBaseLayer: OutfitLayer = {
            garment: null,
            poseImages: { [POSE_INSTRUCTIONS[0]]: capturedImageDataUrl }
        };
        const newHatLayer: OutfitLayer = {
            garment: garmentInfo,
            poseImages: { [POSE_INSTRUCTIONS[0]]: newImageUrl }
        };

        setModelImageUrl(capturedImageDataUrl);
        setOutfitHistory([newBaseLayer, newHatLayer]);
        setCurrentOutfitIndex(1);
        setCurrentPoseIndex(0);

    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to apply hat from live capture'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [isLoading, livePreviewHat]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(0);
      setCurrentPoseIndex(0);
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    if (currentLayer && currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    // Ensure we have a base image to work with
    const baseImageForPoseChange = currentLayer ? Object.values(currentLayer.poseImages)[0] : null;
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const layerToUpdate = newHistory[currentOutfitIndex];
        if (layerToUpdate) {
            // Create a new layer object to trigger reactivity and fix potential type ambiguity
            const updatedLayer = { 
                ...layerToUpdate, 
                poseImages: { ...layerToUpdate.poseImages, [poseInstruction]: newImageUrl } 
            };
            newHistory[currentOutfitIndex] = updatedLayer;
        }
        return newHistory;
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex]);

  const handleOpen3DPreview = (item: WardrobeItem) => {
    setItemFor3DPreview(item);
    setIs3DPreviewModalOpen(true);
  };

  const handle3DPreviewGenerated = (itemId: string, views: Record<string, string>) => {
    setWardrobe(prevWardrobe => 
      prevWardrobe.map(item => 
        item.id === itemId ? { ...item, views } : item
      )
    );
  };

  const handleSaveLook = () => {
    if (outfitHistory.length < 2 || currentOutfitIndex === 0) return;

    const baseLayer = outfitHistory[0];
    const hatLayer = outfitHistory[currentOutfitIndex];

    if (!hatLayer.garment) return;

    const newLook: SavedLook = {
      id: Date.now().toString(),
      basePoseImages: baseLayer.poseImages,
      hat: hatLayer.garment,
      resultPoseImages: hatLayer.poseImages,
    };
    const updatedLooks = saveLook(newLook);
    setSavedLooks(updatedLooks);
  };

  const handleDeleteLook = (id: string) => {
    const updatedLooks = deleteLook(id);
    setSavedLooks(updatedLooks);
  };

  const handleLoadLook = (look: SavedLook) => {
    if (isLoading) return;

    const baseLayer: OutfitLayer = {
      garment: null,
      poseImages: look.basePoseImages,
    };
    const hatLayer: OutfitLayer = {
      garment: look.hat,
      poseImages: look.resultPoseImages,
    };
    
    const firstImage = Object.values(look.resultPoseImages)[0] || null;
    setModelImageUrl(firstImage);
    setOutfitHistory([baseLayer, hatLayer]);
    setCurrentOutfitIndex(1);
    setCurrentPoseIndex(0);
    setIsLivePreviewActive(false);
    setLivePreviewHat(null);
  };

  useEffect(() => {
    if (isLivePreviewActive) {
      setIsSheetCollapsed(false);
    }
  }, [isLivePreviewActive]);

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onOpen3DModal={() => setIs3DModalOpen(true)} onOpenCameraModal={() => setIsCameraModalOpen(true)} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  poseImages={displayImages}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  isLivePreviewActive={isLivePreviewActive}
                  setIsLivePreviewActive={setIsLivePreviewActive}
                  livePreviewHat={livePreviewHat}
                  onLiveCapture={handleLiveCapture}
                  onSaveLook={handleSaveLook}
                  isLookSavable={currentOutfitIndex > 0}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <SavedLooksPanel
                      looks={savedLooks}
                      onLoadLook={handleLoadLook}
                      onDeleteLook={handleDeleteLook}
                      isLoading={isLoading}
                    />
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastGarment={handleRemoveLastGarment}
                    />
                    <WardrobePanel
                      onItemSelect={handleWardrobeSelect}
                      activeIds={activeIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                      onGenerate3DPreview={handleOpen3DPreview}
                    />
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
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
          </motion.div>
        )}
      </AnimatePresence>
      <Create3DViewModal 
        isOpen={is3DModalOpen}
        onClose={() => setIs3DModalOpen(false)}
        onComplete={handle3DModelFinalized}
      />
      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handlePhotoCapture}
      />
      <Generate3DPreviewModal
        isOpen={is3DPreviewModalOpen}
        onClose={() => setIs3DPreviewModalOpen(false)}
        item={itemFor3DPreview}
        onComplete={handle3DPreviewGenerated}
        isLoadingApp={isLoading}
      />
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;
