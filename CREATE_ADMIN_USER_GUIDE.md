# 🔐 Create First Admin User - Manual Guide

## **Method 1: Firebase Console (Recommended)**

### **Step 1: Create Authentication User**

1. Go to **Firebase Console**: https://console.firebase.google.com/project/trinity-family-ganda/authentication/users

2. Click **"Add user"**

3. Fill in the details:
   - **Email**: `admin@trinity-family-ganda.com`
   - **Password**: `admin123`
   - **User UID**: Let Firebase auto-generate

4. Click **"Add user"**

5. **Copy the generated UID** (you'll need it for the next step)

---

### **Step 2: Create Firestore User Document**

1. Go to **Firestore Database**: https://console.firebase.google.com/project/trinity-family-ganda/firestore/databases/-default-/data

2. Click **"Start collection"**

3. **Collection ID**: `users`

4. **Document ID**: Paste the UID you copied from Step 1

5. Add these fields (click "Add field" for each):

| Field Name | Type | Value |
|------------|------|-------|
| `uid` | string | (paste the UID from Step 1) |
| `email` | string | `admin@trinity-family-ganda.com` |
| `displayName` | string | `Admin User` |
| `role` | string | `Admin` |
| `accessLevel` | string | `super_admin` |
| `isActive` | boolean | `true` |
| `createdAt` | timestamp | (click "Set to current time") |
| `updatedAt` | timestamp | (click "Set to current time") |
| `modules` | map | (see below) |

6. For the **`modules`** field (type: map), add these sub-fields:

Click "Add field" inside the `modules` map:

| Field Name | Type | Value |
|------------|------|-------|
| `pupils` | boolean | `true` |
| `staff` | boolean | `true` |
| `classes` | boolean | `true` |
| `fees` | boolean | `true` |
| `exams` | boolean | `true` |
| `attendance` | boolean | `true` |
| `banking` | boolean | `true` |
| `sms` | boolean | `true` |
| `bulk_sms` | boolean | `true` |
| `reports` | boolean | `true` |
| `settings` | boolean | `true` |
| `users` | boolean | `true` |
| `notifications` | boolean | `true` |
| `events` | boolean | `true` |
| `requirements` | boolean | `true` |
| `uniforms` | boolean | `true` |
| `procurement` | boolean | `true` |
| `duty_service` | boolean | `true` |
| `academic_years` | boolean | `true` |
| `subjects` | boolean | `true` |

7. Click **"Save"**

---

### **Step 3: Test Login**

1. Go to: **https://trinity-family-ganda.vercel.app/login**

2. Login with:
   - **Email**: `admin@trinity-family-ganda.com`
   - **Password**: `admin123`

3. ✅ You should be logged in with full admin access!

---

## **Method 2: Quick JSON Import**

If the Firebase Console allows JSON import, use this:

```json
{
  "uid": "PASTE_UID_HERE",
  "email": "admin@trinity-family-ganda.com",
  "displayName": "Admin User",
  "role": "Admin",
  "accessLevel": "super_admin",
  "isActive": true,
  "createdAt": {
    "seconds": 1727753600,
    "nanoseconds": 0
  },
  "updatedAt": {
    "seconds": 1727753600,
    "nanoseconds": 0
  },
  "modules": {
    "pupils": true,
    "staff": true,
    "classes": true,
    "fees": true,
    "exams": true,
    "attendance": true,
    "banking": true,
    "sms": true,
    "bulk_sms": true,
    "reports": true,
    "settings": true,
    "users": true,
    "notifications": true,
    "events": true,
    "requirements": true,
    "uniforms": true,
    "procurement": true,
    "duty_service": true,
    "academic_years": true,
    "subjects": true
  }
}
```

---

## **⚠️ IMPORTANT Security Notes**

1. **Change the password immediately** after first login:
   - Go to **Settings** → **Account**
   - Update your password

2. **Enable 2FA** (if available in your Firebase project)

3. **Do NOT share** these credentials

4. **Create additional admin users** with unique passwords for other administrators

---

## **🔒 Deploy Security Rules**

After creating the admin user, deploy the security rules to protect your database:

### **Option 1: Using Firebase CLI** (Recommended)

```bash
# Make sure you're in the project directory
cd c:\Users\ZION\Desktop\download

# Login to Firebase (if not already logged in)
firebase login

# Initialize Firebase project (if not already done)
firebase init

# Deploy security rules
firebase deploy --only firestore:rules,storage
```

### **Option 2: Manual Deployment via Console**

**Firestore Rules:**
1. Go to: https://console.firebase.google.com/project/trinity-family-ganda/firestore/rules
2. Copy the contents from `firestore.rules` file
3. Paste into the editor
4. Click **"Publish"**

**Storage Rules:**
1. Go to: https://console.firebase.google.com/project/trinity-family-ganda/storage/rules
2. Copy the contents from `storage.rules` file
3. Paste into the editor
4. Click **"Publish"**

---

## **✅ Verification Checklist**

- [ ] Admin user created in Firebase Authentication
- [ ] User document created in Firestore `users` collection
- [ ] All module permissions set to `true`
- [ ] Able to login at https://trinity-family-ganda.vercel.app/login
- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] Password changed after first login

---

## **🎉 You're All Set!**

Your production Trinity Family School application is now ready with:
- ✅ Empty production database
- ✅ Admin user with full access
- ✅ Secure Firestore and Storage rules
- ✅ Live deployment at https://trinity-family-ganda.vercel.app

You can now start adding:
- Academic years
- Classes and sections
- Staff members
- Pupils and families
- Fee structures
- And more!

