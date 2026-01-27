/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { motion } from 'framer-motion';
import { UserIcon, View3dIcon, CameraIcon } from './icons';

interface StartScreenProps {
  onOpen3DModal: () => void;
  onOpenCameraModal: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onOpen3DModal, onOpenCameraModal }) => {
  return (
    <>
      <motion.div
        className="bg-white shadow-2xl rounded-2xl p-8 md:p-12 w-full max-w-lg text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-gray-500" />
            </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif tracking-wider text-gray-800 mb-2">Virtual Try-On</h1>
        <p className="text-gray-600 mb-8 max-w-sm mx-auto">
          Choose an option below to begin your immersive try-on experience.
        </p>

        <div className="space-y-4">
          <button
            onClick={onOpen3DModal}
            className="w-full flex items-center justify-center text-center bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-indigo-700 active:scale-95 text-base"
          >
            <View3dIcon className="w-5 h-5 mr-2" />
            Create 3D View
          </button>
          <button
            onClick={onOpenCameraModal}
            className="w-full flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-100 active:scale-95 text-base"
          >
            <CameraIcon className="w-5 h-5 mr-2" />
            Take a Photo
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default StartScreen;
