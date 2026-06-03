# Firebase Security Rules Guide

This guide explains the security rules for your School Management System and how to deploy them to both development and production environments.

---

## **📋 Overview**

Two sets of security rules have been created:
1. **`firestore.rules`** - Database security rules
2. **`storage.rules`** - File storage security rules

---

## **🔒 Security Model**

### **Role-Based Access Control (RBAC)**

The system has 3 user roles:
1. **Admin** - Full access to everything
2. **Staff** - Module-based access (configurable per user)
3. **Parent** - Read-only access to their children's data

### **Module-Based Permissions**

Staff members are granted access to specific modules:
- `pupils` - Pupil management
- `staff` - Staff management
- `classes` - Class management
- `subjects` - Subject management
- `fees` - Fee management
- `banking` - Banking operations
- `exams` - Exam management
- `events` - Event management
- `attendance` - Attendance tracking
- `academic_years` - Academic year management
- `users` - User management
- `bulk_sms` - SMS messaging
- `notifications` - Notification management
- `procurement` - Procurement management
- `duty_service` - Duty assignments
- `requirements` - Requirements tracking
- `uniforms` - Uniform management
- `settings` - System settings

---

## **🗄️ Firestore Rules Breakdown**

### **Core Collections**

#### **School Settings**
```
✅ Read: All authenticated users
❌ Write: Admin only
```

#### **Users**
```
✅ Read: Admin + Own profile
✅ Create: Admin only
✅ Update: Admin + Own profile (limited fields)
❌ Delete: Admin only
```

#### **Pupils**
```
✅ Read: Admin + Staff (pupils module) + Parents (own children)
✅ Write: Staff (pupils module) + Admin
❌ Delete: Admin only
```

#### **Families**
```
✅ Read: Admin + Staff (pupils module) + Parents (own family)
✅ Write: Staff (pupils module) + Admin
```

#### **Payment Records**
```
✅ Read: Admin + Staff (fees module) + Parents (own payments)
✅ Create/Update: Staff (fees module) + Admin
❌ Delete: Admin only
```

#### **Notifications**
```
✅ Read: Recipient users + Admin
✅ Create: Staff (notifications module) + Admin
✅ Update: Recipients (mark as read only) + Admin
❌ Delete: Admin only
```

### **Parent-Specific Access**

Parents can only access data related to their children through `familyId` matching:
- Pupil information
- Fee records and payments
- Exam results
- Requirement tracking
- Uniform tracking
- Family account information

### **Activity Logs**

```
✅ Read: Admin only
✅ Create: All authenticated users
❌ Update/Delete: Nobody (immutable logs)
```

---

## **📁 Storage Rules Breakdown**

### **File Size Limits**
- **Images**: Max 10MB
- **Documents**: Max 20MB

### **Pupil Files**

#### **Photos**
```
✅ Read: All authenticated users
✅ Write: Staff (pupils module) + Admin
✅ Delete: Staff (pupils module) + Admin
📏 Max size: 10MB, must be image
```

#### **Documents**
```
✅ Read: Staff (pupils module) + Admin + Parents (own children)
✅ Write: Staff (pupils module) + Admin
✅ Delete: Staff (pupils module) + Admin
📏 Max size: 20MB
```

### **Staff Files**

#### **Photos**
```
✅ Read: All authenticated users
✅ Write: Staff (own photo) + Staff (staff module) + Admin
❌ Delete: Admin only
📏 Max size: 10MB, must be image
```

#### **Documents**
```
✅ Read: Owner + Admin
✅ Write: Owner + Staff (staff module) + Admin
❌ Delete: Admin only
📏 Max size: 20MB
```

### **Digital Signatures**
```
✅ Read: Owner + Admin
✅ Write: Owner only
✅ Delete: Owner + Admin
📏 Max size: 10MB, must be image
```

### **Payment Receipts & Statements**
```
✅ Read: Staff (fees module) + Admin + Parents (own family)
✅ Write: Staff (fees module) + Admin
❌ Delete: Admin only
📏 Max size: 20MB, must be PDF
```

---

## **🚀 Deploying Security Rules**

### **Method 1: Firebase Console (Manual)**

#### **Firestore Rules**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database** → **Rules**
4. Copy contents of `firestore.rules`
5. Paste into the editor
6. Click **Publish**

#### **Storage Rules**
1. Go to **Storage** → **Rules**
2. Copy contents of `storage.rules`
3. Paste into the editor
4. Click **Publish**

### **Method 2: Firebase CLI (Recommended)**

#### **Setup**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not already done)
firebase init
# Select: Firestore, Storage
# Use existing rules files: firestore.rules, storage.rules
```

#### **Deploy to Development**
```bash
# Switch to development project
firebase use development

# Deploy rules only
firebase deploy --only firestore:rules,storage:rules

# Or deploy everything
firebase deploy
```

#### **Deploy to Production**
```bash
# Switch to production project
firebase use production

