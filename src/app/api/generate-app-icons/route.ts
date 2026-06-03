import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { pushNotificationIconService } from '@/lib/services/push-notification-icon.service';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

interface IconConfig {
  size: number;
  name: string;
  description: string;
  directory?: string;
}

const iconConfigs: IconConfig[] = [
  // PWA Icons in public root
  { size: 192, name: 'icon-192.png', description: 'PWA Icon 192x192' },
  { size: 512, name: 'icon-512.png', description: 'PWA Icon 512x512' },
  
  // Icons in public/icons folder
  { size: 72, name: 'badge-72x72.png', description: 'Badge Icon 72x72', directory: 'icons' },
  { size: 192, name: 'icon-192x192.png', description: 'Icon 192x192', directory: 'icons' },
  { size: 512, name: 'icon-512x512.png', description: 'Icon 512x512', directory: 'icons' },
  
  // Favicons
  { size: 16, name: 'favicon-16x16.png', description: 'Favicon 16x16' },
  { size: 32, name: 'favicon.png', description: 'Favicon 32x32' },
  
  // Apple Touch Icon
  { size: 180, name: 'apple-touch-icon.png', description: 'Apple Touch Icon 180x180' },
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('icon') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image (PNG, JPEG, or WebP)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate image can be processed
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }
      
      // Check minimum size
      if (metadata.width < 192 || metadata.height < 192) {
        return NextResponse.json(
          { error: 'Image must be at least 192x192 pixels. Current size: ' + metadata.width + 'x' + metadata.height },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or corrupted image file' },
        { status: 400 }
      );
    }

    const results: { success: boolean; description: string; path: string; error?: string }[] = [];

    // Save source image as "Budge C.png" in project root
    const rootPath = path.join(process.cwd(), 'Budge C.png');
    await writeFile(rootPath, buffer);
    results.push({
      success: true,
      description: 'Source Logo',
      path: 'Budge C.png',
    });

    // Generate all icon sizes
    for (const config of iconConfigs) {
      try {
        const outputDir = config.directory 
          ? path.join(process.cwd(), 'public', config.directory)
          : path.join(process.cwd(), 'public');

        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, config.name);

        // Generate icon with proper sizing and background
        await sharp(buffer)
          .resize(config.size, config.size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .png()
          .toFile(outputPath);

        results.push({
          success: true,
          description: config.description,
          path: config.directory ? `public/${config.directory}/${config.name}` : `public/${config.name}`,
        });
      } catch (error) {
        results.push({
          success: false,
          description: config.description,
          path: config.directory ? `public/${config.directory}/${config.name}` : `public/${config.name}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Copy favicon.png to favicon.ico
    try {
      const faviconSource = path.join(process.cwd(), 'public', 'favicon.png');
      const faviconDest = path.join(process.cwd(), 'public', 'favicon.ico');
      const faviconBuffer = fs.readFileSync(faviconSource);
      await writeFile(faviconDest, faviconBuffer);
      results.push({
        success: true,
        description: 'Favicon ICO',
        path: 'public/favicon.ico',
      });
    } catch (error) {
      results.push({
        success: false,
        description: 'Favicon ICO',
        path: 'public/favicon.ico',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Copy icons to Next.js app directory
    const appIconsToCopy = [
      { src: 'favicon.ico', dest: 'favicon.ico', name: 'App Favicon ICO' },
      { src: 'apple-touch-icon.png', dest: 'apple-touch-icon.png', name: 'App Apple Touch Icon' },
      { src: 'icon-192.png', dest: 'icon.png', name: 'App Icon' },
    ];

    const appDir = path.join(process.cwd(), 'src', 'app');

    for (const { src, dest, name } of appIconsToCopy) {
      try {
        const srcPath = path.join(process.cwd(), 'public', src);
        const destPath = path.join(appDir, dest);
        const iconBuffer = fs.readFileSync(srcPath);
        await writeFile(destPath, iconBuffer);
        results.push({
          success: true,
          description: name,
          path: `src/app/${dest}`,
        });
      } catch (error) {
        results.push({
          success: false,
          description: name,
          path: `src/app/${dest}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // 🔔 CRITICAL: Update push notification icon in settings
    // This ensures push notifications use the new app icon
    try {
      await pushNotificationIconService.updatePushIcon('/icons/icon-192x192.png');
      console.log('✅ Push notification icon updated to use new app icon');
    } catch (error) {
      console.error('⚠️ Failed to update push notification icon setting:', error);
      // Don't fail the entire request if this update fails
    }

    return NextResponse.json({
      success: failCount === 0,
      message: failCount === 0
        ? `Successfully generated all ${successCount} app icons! Push notification icon updated.`
        : `Generated ${successCount} icons, ${failCount} failed.`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error('Error generating app icons:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate app icons',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

