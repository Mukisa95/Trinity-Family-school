# Firebase Storage CORS Configuration Fix

## Problem
The photo upload is failing because Firebase Storage is not configured to allow cross-origin requests from your application domain. The upload fails at the `uploadBytes()` step with CORS errors.

## Solution
Configure Firebase Storage CORS settings to allow uploads from your application.

### Method 1: Using Google Cloud Console (Recommended)

1. **Open Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project**: trinity-family-schools
3. **Navigate to Cloud Storage**: Go to "Cloud Storage" > "Buckets"
4. **Find your bucket**: trinity-family-schools.appspot.com
5. **Configure CORS**:
   - Click on the bucket name
   - Go to the "Permissions" tab
   - Click "Edit CORS configuration"
   - Replace the existing configuration with:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "x-goog-resumable"]
  }
]
```

6. **Save the configuration**

### Method 2: Using gsutil Command Line (Alternative)

If you have Google Cloud SDK installed:

```bash
gsutil cors set firebase-storage-cors.json gs://trinity-family-schools.appspot.com
```

### Method 3: More Restrictive CORS (Production Ready)

For production, use a more restrictive CORS configuration:

```json
[
  {
    "origin": [
      "http://localhost:3000",
      "http://localhost:9004", 
      "https://trinity-family-schools.firebaseapp.com",
      "https://trinity-family-schools.web.app",
      "https://your-custom-domain.com"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "x-goog-resumable"]
  }
]
```

## Testing After Configuration

1. **Wait 5-10 minutes** for the CORS configuration to propagate
2. **Try uploading a photo** - you should now see the complete debug output:
   - 🔍 Upload completed successfully
   - 🔍 Getting download URL...
   - 🔍 Raw URL from Firebase SDK: [proper URL]
   - ✅ URL format looks correct

## Expected Behavior After Fix

- Photo uploads should work without CORS errors
- You should see proper Firebase Storage URLs in the format:
  `https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Ffile.jpg?alt=media&token=...`
- Images should display correctly in the application

## Additional Notes

- The current malformed URLs in your database are likely from previous failed uploads
- Once CORS is fixed, new uploads will generate proper URLs
- The runtime URL sanitization we implemented will continue to fix display of any remaining malformed URLs 