/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { SavedLook } from '../types';

const STORAGE_KEY = 'biggar_hats_saved_looks';

export const getSavedLooks = (): SavedLook[] => {
  try {
    const savedLooksJson = localStorage.getItem(STORAGE_KEY);
    return savedLooksJson ? JSON.parse(savedLooksJson) : [];
  } catch (error) {
    console.error("Failed to retrieve saved looks:", error);
    return [];
  }
};

export const saveLook = (newLook: SavedLook): SavedLook[] => {
  const looks = getSavedLooks();
  // Prevent duplicates based on the generated image of the first pose
  const firstResultImage = Object.values(newLook.resultPoseImages)[0];
  const isDuplicate = looks.some(look => 
    Object.values(look.resultPoseImages)[0] === firstResultImage
  );

  if (isDuplicate) {
    return looks; // Don't add if it's already there
  }
  
  const updatedLooks = [newLook, ...looks];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLooks));
  } catch (error) {
    console.error("Failed to save look:", error);
  }
  return updatedLooks;
};

export const deleteLook = (lookId: string): SavedLook[] => {
  let looks = getSavedLooks();
  const updatedLooks = looks.filter(look => look.id !== lookId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLooks));
  } catch (error) {
    console.error("Failed to delete look:", error);
  }
  return updatedLooks;
};
