# Cloudinary Photo Storage Setup

## Why Cloudinary?

Firebase Storage was causing CORS issues and bucket configuration problems. Cloudinary is a reliable, free alternative specifically designed for image management.

## Free Tier Benefits
- **25GB** storage
- **25GB** bandwidth per month
- **Automatic image optimization**
- **CDN delivery**
- **Image transformations**

## Quick Setup

### 1. Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email

### 2. Get Your Credentials
1. Go to your Cloudinary Dashboard
2. Copy these values:
   - **Cloud Name**
   - **API Key** 
   - **API Secret**

### 3. Add to Environment Variables
Add these lines to your `.env.local` file:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

### 4. Restart Your Development Server
```bash
npm run dev
```

## How It Works

- **Primary**: Tries Cloudinary upload first (if configured)
- **Fallback**: Uses local storage if Cloudinary fails or isn't configured
- **Automatic**: No code changes needed - works immediately after setup

## Features

✅ **Reliable uploads** - No CORS issues
✅ **Free 25GB storage** - Much more than Firebase free tier
✅ **Automatic optimization** - Images are compressed automatically
✅ **Fast CDN delivery** - Images load faster worldwide
✅ **Local fallback** - Always works even without internet
✅ **Database integration** - Metadata still saved to Firestore

## Testing

After setup, upload a photo in the admin panel. Check the console logs:
- `✅ Cloudinary upload successful` = Working perfectly
- `🚀 Attempting local storage upload...` = Fallback mode (still works)

## Support

If you have issues:
1. Double-check your environment variables
2. Restart the development server
3. Check the browser console for error messages
4. The system will always fall back to local storage if needed 