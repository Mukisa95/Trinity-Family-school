import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  getMetadata,
  uploadBytesResumable
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { FirebaseAuthService } from '@/lib/firebase-auth';
import type { Photo, PhotoCategory, PhotoUsage } from '@/types';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const COLLECTION_NAME = 'photos';
const STORAGE_PATH = 'school-photos';

export class PhotosService {
  /**
   * Upload a photo to Firebase Storage and save metadata to Firestore
   */
  static async uploadPhoto(
    file: File,
    metadata: {
      title: string;
      description?: string;
      category: PhotoCategory;
      usage: PhotoUsage[];
      uploadedBy: string;
      tags?: string[];
      isPrimary?: boolean;
    }
  ): Promise<Photo> {
    try {
      console.log('🔍 Starting photo upload process...');

      // Authenticate with Firebase
      await signInAnonymously(auth);
      console.log('🔍 Firebase authentication successful:', auth.currentUser?.uid);

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${STORAGE_PATH}/${metadata.category}/${fileName}`;

      // Create storage reference
      const storageRef = ref(storage, filePath);
      console.log('🔍 Storage ref created:', storageRef);
      console.log('🔍 File path:', filePath);
      console.log('🔍 Storage bucket:', storage.app.options.storageBucket);

      // Try upload with different approach - use uploadBytesResumable for better error handling
      console.log('🔍 Starting resumable upload...');
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            // Progress monitoring
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('🔍 Upload progress:', Math.round(progress) + '%');
          },
          (error) => {
            console.error('❌ Upload error:', error);
            reject(error);
          },
          () => {
            console.log('✅ Upload completed successfully');
            resolve(uploadTask.snapshot);
          }
        );
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      console.log('🔍 Generated download URL:', downloadUrl);

      // Validate and fix URL format if needed
      let finalUrl = downloadUrl;
      if (downloadUrl.includes('?name=')) {
        console.warn('❌ Malformed URL detected, applying fix');
        const match = downloadUrl.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\?name=(.+)/);
        if (match) {
          const bucket = match[1];
          const filePath = decodeURIComponent(match[2]);
          const encodedPath = encodeURIComponent(filePath);
          finalUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
          console.log('🔧 Applied URL fix:', finalUrl);
        }
      }
      console.log('🔍 Final URL:', finalUrl);

      // Get image dimensions if it's an image
      let dimensions: { width: number; height: number } | undefined;
      if (file.type.startsWith('image/')) {
        try {
          dimensions = await this.getImageDimensions(file);
          console.log('🔍 Image dimensions:', dimensions);
        } catch (dimError) {
          console.warn('⚠️ Could not get image dimensions:', dimError);
        }
      }

      // Create photo document
      const photoData = {
        title: metadata.title,
        description: metadata.description || '',
        category: metadata.category,
        usage: metadata.usage,
        url: finalUrl,
        fileName,
        fileSize: file.size,
        dimensions,
        isActive: true,
        isPrimary: metadata.isPrimary || false,
        uploadedBy: metadata.uploadedBy,
        uploadedAt: new Date().toISOString(),
        tags: metadata.tags || []
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, COLLECTION_NAME), photoData);
      console.log('✅ Photo saved to database with ID:', docRef.id);

      return {
        id: docRef.id,
        ...photoData
      } as Photo;

    } catch (error: any) {
      console.error('❌ Error uploading photo:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack
      });
      
      // More specific error messages based on error type
      if (error?.code === 'storage/unauthorized') {
        throw new Error('Upload failed: Not authorized to access Firebase Storage');
      } else if (error?.code === 'storage/canceled') {
        throw new Error('Upload failed: Upload was canceled');
      } else if (error?.code === 'storage/unknown') {
        throw new Error('Upload failed: Unknown storage error - check Firebase configuration');
      } else if (error?.message?.includes('CORS')) {
        throw new Error('Upload failed: CORS error - Firebase Storage not properly configured');
      } else {
        throw new Error(`Upload failed: ${error?.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Upload photo using local file storage (bypasses Firebase Storage issues)
   */
  static async uploadPhotoHybrid(
    file: File,
    metadata: {
      title: string;
      description?: string;
      category: PhotoCategory;
      usage: PhotoUsage[];
      uploadedBy: string;
      tags?: string[];
      isPrimary?: boolean;
    }
  ): Promise<Photo> {
    try {
      console.log('🔍 Starting local file storage upload...');

      // Send file to server for local storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description || '');
      formData.append('category', metadata.category);
      formData.append('usage', JSON.stringify(metadata.usage));
      formData.append('uploadedBy', metadata.uploadedBy);
      formData.append('tags', metadata.tags?.join(',') || '');
      formData.append('isPrimary', metadata.isPrimary ? 'true' : 'false');

      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Local storage upload error:', errorData);
        throw new Error(errorData.details || 'Local storage upload failed');
      }

      const result = await response.json();
      console.log('✅ Local file storage upload successful:', result.photo.id);

      return result.photo;

    } catch (error: any) {
      console.error('❌ Local file storage upload error:', error);
      throw new Error(`Local file storage upload failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get image dimensions from file
   */
  private static getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get all photos (only active photos)
   */
  static async getAllPhotos(): Promise<Photo[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Photo));
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw new Error('Failed to fetch photos');
    }
  }

  /**
   * Get photos by category
   */
  static async getPhotosByCategory(category: PhotoCategory): Promise<Photo[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Photo));
    } catch (error) {
      console.error('Error fetching photos by category:', error);
      throw new Error('Failed to fetch photos by category');
    }
  }

  /**
   * Get photos by usage
   */
  static async getPhotosByUsage(usage: PhotoUsage): Promise<Photo[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('usage', 'array-contains', usage),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Photo));
    } catch (error: any) {
      console.error('Error fetching photos by usage:', error);
      
      // If it's an index error, try a simpler query without ordering
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.log('Index not ready, trying simpler query...');
        try {
          const simpleQ = query(
            collection(db, COLLECTION_NAME),
            where('usage', 'array-contains', usage),
            where('isActive', '==', true),
            limit(10) // Limit results to avoid large queries
          );
          const simpleSnapshot = await getDocs(simpleQ);
          
          return simpleSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Photo));
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          return []; // Return empty array instead of throwing
        }
      }
      
      // For other errors, return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get primary photo for a category
   */
  static async getPrimaryPhoto(category: PhotoCategory): Promise<Photo | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('category', '==', category),
        where('isPrimary', '==', true),
        where('isActive', '==', true),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as Photo;
    } catch (error) {
      console.error('Error fetching primary photo:', error);
      throw new Error('Failed to fetch primary photo');
    }
  }

  /**
   * Get random photos for backgrounds/banners
   */
  static async getRandomPhotos(usage: PhotoUsage, count: number = 5): Promise<Photo[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('usage', 'array-contains', usage),
        where('isActive', '==', true),
        limit(count * 2) // Get more than needed to randomize
      );
      const querySnapshot = await getDocs(q);
      
      const photos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Photo));
      
      // Shuffle and return requested count
      const shuffled = photos.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    } catch (error: any) {
      console.error('Error fetching random photos:', error);
      
      // If it's an index error, try a simpler query
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.log('Index not ready for random photos, trying simpler query...');
        try {
          const simpleQ = query(
            collection(db, COLLECTION_NAME),
            where('usage', 'array-contains', usage),
            where('isActive', '==', true),
            limit(count)
          );
          const simpleSnapshot = await getDocs(simpleQ);
          
          return simpleSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Photo));
        } catch (fallbackError) {
          console.error('Fallback random photos query failed:', fallbackError);
          return [];
        }
      }
      
      // For other errors, return empty array
      return [];
    }
  }

  /**
   * Update photo metadata
   */
  static async updatePhoto(id: string, updates: Partial<Omit<Photo, 'id' | 'uploadedAt' | 'url' | 'fileName'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating photo:', error);
      throw new Error('Failed to update photo');
    }
  }

  /**
   * Set photo as primary (and unset others in the same category)
   */
  static async setPrimaryPhoto(id: string, category: PhotoCategory): Promise<void> {
    try {
      // First, unset all primary photos in this category
      const q = query(
        collection(db, COLLECTION_NAME),
        where('category', '==', category),
        where('isPrimary', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const batch = [];
      for (const docSnapshot of querySnapshot.docs) {
        batch.push(updateDoc(doc(db, COLLECTION_NAME, docSnapshot.id), { isPrimary: false }));
      }
      
      // Wait for all updates to complete
      await Promise.all(batch);
      
      // Set the new primary photo
      await this.updatePhoto(id, { isPrimary: true });
    } catch (error) {
      console.error('Error setting primary photo:', error);
      throw new Error('Failed to set primary photo');
    }
  }

  /**
   * Delete photo (soft delete - mark as inactive)
   */
  static async deletePhoto(id: string): Promise<void> {
    try {
      await this.updatePhoto(id, { isActive: false });
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error('Failed to delete photo');
    }
  }

  /**
   * Permanently delete photo from storage and database
   */
  static async permanentlyDeletePhoto(id: string): Promise<void> {
    try {
      // Get photo data first
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Photo not found');
      }
      
      const photo = docSnap.data() as Photo;
      
      // Check if photo is stored in Cloudinary or Firebase Storage
      if (photo.url?.includes('cloudinary.com')) {
        console.log('🗑️ Deleting from Cloudinary...');
        // Delete from Cloudinary via API route
        try {
          const response = await fetch('/api/delete-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoUrl: photo.url, photoId: id })
          });
          
          if (!response.ok) {
            console.warn('⚠️ Cloudinary deletion failed, continuing with Firestore deletion');
          } else {
            console.log('✅ Cloudinary deletion successful');
          }
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary deletion error:', cloudinaryError);
          // Continue with Firestore deletion even if Cloudinary fails
        }
      } else {
        console.log('🗑️ Deleting from Firebase Storage...');
        // Delete from Firebase Storage
        try {
          const storageRef = ref(storage, `${STORAGE_PATH}/${photo.category}/${photo.fileName}`);
          await deleteObject(storageRef);
          console.log('✅ Firebase Storage deletion successful');
        } catch (storageError) {
          console.warn('⚠️ Firebase Storage deletion failed:', storageError);
          // Continue with Firestore deletion
        }
      }
      
      // Delete from Firestore
      await deleteDoc(docRef);
      console.log('✅ Photo permanently deleted from database');
    } catch (error) {
      console.error('Error permanently deleting photo:', error);
      throw new Error('Failed to permanently delete photo');
    }
  }

  /**
   * Search photos by title, description, or tags
   */
  static async searchPhotos(searchTerm: string): Promise<Photo[]> {
    try {
      // Note: Firestore doesn't support full-text search natively
      // This is a basic implementation - for production, consider using Algolia or similar
      const allPhotos = await this.getAllPhotos();
      
      const searchLower = searchTerm.toLowerCase();
      return allPhotos.filter(photo => 
        photo.isActive && (
          photo.title.toLowerCase().includes(searchLower) ||
          photo.description?.toLowerCase().includes(searchLower) ||
          photo.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        )
      );
    } catch (error) {
      console.error('Error searching photos:', error);
      throw new Error('Failed to search photos');
    }
  }

  /**
   * Get photo by ID
   */
  static async getPhotoById(id: string): Promise<Photo | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Photo;
    } catch (error) {
      console.error('Error fetching photo by ID:', error);
      throw new Error('Failed to fetch photo');
    }
  }
} 