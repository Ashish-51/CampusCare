/* ==========================================================================
   CampusCare - Firebase Storage Service Layer
   ========================================================================== */

import { storage, ref, uploadBytesResumable, getDownloadURL } from '../config/firebase-config.js';

/**
 * Client-side image compressor using HTML5 Canvas
 */
export function compressImage(file, maxWidth = 300, maxHeight = 300, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      resolve({ blob: file, dataUrl: null });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            resolve({ blob: blob || file, dataUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve({ blob: file, dataUrl: e.target.result });
      img.src = e.target.result;
    };
    reader.onerror = () => resolve({ blob: file, dataUrl: null });
    reader.readAsDataURL(file);
  });
}

/**
 * Upload complaint image file to Firebase Storage
 */
export async function uploadComplaintImage(complaintId, file, progressCallback = null) {
  if (!file) return null;

  // Compress evidence image (max 1200x1200, 0.82 quality)
  const { blob, dataUrl } = await compressImage(file, 1200, 1200, 0.82);
  const uploadFile = blob || file;

  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `complaint_images/${complaintId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, uploadFile);

    const storagePromise = new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressCallback) progressCallback(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ url: downloadUrl, path: storagePath });
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Storage upload timeout')), 6000);
    });

    return await Promise.race([storagePromise, timeoutPromise]);
  } catch (error) {
    console.warn('Firebase storage complaint image upload fallback to local compressed Data URL:', error.message || error);
    return { url: dataUrl, path: 'local_data_url' };
  }
}

/**
 * Upload profile avatar picture to Firebase Storage with Base64 fallback & strict 3.5s timeout
 */
export async function uploadAvatarImage(uid, file, progressCallback = null) {
  if (!file) return null;

  // 1. Instant client-side compression (max 300x300 JPEG ~20KB)
  const { blob, dataUrl } = await compressImage(file, 300, 300, 0.8);
  const uploadFile = blob || file;

  try {
    const fileName = `${Date.now()}_avatar.jpg`;
    const storagePath = `avatars/${uid}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, uploadFile);

    const storagePromise = new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressCallback) progressCallback(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ url: downloadUrl, path: storagePath });
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Storage avatar upload timeout')), 3500);
    });

    return await Promise.race([storagePromise, timeoutPromise]);
  } catch (error) {
    console.warn('Firebase storage avatar upload fallback to local compressed Data URL:', error.message || error);
    return { url: dataUrl, path: 'local_data_url' };
  }
}


