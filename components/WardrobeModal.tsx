/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { WardrobeItem } from '../types';
import { UploadCloudIcon, CheckCircleIcon, View3dIcon } from './icons';
import { getFriendlyErrorMessage, urlToFile } from '../lib/utils';

interface WardrobePanelProps {
  onItemSelect: (item: WardrobeItem) => void;
  onGenerate3DPreview: (item: WardrobeItem) => void;
  activeIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
}

const WardrobePanel: React.FC<WardrobePanelProps> = ({ onItemSelect, onGenerate3DPreview, activeIds, isLoading, wardrobe }) => {
    const [error, setError] = useState<string | null>(null);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading) return;
        onItemSelect(item);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            try {
                const customGarmentInfo: WardrobeItem = {
                    id: `custom-${Date.now()}`,
                    name: file.name,
                    url: URL.createObjectURL(file), 
                };
                onItemSelect(customGarmentInfo);

            } catch(err) {
                 setError(getFriendlyErrorMessage(err, 'Failed to handle uploaded file.'));
            }
        }
    };

  return (
    <div className="pt-6 border-t border-gray-400/50">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-serif tracking-wider text-gray-800">Hat Gallery</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
            {wardrobe.map((item) => {
            const isActive = activeIds.includes(item.id);
            return (
                <div
                  key={item.id}
                  className="relative aspect-square border rounded-lg overflow-hidden group focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gray-800"
                >
                  <button
                    onClick={() => handleGarmentClick(item)}
                    disabled={isLoading || isActive}
                    className="w-full h-full disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label={`Select ${item.name}`}
                  >
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-end justify-center p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-bold text-center">{item.name}</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => onGenerate3DPreview(item)}
                    disabled={isLoading}
                    className="absolute top-1.5 right-1.5 bg-white/70 backdrop-blur-sm p-1.5 rounded-full text-gray-700 hover:bg-white hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Generate 3D preview for ${item.name}`}
                    title="Generate 3D Preview"
                  >
                    <View3dIcon className="w-5 h-5" />
                  </button>

                  {isActive && (
                      <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center pointer-events-none">
                          <CheckCircleIcon className="w-8 h-8 text-white" />
                      </div>
                  )}
                </div>
            );
            })}
        </div>
        
        <div className="mt-4">
          <label htmlFor="custom-garment-upload" className={`w-full flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-100 active:scale-95 text-base ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
              <UploadCloudIcon className="w-5 h-5 mr-2"/>
              <span>Upload Your Hat</span>
              <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
          </label>
        </div>

        {wardrobe.length === 0 && (
             <p className="text-center text-sm text-gray-500 mt-4">Your uploaded hats will appear here.</p>
        )}
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
    </div>
  );
};

export default WardrobePanel;