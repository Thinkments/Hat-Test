/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  views?: Record<string, string>; // e.g., { "Front": "url1", "Side": "url2" }
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}

export interface SavedLook {
  id: string;
  basePoseImages: Record<string, string>;
  hat: WardrobeItem;
  resultPoseImages: Record<string, string>;
}
