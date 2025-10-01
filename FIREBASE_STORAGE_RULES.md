# Firebase Storage Rules for Photo Upload

To enable photo uploads to Firebase Storage, please update your Firebase Storage rules:

## 1. Go to Firebase Console
- Visit https://console.firebase.google.com
- Select your project: `trinity-family-schools`
- Go to Storage > Rules

## 2. Update Storage Rules
Replace the existing rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow read access to all files
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Allow write access to school-photos directory
    match /school-photos/{category}/{fileName} {
      allow write: if true;
    }
    
    // Allow write access to uploads directory (backup)
    match /uploads/{allPaths=**} {
      allow write: if true;
    }
  }
}
```

## 3. Publish Rules
- Click "Publish" to apply the new rules

## Alternative: More Secure Rules (Optional)
If you want more security, you can use these rules instead:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow read access to all files
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Allow authenticated users to upload to school-photos
    match /school-photos/{category}/{fileName} {
      allow write: if request.auth != null
        && resource == null  // Only allow new file creation
        && request.resource.size < 10 * 1024 * 1024  // Max 10MB
        && request.resource.contentType.matches('image/.*');  // Only images
    }
  }
}
```

## Current Implementation
The upload API now uses:
- Firebase Client SDK (not Admin SDK) to avoid credential issues
- Anonymous authentication for server-side uploads
- Proper error handling and CORS management
- Direct Firebase Storage upload with download URL generation

## Testing
After updating the rules, try uploading a photo through the admin panel at `/admin/photos`. 