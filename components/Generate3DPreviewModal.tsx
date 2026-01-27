/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { WardrobeItem } from '../types';
import { generateHatView } from '../services/geminiService';
import { getFriendlyErrorMessage, urlToFile } from '../lib/utils';
import Spinner from './Spinner';

interface Generate3DPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: WardrobeItem | null;
  onComplete: (itemId: string, views: Record<string, string>) => void;
  isLoadingApp: boolean;
}

const VIEWS_TO_GENERATE = ["Front View", "Right Side View", "Back View", "Left Side View"];

const Generate3DPreviewModal: React.FC<Generate3DPreviewModalProps> = ({ isOpen, onClose, item, onComplete, isLoadingApp }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [generatedViews, setGeneratedViews] = useState<Record<string, string> | null>(null);
    const [currentViewIndex, setCurrentViewIndex] = useState(0);

    const orderedViews = useMemo(() => {
        if (!generatedViews) return [];
        // Ensure a consistent order for viewing
        return VIEWS_TO_GENERATE.map(key => ({ key, url: generatedViews[key] })).filter(v => v.url);
    }, [generatedViews]);

    const handleGeneration = useCallback(async (itemToProcess: WardrobeItem) => {
        if (itemToProcess.views && Object.keys(itemToProcess.views).length > 0) {
            setGeneratedViews(itemToProcess.views);
            return;
        }

        setIsGenerating(true);
        setError(null);
        setLoadingMessage('');
        const newViews: Record<string, string> = {};

        try {
            const originalHatFile = await urlToFile(itemToProcess.url, itemToProcess.name);
            
            for (let i = 0; i < VIEWS_TO_GENERATE.length; i++) {
                const viewName = VIEWS_TO_GENERATE[i];
                setLoadingMessage(`Generating ${viewName.toLowerCase()}... (${i + 1}/${VIEWS_TO_GENERATE.length})`);

                if (viewName === "Front View") {
                    newViews[viewName] = itemToProcess.url;
                    setGeneratedViews({...newViews}); // Update UI with first image immediately
                    continue;
                }
                
                const generatedImageUrl = await generateHatView(originalHatFile, viewName);
                newViews[viewName] = generatedImageUrl;
                setGeneratedViews({...newViews}); // Update UI as each view is generated
            }

            onComplete(itemToProcess.id, newViews);

        } catch (err) {
            setError(getFriendlyErrorMessage(err, 'Failed to generate 3D preview'));
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
        }
    }, [onComplete]);

    useEffect(() => {
        if (isOpen && item) {
            setCurrentViewIndex(0);
            handleGeneration(item);
        }
    }, [isOpen, item, handleGeneration]);
    
    const handleClose = () => {
        if (isGenerating) return;
        onClose();
    }

    const handleNext = () => setCurrentViewIndex(prev => (prev + 1) % orderedViews.length);
    const handlePrev = () => setCurrentViewIndex(prev => (prev - 1 + orderedViews.length) % orderedViews.length);
    
    if (!isOpen) return null;

    const currentView = orderedViews[currentViewIndex];

    return (
        <div 
          className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in" 
          onClick={handleClose}
          aria-modal="true"
          role="dialog"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-serif tracking-wider text-gray-800">{item?.name} - 3D Preview</h2>
                    <button onClick={handleClose} disabled={isGenerating} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">
                        <XIcon className="w-6 h-6"/>
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center justify-center min-h-[350px]">
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center text-center">
                            <Spinner />
                            <p className="text-lg font-serif text-gray-700 mt-4">{loadingMessage}</p>
                            <p className="text-sm text-gray-500 mt-1">This may take a moment.</p>
                        </div>
                    )}

                    {!isGenerating && error && (
                         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md w-full" role="alert">
                            <p className="font-bold">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    
                    {!isGenerating && !error && currentView && (
                        <div className="w-full flex flex-col items-center justify-center animate-fade-in">
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={currentView.url}
                                    src={currentView.url}
                                    alt={`${item?.name} - ${currentView.key}`}
                                    className="w-48 h-48 object-contain"
                                    initial={{ opacity: 0.5, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0.5, scale: 0.98 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                />
                            </AnimatePresence>

                            <div className="flex items-center justify-between w-full mt-6">
                                <button 
                                    onClick={handlePrev}
                                    className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
                                    aria-label="Previous view"
                                >
                                    <ChevronLeftIcon className="w-6 h-6 text-gray-800" />
                                </button>
                                <span className="font-semibold text-gray-700 text-lg w-40 text-center">{currentView.key}</span>
                                <button 
                                    onClick={handleNext}
                                    className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-all"
                                    aria-label="Next view"
                                >
                                    <ChevronRightIcon className="w-6 h-6 text-gray-800" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Generate3DPreviewModal;