# Deploy rules only
firebase deploy --only firestore:rules,storage:rules
```

### **Method 3: Automated Deployment**

Add to your `package.json`:
```json
{
  "scripts": {
    "deploy:rules:dev": "firebase use development && firebase deploy --only firestore:rules,storage:rules",
    "deploy:rules:prod": "firebase use production && firebase deploy --only firestore:rules,storage:rules"
  }
}
```

Then run:
```bash
# Deploy to development
npm run deploy:rules:dev

# Deploy to production
npm run deploy:rules:prod
```

---

## **🧪 Testing Security Rules**

### **Firestore Rules Testing**

Firebase Console has a built-in simulator:
1. Go to **Firestore Database** → **Rules**
2. Click **Rules Playground** tab
3. Test scenarios:

```javascript
// Example: Test if staff can read pupils
Simulation Type: get
Location: /databases/(default)/documents/pupils/pupil123
Authenticated: Yes
Auth UID: staff-user-id
Firestore Data: 
  /users/staff-user-id: { role: 'Staff', modules: { pupils: true } }
```

### **Local Testing with Emulator**

```bash
# Install emulators
firebase init emulators
# Select: Firestore, Storage, Authentication

# Start emulators
firebase emulators:start

# Run your app against emulators
# Update .env.local to use emulator URLs
```

---

## **⚠️ Important Security Notes**

### **1. User Document Structure**

For rules to work, user documents must have:
```javascript
{
  role: 'Admin' | 'Staff' | 'Parent',
  modules: {
    pupils: true,
    fees: true,
    // ... other modules
  },
  familyId: 'family-id' // For parents
}
```

### **2. Pupil Document Structure**

Pupil documents must have:
```javascript
{
  familyId: 'family-id',
  // ... other fields
}
```

### **3. Rate Limiting**

Consider adding rate limiting for production:
```javascript
// In firestore.rules, add to specific collections
match /payments/{paymentId} {
  allow create: if hasModule('fees') && 
                   request.time > resource.data.lastPayment + duration.value(1, 's');
}
```

### **4. Data Validation**

Add data validation rules:
```javascript
match /pupils/{pupilId} {
  allow create: if hasModule('pupils') && 
                   request.resource.data.firstName is string &&
                   request.resource.data.firstName.size() > 0 &&
                   request.resource.data.firstName.size() < 50;
}
```

### **5. Audit Logging**

All sensitive operations should create audit logs:
```javascript
// Your application code should create logs
await addDoc(collection(db, 'activityLogs'), {
  userId: currentUser.uid,
  action: 'UPDATE_PUPIL',
  resourceId: pupilId,
  timestamp: serverTimestamp(),
  details: { ... }
});
```

---

## **🔧 Customization**

### **Adding New Collections**

When adding new collections, follow this pattern:

```javascript
match /newCollection/{documentId} {
  allow read: if isAuthenticated() && hasModule('module_name');
  allow create, update: if hasModule('module_name');
  allow delete: if isAdmin();
}
```

### **Adding New Modules**

1. Add module to user document:
```javascript
{
  modules: {
    new_module: true
  }
}
```

2. Update rules to check for module:
```javascript
allow write: if hasModule('new_module');
```

### **Custom Permissions**

For fine-grained control:
```javascript
function canEditPupil(pupilId) {
  return hasModule('pupils') && 
         get(/databases/$(database)/documents/pupils/$(pupilId)).data.classId 
         in getUserData().assignedClasses;
}
```

---

## **📊 Monitoring & Debugging**

### **View Security Rule Logs**

1. Go to Firebase Console
2. Click **Firestore Database** or **Storage**
3. Click **Usage** tab
4. Check **Denied requests**

### **Common Issues**

#### **"Missing or insufficient permissions"**
- Check user's role in Firestore
- Verify module permissions
- Ensure `familyId` matches for parents

#### **"Cannot read from undefined"**
- User document doesn't exist
- Missing required fields (`role`, `modules`)

#### **Storage: "User does not have permission"**
- Check file path matches rules
- Verify file type and size
- Ensure user has required module access

---

## **✅ Deployment Checklist**

Before deploying to production:

- [ ] Review all security rules
- [ ] Test with emulator
- [ ] Test in Firebase Console Rules Playground
- [ ] Verify user document structure
- [ ] Check file size limits are appropriate
- [ ] Add rate limiting for sensitive operations
- [ ] Set up Firebase budget alerts
- [ ] Enable audit logging
- [ ] Document any custom rules
- [ ] Deploy to development first
- [ ] Test thoroughly in development
- [ ] Deploy to production
- [ ] Monitor denied requests after deployment

---

## **🆘 Emergency Rollback**

If you need to rollback rules:

```bash
# View previous versions in Firebase Console
# Firestore Database → Rules → Previous versions

# Or restore from git
git checkout HEAD~1 firestore.rules storage.rules
firebase deploy --only firestore:rules,storage:rules
```

---

## **📚 Additional Resources**

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Security Rules Documentation](https://firebase.google.com/docs/storage/security)
- [Security Rules Unit Testing](https://firebase.google.com/docs/rules/unit-tests)
- [Common Security Rules Patterns](https://firebase.google.com/docs/firestore/security/rules-conditions)

---

**Need help?** The rules are designed to be secure by default. If you need to modify them for specific use cases, make sure to test thoroughly before deploying to production!
