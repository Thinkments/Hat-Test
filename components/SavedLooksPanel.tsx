/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { SavedLook } from '../types';
import { Trash2Icon } from './icons';

interface SavedLooksPanelProps {
  looks: SavedLook[];
  onLoadLook: (look: SavedLook) => void;
  onDeleteLook: (id: string) => void;
  isLoading: boolean;
}

const SavedLooksPanel: React.FC<SavedLooksPanelProps> = ({ looks, onLoadLook, onDeleteLook, isLoading }) => {
  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Saved Looks</h2>
      {looks.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-4">Your saved looks will appear here. Add a hat and click the 'Save' button.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {looks.map((look) => (
            <div
              key={look.id}
              className="relative aspect-square border rounded-lg overflow-hidden group focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gray-800"
            >
              <button
                onClick={() => onLoadLook(look)}
                disabled={isLoading}
                className="w-full h-full disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={`Load look with ${look.hat.name}`}
              >
                <img
                  src={Object.values(look.resultPoseImages)[0]}
                  alt={`Saved look with ${look.hat.name}`}
                  className="w-full h-full object-cover"
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLook(look.id);
                }}
                disabled={isLoading}
                className="absolute top-1.5 right-1.5 bg-white/70 backdrop-blur-sm p-1.5 rounded-full text-gray-600 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Delete look with ${look.hat.name}`}
                title="Delete Look"
              >
                <Trash2Icon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedLooksPanel;
