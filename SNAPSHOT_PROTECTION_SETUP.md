# 🔒 Snapshot Protection System - Prevents Incorrect Data Capture

## ✅ What Has Been Implemented

A comprehensive system to prevent capturing incorrect snapshot data when pupils have been promoted after terms end.

## 🛡️ Protection Mechanisms

### 1. **Automatic Snapshot Creation (Vercel Cron)**
- **Schedule**: Daily at 1:00 AM UTC
- **Window**: Captures snapshots for terms that ended in the last 1 day (immediate) or 1-2 days ago (catch-up)
- **Location**: `vercel.json` configured with cron job

### 2. **Promotion Detection**
- **Method**: `checkIfPupilPromotedAfterTerm()`
- **Checks**: Promotion history to detect if pupil was promoted after term ended
- **Action**: If promoted, uses historical data recovery instead of current data

### 3. **Snapshot Validation**
- **Method**: `validateSnapshotData()`
- **Validates**: Snapshot data before creation
- **Prevents**: Creating snapshots with current data if pupil was promoted after term ended
- **Throws Error**: If validation fails, prevents incorrect snapshot creation
- **Recapture Exception**: Recapture operations can bypass strict validation (with warnings) since they are intentional corrections

### 4. **Historical Data Recovery**
- **Priority**: Always attempts to recover historical data first
- **Sources**: 
  - Promotion history
  - Earlier snapshots in same academic year
  - Falls back to current data only with warnings

## 📋 How It Works

### Automatic Snapshot Creation Flow

```
Daily Cron (1 AM UTC)
    ↓
Check for terms ended in last 1-2 days
    ↓
For each term:
    ↓
For each pupil:
    ↓
Check if snapshot exists → NO
    ↓
Check if pupil was promoted after term ended
    ↓
YES → Use historical data recovery
NO → Use current data (safe, term just ended)
    ↓
Validate snapshot data
    ↓
Create snapshot with validated data
```

### On-Demand Snapshot Creation Flow

```
User views fees for ended term
    ↓
getOrCreateSnapshot() called
    ↓
Check if snapshot exists → NO
    ↓
Check if pupil was promoted after term ended
    ↓
YES → Use historical data recovery
NO → Attempt historical data recovery anyway
    ↓
Validate snapshot data
    ↓
Create snapshot or return error snapshot
```

## 🔍 Key Features

### 1. **Immediate Capture Window**
- Snapshots are created within 1 day of term ending
- Prevents promotions from happening before snapshots are captured
- Catch-up window (1-2 days) handles missed cron runs

### 2. **Promotion Detection**
```typescript
// Checks promotion history
const promotionAfterTerm = checkIfPupilPromotedAfterTerm(pupil, termEndDate);

if (promotionAfterTerm) {
  // Use historical data recovery, not current data
  const historicalData = await getHistoricalPupilData(pupil, termId, academicYear);
}
```

### 3. **Validation Before Creation**
```typescript
// Validates snapshot data
const validation = validateSnapshotData(pupil, termEndDate, classId, section);

if (!validation.isValid) {
  throw new Error("Cannot create snapshot with potentially incorrect data");
}
```

### 4. **Enhanced Logging**
- Logs when promotions are detected
- Warns when using potentially incorrect data
- Tracks skipped snapshots due to promotions

## 📊 API Response

The maintenance API now returns:
```json
{
  "success": true,
  "details": {
    "termsChecked": 2,
    "snapshotsCreated": 150,
    "skippedDueToPromotion": 5,
    "errors": 0
  }
}
```

## 🚀 Deployment

### Vercel Cron Setup
The `vercel.json` file is configured with:
```json
{
  "crons": [
    {
      "path": "/api/maintenance/snapshots",
      "schedule": "0 1 * * *"
    }
  ]
}
```

### Manual Testing
You can test the endpoint manually:
```bash
POST /api/maintenance/snapshots
```

## ⚠️ Important Notes

1. **Cron Must Be Active**: The automatic protection only works if Vercel Cron is running
2. **Promotion History Required**: Pupils must have promotion history for detection to work
3. **Historical Data Recovery**: System attempts to recover accurate data, but may fall back to current data with warnings
4. **Recapture Feature**: Use the recapture feature (snapshot icon dropdown) to fix incorrect snapshots
   - **Recapture Bypass**: Recapture operations intentionally bypass strict validation to allow fixing incorrect snapshots
   - **Warnings Still Logged**: Even during recapture, warnings are logged but don't block the operation

## 🔧 Maintenance

### Check Cron Status
- Vercel Dashboard → Functions → Cron Jobs
- Verify `/api/maintenance/snapshots` is running daily

### Monitor Logs
- Check for promotion detection warnings
- Monitor skipped snapshots count
- Review error logs for validation failures

### Manual Snapshot Creation
If automatic creation fails, use:
- Dev Tools → Snapshots page
- Force Create All Missing Snapshots
- This will also use promotion detection and validation

## 📝 Summary

The system now:
- ✅ Creates snapshots automatically when terms end (before promotions)
- ✅ Detects if pupils were promoted after terms ended
- ✅ Uses historical data recovery when promotions detected
- ✅ Validates snapshot data before creation
- ✅ Prevents creating snapshots with incorrect data
- ✅ Provides recapture feature to fix incorrect snapshots

This ensures that snapshot data is always accurate and reflects the pupil's class/section as it was during the term, not after promotions occurred.
