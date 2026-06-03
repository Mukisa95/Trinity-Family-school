# Firebase Integration Setup

This application has been integrated with Firebase for data persistence. Here's how to set it up:

## 1. Firebase Configuration

### For Development (Using Emulators)
The app is configured to use Firebase emulators in development mode. No additional setup is required for local development.

### For Production
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Enable Authentication (optional)
4. Get your Firebase config from Project Settings
5. Create a `.env.local` file with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

## 2. Running with Firebase Emulators

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Start the emulators: `firebase emulators:start`
3. Run the development server: `npm run dev`

The emulators will run on:
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- Emulator UI: http://localhost:4000

## 3. Data Migration

To populate the database with sample data:

1. Go to the Admin Panel at http://localhost:9002/admin
2. Click "Migrate Sample Data"

Or run the migration script directly:
```bash
npm run migrate
```

## 4. Features Integrated

- ✅ Staff Management (CRUD operations)
- ✅ Fee Structures (CRUD operations)
- ✅ School Settings
- ✅ Data Migration Utility
- 🔄 Pupils Management (service created, UI needs update)
- 🔄 Other modules (to be integrated)

## 5. Database Structure

The app uses the following Firestore collections:
- `staff` - Staff member records
- `pupils` - Student records
- `feeStructures` - Fee structure definitions
- `feeAdjustments` - Fee adjustments
- `settings` - School settings (single document)

## 6. Next Steps

1. Update remaining pages to use Firebase services
2. Implement authentication
3. Add data validation and security rules
4. Optimize queries and add pagination
5. Add real-time updates using Firestore listeners 