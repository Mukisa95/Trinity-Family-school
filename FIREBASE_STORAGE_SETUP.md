# Firebase Storage Setup Instructions

## Issue
You're getting a "User does not have permission to access" error when uploading photos because Firebase Storage rules require proper authentication.

## Solution Options

### Option 1: Update Firebase Storage Rules (Recommended for Development)

1. Go to your Firebase Console: https://console.firebase.google.com/
2. Select your project: `trinity-family-schools`
3. Navigate to **Storage** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with the following:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to all files
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Allow write access to school-photos directory
    // This is permissive for development - tighten for production
    match /school-photos/{allPaths=**} {
      allow write: if true; // Allow all writes for now
      allow delete: if true; // Allow all deletes for now
    }
  }
}
```

6. Click **Publish** to save the rules

### Option 2: Production-Ready Rules (For Later)

When you're ready for production, use these more secure rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow public read access to all files
    match /{allPaths=**} {
      allow read: if true;
    }
    
    // Secure write access to school-photos directory
    match /school-photos/{allPaths=**} {
      allow write: if request.auth != null 
        && request.resource.size < 10 * 1024 * 1024 // 10MB limit
        && request.resource.contentType.matches('image/.*'); // Only images
      allow delete: if request.auth != null;
    }
  }
}
```

## What the Code Changes Do

I've also updated the code to handle Firebase Authentication:

1. **Created `src/lib/firebase-auth.ts`**: Handles Firebase Authentication using anonymous sign-in
2. **Updated `src/lib/services/photos.service.ts`**: Now ensures Firebase authentication before uploads
3. **Updated `src/lib/contexts/auth-context.tsx`**: Initializes Firebase Auth alongside custom auth

## How It Works

1. When a user tries to upload a photo, the system automatically signs them in anonymously to Firebase
2. This provides the necessary authentication for Firebase Storage operations
3. The anonymous authentication works alongside your existing custom authentication system
4. No changes needed to your existing login flow

## Testing

After updating the Firebase Storage rules:

1. Try uploading a photo through the Photos Manager
2. The upload should now work without permission errors
3. Check the Firebase Storage console to see the uploaded files

## Security Notes

- The current rules are permissive for development
- For production, implement the more restrictive rules in Option 2
- Consider implementing proper Firebase Authentication for enhanced security
- Monitor your Firebase Storage usage to prevent abuse

## Troubleshooting

If you still get permission errors:

1. Make sure you've published the new rules in Firebase Console
2. Wait a few minutes for the rules to propagate
3. Clear your browser cache and try again
4. Check the browser console for any additional error messages 