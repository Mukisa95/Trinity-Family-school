import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PhotoCategory, PhotoUsage } from '@/types';

const STORAGE_PATH = 'school-photos';
const COLLECTION_NAME = 'photos';

// Get environment-specific folder prefix
// This allows dev and production to have separate folders in Cloudinary
const CLOUDINARY_FOLDER_PREFIX = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || 'production';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Photo upload started with Cloudinary + Local fallback');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string || 'other';
    const title = formData.get('title') as string || '';
    const description = formData.get('description') as string || '';
    const usage = JSON.parse(formData.get('usage') as string) as PhotoUsage[];
    const uploadedBy = formData.get('uploadedBy') as string;
    const tags = formData.get('tags') as string;
    const isPrimary = formData.get('isPrimary') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`🔍 File received: ${file.name} Size: ${file.size} Type: ${file.type}`);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let photoUrl = '';
    let storageType = 'local';
    let uploadResult: any = null;
    
    // Try Cloudinary first if configured
    if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        console.log('🚀 Attempting Cloudinary upload...');
        
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const folderPath = `${CLOUDINARY_FOLDER_PREFIX}/school-photos/${category}`;
        const publicId = `${folderPath}/${fileName.replace(/\.[^/.]+$/, '')}`;
        
        console.log(`📁 Cloudinary folder: ${folderPath}`);
        
        // Upload to Cloudinary with compression and optimization
        uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              folder: folderPath,
              resource_type: 'image',
              quality: 'auto:low', // Aggressive compression while maintaining quality
              fetch_format: 'auto', // Auto-select best format (WebP, AVIF)
              transformation: [
                {
                  width: 1920, // Max width
                  height: 1920, // Max height
                  crop: 'limit', // Only scale down if larger
                  quality: 'auto:eco', // Balanced quality/size ratio
                  fetch_format: 'auto'
                }
              ],
              eager: [
                {
                  width: 1920,
                  height: 1920,
                  crop: 'limit',
                  quality: 'auto:eco',
                  fetch_format: 'auto'
                }
              ],
              eager_async: false // Generate optimized version immediately
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(buffer);
        });
        
        // Log original and compressed sizes
        const originalSize = file.size;
        const compressedSize = (uploadResult as any).bytes || 0;
        const compressionRatio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(2) : '0';
        console.log(`📊 Compression: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`);

        photoUrl = (uploadResult as any).secure_url;
        storageType = 'cloudinary';
        console.log('✅ Cloudinary upload successful');
        console.log(`🔍 Cloudinary URL: ${photoUrl}`);
        
      } catch (cloudinaryError) {
        console.log('❌ Cloudinary failed:', (cloudinaryError as Error).message);
        console.log('🚀 Attempting local storage upload...');
        
        // Fallback to local storage
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'photos', category);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          console.log(`🔍 Created directory: ${uploadsDir}`);
        }
        
        const filePath = path.join(uploadsDir, fileName);
        console.log(`🔍 Saving to local path: ${filePath}`);
        
        // Save file
        fs.writeFileSync(filePath, buffer);
        console.log('✅ File saved successfully to local storage');
        
        photoUrl = `/uploads/photos/${category}/${fileName}`;
        storageType = 'local';
        console.log(`🔍 Local storage URL: ${photoUrl}`);
      }
    } else {
      console.log('🚀 Cloudinary not configured, using local storage...');
      
      // Use local storage
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'photos', category);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`🔍 Created directory: ${uploadsDir}`);
      }
      
      const filePath = path.join(uploadsDir, fileName);
      console.log(`🔍 Saving to local path: ${filePath}`);
      
      // Save file
      fs.writeFileSync(filePath, buffer);
      console.log('✅ File saved successfully to local storage');
      
      photoUrl = `/uploads/photos/${category}/${fileName}`;
      storageType = 'local';
      console.log(`🔍 Local storage URL: ${photoUrl}`);
    }

    console.log(`✅ ${storageType === 'cloudinary' ? 'Cloudinary' : 'Local storage fallback'} successful`);

    // Save metadata to database
    const photoData = {
      title: title || file.name,
      description,
      category,
      usage,
      url: photoUrl,
      fileName: file.name,
      fileSize: storageType === 'cloudinary' ? ((uploadResult as any)?.bytes || file.size) : file.size,
      originalSize: file.size, // Keep track of original size
      isActive: true,
      isPrimary: isPrimary || false,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      tags: tags.split(',').map((tag: string) => tag.trim()).filter(Boolean),
      storageType // Track which storage method was used
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), photoData);
    console.log(`✅ Photo metadata saved to database with ID: ${docRef.id}`);

    return NextResponse.json({
      success: true,
      photo: {
        id: docRef.id,
        ...photoData
      },
      storageType
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: (error as Error).message },
      { status: 500 }
    );
  }
} 