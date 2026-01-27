/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    let rawMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    // Check for specific unsupported MIME type error from Gemini API
    if (rawMessage.includes("Unsupported MIME type")) {
        try {
            // It might be a JSON string like '{"error":{"message":"..."}}'
            const errorJson = JSON.parse(rawMessage);
            const nestedMessage = errorJson?.error?.message;
            if (nestedMessage && nestedMessage.includes("Unsupported MIME type")) {
                const mimeType = nestedMessage.split(': ')[1] || 'unsupported';
                return `File type '${mimeType}' is not supported. Please use a format like PNG, JPEG, or WEBP.`;
            }
        } catch (e) {
            // Not a JSON string, but contains the text. Fallthrough to generic message.
        }
        // Generic fallback for any "Unsupported MIME type" error
        return `Unsupported file format. Please upload an image format like PNG, JPEG, or WEBP.`;
    }
    
    return `${context}. ${rawMessage}`;
}

/**
 * Converts a data URL string to a File object.
 * @param dataUrl The data URL to convert.
 * @param filename The desired filename for the output File.
 * @returns A Promise that resolves to a File object.
 */
export async function dataUrlToFile(dataUrl: string, filename:string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
};

/**
 * Converts a File object to a data URL string.
 * @param file The file to convert.
 * @returns A Promise that resolves to a data URL string.
 */
export const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
};

/**
 * Converts an image URL to a File object using fetch.
 * This is more robust for CORS issues than the canvas-based approach.
 * @param url The image URL.
 * @param filename The desired filename for the output File.
 * @returns A Promise that resolves to a File object.
 */
export const urlToFile = async (url: string, filename: string): Promise<File> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network request failed with status ${response.status}: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to convert URL to File: ${url}. Error: ${errorMessage}`);
        throw new Error(`Could not load image from ${url}. Please check the network connection and if the image URL is correct. Details: ${errorMessage}`);
    }
};
