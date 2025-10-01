import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PhotoCategory, PhotoUsage } from '@/types';

const STORAGE_PATH = 'school-photos';
const COLLECTION_NAME = 'photos';

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
    
    // Try Cloudinary first if configured
    if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        console.log('🚀 Attempting Cloudinary upload...');
        
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const publicId = `school-photos/${category}/${fileName.replace(/\.[^/.]+$/, '')}`;
        
        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              folder: `school-photos/${category}`,
              resource_type: 'image',
              quality: 'auto',
              fetch_format: 'auto'
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(buffer);
        });

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
      fileSize: file.size,
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