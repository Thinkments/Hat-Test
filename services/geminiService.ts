
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { dataUrlToParts } from "../lib/utils";

// Helper to convert File to Gemini part
const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

// Helper to convert data URL to Gemini part
const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

// Helper to handle API response and extract the generated image
const handleApiResponse = (response: GenerateContentResponse): string => {
    // Check for blocking or safety termination
    if (response.candidates?.[0]?.finishReason === 'SAFETY' || response.candidates?.[0]?.finishReason === 'OTHER') {
        const errorMessage = `Image generation stopped. Reason: ${response.candidates[0].finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    // Access .text property directly as per guidelines
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

/**
 * Photorealistically overlays a hat onto a person's image using gemini-2.5-flash-image.
 */
export const addHatToImage = async (baseImage: File | string, hatImage: File): Promise<string> => {
    // Instantiate AI client inside function to ensure fresh API key usage
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelImagePart = typeof baseImage === 'string'
        ? dataUrlToPart(baseImage)
        : await fileToPart(baseImage);
        
    const hatImagePart = await fileToPart(hatImage);

    const prompt = `You are a world-class AI fashion editor and 3D compositor specializing in luxury headwear. Your task is to photorealistically overlay the 'hat image' onto the 'person image'.

**Advanced Placement Logic:**
1. **Anatomical Mapping**: Analyze the person's head shape (oval, round, heart, or square) and tilt. Determine the exact position of the crown and hairline.
2. **Hair & Volume Adaptation**: 
   - If the person has high-volume or curly hair, the hat should sit slightly higher, as if resting on the hair. 
   - For flat or short hair, the hat should sit closer to the scalp.
   - Blend the hat's edge so that hair naturally flows from underneath the brim. Avoid a "hard cut" look.
3. **Perspective Alignment**: Scale and rotate the hat to match the person's 3D head orientation. Ensure the perspective of the hat's brim matches the eye-level of the photo.
4. **Natural Lighting & Contact Shadows**:
   - The hat must inherit the color temperature and lighting direction of the 'person image'.
   - Cast a soft, realistic "contact shadow" on the forehead and hair where the brim makes contact.
   - Create ambient occlusion in the inner crown area where it meets the hair.

**Constraint Checklist:**
- Keep the person's facial features and background 100% identical.
- Ensure the hat doesn't look like a sticker; it must appear "seated" on the head.
- OUTPUT ONLY the final processed image. No text.`;

    // Query GenAI with both the model name and prompt directly
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [modelImagePart, hatImagePart, { text: prompt }] },
    });
    return handleApiResponse(response);
};

/**
 * Generates a pose variation of a person wearing a hat using gemini-2.5-flash-image.
 */
export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image of a person wearing a specific hat and regenerate the entire scene from a new perspective: "${poseInstruction}". 

**Consistency Requirements:**
1. **Identity Retention**: The person's face, build, and exact hat style (color, texture, shape) must be preserved perfectly.
2. **Environmental Continuity**: The background style and lighting conditions must match the original.
3. **Realistic Perspective**: When turning the head, ensure the hat follows the 3D movement of the skull naturally.
4. **Output**: Return ONLY the new high-resolution image. No text.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [tryOnImagePart, { text: prompt }] },
    });
    return handleApiResponse(response);
};

/**
 * Generates different views of a hat for 3D preview using gemini-2.5-flash-image.
 */
export const generateHatView = async (baseHatImage: File, viewInstruction: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const hatImagePart = await fileToPart(baseHatImage);
    const prompt = `You are an expert product photographer for high-end fashion. Create a new 3D view of this hat.
New perspective instruction: "${viewInstruction}".

**Guidelines:**
1. **Material Fidelity**: Retain the exact fabric texture (felt, straw, cotton), color, and any accessories (bands, logos, pins).
2. **Shape Integrity**: The hat's structural shape must be consistent across views.
3. **Transparent Background**: Ensure the background is pure transparent or clean white.
4. **Output**: Return ONLY the final image of the hat. No text.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [hatImagePart, { text: prompt }] },
    });

    return handleApiResponse(response);
};
