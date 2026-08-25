import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Validates file format, corruption, and size.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { valid: false, error: "File appears to be corrupted or empty." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds the maximum limit of 2 MB." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: "Unsupported format. Only JPG, JPEG, PNG, and WEBP images are allowed." };
  }
  return { valid: true };
}

/**
 * Transforms a Cloudinary URL to add responsive optimization flags (/c_limit,w_800,q_auto,f_auto/).
 */
export function getOptimizedCloudinaryUrl(url: string, width = 800, quality = "auto"): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com") || url.includes("/c_limit")) return url;

  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return url;

  const prefix = url.substring(0, uploadIndex + 8); // includes '/upload/'
  const suffix = url.substring(uploadIndex + 8);
  return `${prefix}c_limit,w_${width},q_${quality},f_auto/${suffix}`;
}

/**
 * Uploads an image to Cloudinary using unsigned upload.
 * Validates image type and size strictly before uploading.
 * Falls back safely to Firebase Storage if Cloudinary is unavailable.
 */
export async function uploadToCloudinary(file: File, customPreset?: string): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file");
  }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "linkcloud";
  const uploadPreset = customPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "linkcloud";

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.secure_url) {
        return getOptimizedCloudinaryUrl(data.secure_url);
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn("[Cloudinary] Upload response error:", res.status, errData);
    }
  } catch (err) {
    console.warn("[Cloudinary] Upload failed, falling back to Firebase Storage:", err);
  }

  // Firebase Storage Fallback
  const ext = file.name.split(".").pop() || "png";
  const storageRef = ref(storage, `profiles/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}
