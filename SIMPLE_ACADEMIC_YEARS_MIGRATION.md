# Simple Academic Years Migration Guide

## 🎯 Goal
Copy academic years from dev database (trinity-family-schools) to production (trinity-family-ganda).

## ✅ Easiest Method: Manual Copy via Firebase Console

Since you're already logged into Firebase, this is the fastest way:

### Step 1: Export from Dev Database

1. **Open Dev Database**: 
   - https://console.firebase.google.com/project/trinity-family-schools/firestore

2. **Navigate to**: `academicYears` collection

3. **For each academic year document**:
   - Click on the document
   - Click the **3-dot menu** (⋮) → **Export document**
   - Or manually copy all fields and values

### Step 2: Import to Production Database

1. **Open Production Database**:
   - https://console.firebase.google.com/project/trinity-family-ganda/firestore/databases/-default-/data

2. **Create `academicYears` collection** (if it doesn't exist):
   - Click **"Start collection"**
   - Collection ID: `academicYears`

3. **Add Document**:
   - Use the **same document ID** from dev
   - Copy all fields exactly as they appear in dev
   - Click **"Save"**

4. **Repeat** for all academic years

---

## 🚀 Alternative: Use Firebase CLI Script

I've created a safer automated migration script. To use it:

### Prerequisites
```bash
npm install -g firebase-admin
```

### Required Files

You need service account keys for both projects:

**1. Dev Service Account**:
- Go to: https://console.firebase.google.com/project/trinity-family-schools/settings/serviceaccounts
- Click "Generate new private key"
- Save as: `service-account-dev.json` (in project root)

**2. Production Service Account**:
- Go to: https://console.firebase.google.com/project/trinity-family-ganda/settings/serviceaccounts
- Click "Generate new private key"
- Save as: `service-account-prod.json` (in project root)

### Run Migration
```bash
node scripts/migrate-academic-years.js
```

The script will:
1. ✅ Show you what will be migrated
2. ✅ Create a backup file
3. ✅ Ask for confirmation before proceeding
4. ✅ Safely migrate the data

---

## 📋 Sample Academic Year Structure

For reference, here's what an academic year document looks like:

```json
{
  "id": "FXhxeUDDEUNNva2x8vg4",
  "year": "2025",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "isActive": true,
  "currentTermId": "t3-2025",
  "terms": [
    {
      "id": "t1-2025",
      "name": "Term 1",
      "startDate": "2025-01-01",
      "endDate": "2025-04-15"
    },
    {
      "id": "t2-2025",
      "name": "Term 2", 
      "startDate": "2025-04-16",
      "endDate": "2025-08-15"
    },
    {
      "id": "t3-2025",
      "name": "Term 3",
      "startDate": "2025-09-01",
      "endDate": "2025-12-15"
    }
  ]
}
```

---

## ⚠️ Important Notes

### Before Migration
- ✅ Backup your production database (if it has any data)
- ✅ Verify dev data is correct and complete
- ✅ Check that IDs don't conflict with existing data

### After Migration
- ✅ Verify data in Firebase console
- ✅ Test that analytics page loads
- ✅ Check that other features still work
- ✅ Mark one year as `isActive: true`
- ✅ Set `currentTermId` to current term

---

## 🎯 Quick Manual Migration Example

If you have just one or two academic years, manual copy is fastest:

### From Dev Console
```
Document ID: FXhxeUDDEUNNva2x8vg4

Fields:
- year: "2025"
- startDate: "2025-01-01"
- endDate: "2025-12-31"
- isActive: true
- currentTermId: "t3-2025"
- terms: [array with 3 items]
```

### To Production Console
1. Click **"Add document"**
2. **Document ID**: `FXhxeUDDEUNNva2x8vg4` (same as dev)
3. **Add fields** exactly as they appear in dev
4. For the `terms` array, click "Add field" → "array" → add each term object
5. Click **"Save"**

---

## ✅ Verification

After migration, verify everything works:

1. **In Firebase Console**:
   - Go to production database
   - Check `academicYears` collection has data
   - Verify fields are correct

2. **In Your App** (localhost):
   - Navigate to `/academic-years`
   - Should see the migrated years
   - Click on one to verify terms are present

3. **In Analytics**:
   - Navigate to `/fees/analytics`
   - Should now show year/term selectors
   - Should load analytics data successfully!

---

## 💡 Recommended Approach

**For 1-2 academic years**: Manual copy via console (5 minutes)
**For 3+ academic years**: Use the migration script (10 minutes setup, 1 minute run)

Choose whichever is easier for you!

