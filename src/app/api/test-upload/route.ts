import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 TEST API ROUTE HIT: /api/test-upload');
  return NextResponse.json({ message: 'Test API route working!' });
}

export async function POST(request: NextRequest) {
  console.log('🧪 TEST API POST ROUTE HIT: /api/test-upload');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    console.log('🧪 Test file received:', file?.name, 'Size:', file?.size);
    
    return NextResponse.json({ 
      success: true, 
      fileName: file?.name,
      fileSize: file?.size 
    });
  } catch (error: any) {
    console.error('🧪 Test API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 