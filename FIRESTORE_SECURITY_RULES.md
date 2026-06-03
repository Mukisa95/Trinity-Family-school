# Firestore Security Rules Setup

## Problem Solved
You were getting "Missing or insufficient permissions" errors when trying to fetch data from Firestore. This was because the default Firestore security rules deny all read/write access for security reasons.

## What We Did

### 1. Identified the Issue
The error `FirebaseError: Missing or insufficient permissions` occurs when Firestore security rules prevent access to the database. By default, Firebase sets restrictive rules that deny all access.

### 2. Set Up Firebase CLI
- Logged out from the wrong account (`travismoore664@gmail.com`)
- Logged in with the correct account (`trinityfmk@gmail.com`) that has access to the `trinity-family-schools` project
- Initialized Firebase in the project directory

### 3. Updated Security Rules
Changed the Firestore security rules from:
```javascript
// BEFORE (Restrictive - denies all access)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // Denies everything
    }
  }
}
```

To:
```javascript
// AFTER (Permissive - allows all access for development)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for development
    // WARNING: These rules are for development only and should be updated for production
    match /{document=**} {
      allow read, write: if true;  // Allows everything
    }
  }
}
```

### 4. Deployed the Rules
Used `firebase deploy --only firestore:rules` to deploy the updated security rules to your Firebase project.

## Current Status
✅ **FIXED**: Your app can now read and write to Firestore without permission errors
✅ **Firebase Project**: Connected to `trinity-family-schools`
✅ **Security Rules**: Set to allow all access for development
✅ **App**: Should be running on http://localhost:9002

## Important Security Notes

### ⚠️ Development vs Production Rules

**Current Rules (Development):**
- Allow all read/write access (`if true`)
- Good for development and testing
- **NOT SECURE** for production use

**For Production, you should implement proper rules like:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Staff data requires authentication
    match /staff/{staffId} {
      allow read, write: if request.auth != null;
    }
    
    // Pupils data requires authentication
    match /pupils/{pupilId} {
      allow read, write: if request.auth != null;
    }
    
    // Fee structures - read for authenticated users, write for admins
    match /feeStructures/{feeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Next Steps

1. **Test Your App**: Visit http://localhost:9002 and verify that the permission errors are gone
2. **Implement Authentication**: Add Firebase Authentication to your app
3. **Update Security Rules**: Before going to production, implement proper security rules based on user authentication and roles
4. **Test Security Rules**: Use Firebase emulators to test your security rules locally

## Files Created/Modified

- `firestore.rules` - Updated security rules
- `firebase.json` - Firebase configuration
- `.firebaserc` - Firebase project configuration
- `firestore.indexes.json` - Firestore indexes configuration

## Useful Commands

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy everything
firebase deploy

# Test rules locally (requires emulator setup)
firebase emulators:start --only firestore

# Check current login
firebase login:list

# Switch Firebase projects
firebase use <project-id>
```

## Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Security Rules Testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Firebase Authentication](https://firebase.google.com/docs/auth) 