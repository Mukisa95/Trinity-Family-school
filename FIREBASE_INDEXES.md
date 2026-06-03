# Firebase Indexes Required for Dynamic Discounts

## Overview
The dynamic discounts feature requires Firebase composite indexes for optimal performance. While the app now works without them (by sorting on client-side), creating these indexes will improve query performance, especially as your discount database grows.

## Required Indexes

### 1. Dynamic Discounts Collection - Active Discounts Query
**Collection:** `dynamicDiscounts`
**Fields:**
- `isActive` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending) - automatically added

**Index Creation URL:**
```
https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=Cl9wcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9keW5hbWljRGlzY291bnRzL2luZGV4ZXMvXxABGgwKCGlzQWN0aXZlEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg
```

### 2. Dynamic Discounts Collection - All Discounts Query (Optional)
**Collection:** `dynamicDiscounts`
**Fields:**
- `createdAt` (Descending)
- `__name__` (Ascending) - automatically added

## How to Create Indexes

### Option 1: Click the Auto-Generated Link
When you see the Firebase error in the console, click the provided link. It will take you directly to the Firebase Console with the index pre-configured.

### Option 2: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `trinity-family-schools`
3. Navigate to Firestore Database
4. Click on "Indexes" tab
5. Click "Create Index"
6. Set up the index with the fields listed above

### Option 3: Using Firebase CLI
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy indexes (if you have a firestore.indexes.json file)
firebase deploy --only firestore:rules,firestore:indexes
```

## Performance Impact

### Without Indexes (Current State)
- ✅ App works correctly
- ⚠️ Queries fetch all documents and sort on client
- ⚠️ Slower performance as data grows
- ⚠️ Higher bandwidth usage

### With Indexes (Recommended)
- ✅ Optimal query performance
- ✅ Server-side sorting and filtering
- ✅ Minimal bandwidth usage
- ✅ Scalable for large datasets

## Index Status Check
You can check if indexes are created and active in the Firebase Console:
1. Go to Firestore Database → Indexes
2. Look for indexes on the `dynamicDiscounts` collection
3. Status should show "Enabled" (not "Building" or "Error")

## Note
The app is designed to work both with and without these indexes, so you can create them at any time without affecting functionality. 