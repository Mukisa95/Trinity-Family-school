import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { photoUrl, photoId } = await request.json();

    if (!photoUrl) {
      return NextResponse.json({ error: 'Photo URL is required' }, { status: 400 });
    }

    console.log('🗑️ Deleting photo from Cloudinary:', photoId);

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456789/folder/file.jpg
    const urlParts = photoUrl.split('/upload/');
    if (urlParts.length < 2) {
      console.error('❌ Invalid Cloudinary URL format');
      return NextResponse.json({ error: 'Invalid Cloudinary URL' }, { status: 400 });
    }

    // Get the path after /upload/ and remove version number and extension
    let publicId = urlParts[1].split('?')[0]; // Remove query params
    publicId = publicId.replace(/^v\d+\//, ''); // Remove version prefix (v123456789/)
    publicId = publicId.replace(/\.[^/.]+$/, ''); // Remove file extension

    console.log('🔍 Extracted public_id:', publicId);

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true, // Invalidate CDN cache
    });

    console.log('📊 Cloudinary deletion result:', result);

    if (result.result === 'ok' || result.result === 'not found') {
      return NextResponse.json({ 
        success: true, 
        message: 'Photo deleted from Cloudinary',
        result: result.result 
      });
    } else {
      console.error('❌ Cloudinary deletion failed:', result);
      return NextResponse.json({ 
        error: 'Failed to delete from Cloudinary', 
        details: result 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Delete failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

