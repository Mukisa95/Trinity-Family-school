# Deploy Pupil Filtering Indexes

## Quick Start

To deploy the new Firestore indexes required for optimized pupil filtering, run:

```bash
firebase deploy --only firestore:indexes
```

## What Gets Deployed

The following indexes will be created in your Firestore database:

### 1. Pupils by Status + Last Name
Enables: Fetching pupils by status (Active, Inactive, Graduated) ordered by last name
```
Collection: pupils
Fields: status (Ascending), lastName (Ascending)
```

### 2. Pupils by Class + Status
Enables: Fetching pupils by class and status simultaneously
```
Collection: pupils
Fields: classId (Ascending), status (Ascending)
```

## Build Time

- Indexes typically take **2-5 minutes** to build
- You can monitor progress in the Firebase Console
- The app will still work during index creation (falls back to client-side filtering)

## Verification

After deployment, verify the indexes are ready:

1. Go to Firebase Console → Firestore Database → Indexes
2. Look for the new "pupils" indexes
3. Status should show "Enabled" (not "Building")

## Alternative: Manual Creation

If you prefer to create indexes manually via Firebase Console:

### Index 1: Pupils by Status
1. Go to Firebase Console → Firestore → Indexes
2. Click "Create Index"
3. Select collection: `pupils`
4. Add field: `status` → Ascending
5. Add field: `lastName` → Ascending
6. Click "Create"

### Index 2: Pupils by Class and Status
1. Click "Create Index"
2. Select collection: `pupils`
3. Add field: `classId` → Ascending
4. Add field: `status` → Ascending
5. Click "Create"

## Testing

After indexes are built, verify optimization is working:

1. Open the app in a browser
2. Open DevTools → Console
3. Navigate to Dashboard
4. Look for: `🎯 Fetching ONLY active pupils from database (optimized)`
5. Check Network tab for Firestore requests with `where` clauses

## Rollback

If you need to remove these indexes:

```bash
# Remove the index entries from firestore.indexes.json
# Then deploy:
firebase deploy --only firestore:indexes
```

Or delete them manually in Firebase Console.

## Cost Impact

These indexes will:
- ✅ **Reduce** Firestore read operations (lower costs)
- ✅ **Improve** performance significantly
- ⚠️ Use minimal additional storage for the indexes
- ⚠️ Count toward your project's index limit (200 composite indexes per database)

Net effect: **Cost savings** due to fewer document reads!

