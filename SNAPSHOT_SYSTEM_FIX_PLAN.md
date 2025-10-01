# Pupil Snapshot System - Complete Fix & Testing Plan

## **Issue Identified**
You reported: *"pupils with term one fees data are not using snapshots yet we are in second term"*

**CRITICAL UPDATE: We're in 2025, not 2024!** This completely changes the analysis:

- **2024 Academic Year**: ALL terms have ended → Should have real snapshots
- **2025 Academic Year**: Term 1 has ended (Feb-May 2025) → Should have real snapshots
- **Current Term**: Likely 2025 Term 2 (May-Aug 2025) → Should use live data

## **Root Cause Analysis**

### **What Should Happen (Updated for 2025):**
1. **2024 ALL Terms:** Should have REAL snapshots (entire year ended)
2. **2025 Term 1:** Should have REAL snapshots (ended May 2025)
3. **2025 Term 2:** Should use LIVE data (current term)
4. **2025 Term 3:** Should use LIVE data (future term)

### **What's Probably Happening:**
1. **Wrong Active Year:** System may think 2024 is still active
2. **Missing 2024 Snapshots:** No snapshots for entire 2024 academic year
3. **Missing 2025 Term 1 Snapshots:** May not have been created when term ended
4. **Confusion:** Fee processing doesn't know which year/term we're actually in

## **Fixes Implemented**

### **1. Enhanced Academic Year Utils (`src/lib/utils/academic-year-utils.ts`)**
```typescript
// NEW FUNCTIONS ADDED:
- isTermEnded(term): Check if term has ended
- getTermStatus(term): Classify as 'past', 'current', 'future'
- getEndedTerms(academicYears): Get all terms that should have snapshots
- getCurrentAndUpcomingTerms(academicYears): Get terms that should NOT have snapshots
```

### **2. Fixed Snapshot Service (`src/lib/services/pupil-snapshots.service.ts`)**

**Key Changes:**
- **`getOrCreateSnapshot()`**: Returns virtual snapshots for current/future terms
- **`createSnapshot()`**: Validates term has ended before creating real snapshot
- **`deleteSnapshotsForCurrentAndUpcomingTerms()`**: Removes incorrect snapshots
- **`getSnapshotStatsByTermStatus()`**: Analyzes snapshot distribution

**Critical Logic:**
```typescript
// For PAST terms: Create/return REAL snapshots
if (termStatus === 'past') {
  // Create permanent snapshot with historical data
  return realSnapshot;
}

// For CURRENT/FUTURE terms: Return virtual snapshots
if (termStatus === 'current' || termStatus === 'future') {
  // Return virtual snapshot with live data
  return virtualSnapshot;
}
```

### **3. Enhanced Dev Tools (`src/app/dev-tools/snapshots/page.tsx`)**
- Added snapshot analysis by term status
- Added cleanup functionality for incorrect snapshots
- Added comprehensive debugging tools

## **Testing Plan - Step by Step**

### **Step 0: Check Active Academic Year (CRITICAL)**
1. Open your application
2. Go to `/academic-years`
3. **Verify which year shows "Active" badge:**
   - If **2024 is active**: This is WRONG - you need to set 2025 as active
   - If **2025 is active**: This is correct, proceed to next steps

**If 2024 is still active, STOP and fix this first:**
1. Contact system administrator to set 2025 as active year
2. Lock 2024 academic year
3. Then proceed with snapshot testing

### **Step 1: Navigate to Dev Tools**
1. Go to `/dev-tools/snapshots`
2. You should see the Pupil Snapshots Developer Tools page

### **Step 2: Analyze Current State**
1. Click **"Analyze Snapshots"** button
2. Look for the analysis results:
   - **2024 Terms (✓ Should have snapshots)**: All 3 terms should show snapshots
   - **2025 Term 1 (✓ Should have snapshots)**: Ended May 2025
   - **2025 Terms 2&3 (❌ Should NOT have snapshots)**: Current/future terms

### **Step 3: Clean Up Incorrect Snapshots (If Any)**
If you see any snapshots for current/future terms:
1. Click **"Delete Incorrect Snapshots"** button
2. Wait for cleanup to complete
3. Verify all incorrect snapshots are deleted

### **Step 4: Check Snapshot Coverage**
1. Click **"Check Coverage"** button
2. This will show:
   - **Total Expected Snapshots**: For all ended terms
   - **Existing Snapshots**: Current count
   - **Missing Snapshots**: What needs to be created

### **Step 5: Create Missing Snapshots**
If there are missing snapshots:
1. Click **"Create Missing Snapshots"** button
2. Wait for creation process to complete
3. Check the results summary

### **Step 6: Test Fee Processing**
1. Pick a pupil who has changed classes during the year
2. Go to their individual fees page (`/fees/collect/[pupilId]`)
3. Switch to Term 1 in the term selector
4. Look for the **📸 icon** next to class/section info
5. Verify it shows historical class/section, not current one

### **Step 7: Console Verification**
1. Open browser developer tools (F12)
2. Go to Console tab
3. Navigate to pupil fees for Term 1
4. Look for console messages like:
   ```
   📸 Using historical snapshot for Term 1: class=p1-class, section=Day (current: class=p2-class, section=Day)
   ✅ Found existing snapshot: {...}
   ```

## **Expected Results After Fix**

### **For Term 1 (Past):**
- ✅ Should have REAL snapshots in database
- ✅ Fee processing should use historical class/section data
- ✅ Console should show "Using historical snapshot"
- ✅ UI should show 📸 icon when historical data differs from current

### **For Term 2 (Past):**
- ✅ Should have REAL snapshots in database
- ✅ Same behavior as Term 1

### **For Term 3 (Current/Future):**
- ✅ Should NOT have real snapshots
- ✅ Should use live pupil data
- ✅ Should remain dynamic and show current class/section

## **Debug Commands (Advanced)**

If you want to manually test the snapshot system, open browser console and run:

```javascript
// Test term status detection
const academicYears = await AcademicYearsService.getAllAcademicYears();
const currentYear = academicYears.find(y => y.isActive);
currentYear.terms.forEach(term => {
  console.log(`${term.name}: ${getTermStatus(term)}`);
});

// Test snapshot retrieval for a specific pupil and term
const pupils = await PupilsService.getAllPupils();
const testPupil = pupils[0]; // First pupil
const term1Id = currentYear.terms[0].id; // Term 1

const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
  testPupil, 
  term1Id, 
  currentYear
);

console.log('Snapshot result:', {
  id: snapshot.id,
  isVirtual: snapshot.id.startsWith('virtual-'),
  classId: snapshot.classId,
  section: snapshot.section
});

// If isVirtual is true for a past term, that's the problem!
```

## **Common Issues & Solutions**

### **Issue 1: Term 1 Still Returns Virtual Snapshots**
**Cause:** Real snapshots don't exist for Term 1
**Solution:** 
1. Go to dev tools and create missing snapshots
2. Verify snapshots exist in database
3. Re-test fee processing

### **Issue 2: Snapshots Exist But Wrong Data**
**Cause:** Snapshots were created with current pupil data instead of historical
**Solution:**
1. Delete existing snapshots for that term
2. Manually create correct snapshots with historical data
3. This requires administrative intervention

### **Issue 3: Current Terms Have Snapshots**
**Cause:** System incorrectly created snapshots for ongoing terms
**Solution:**
1. Use "Delete Incorrect Snapshots" in dev tools
2. Verify only past terms have snapshots

## **Verification Checklist**

- [ ] All past terms show real snapshots
- [ ] Current/future terms show no snapshots
- [ ] Fee processing for Term 1 uses historical data
- [ ] Console shows "Using historical snapshot" messages
- [ ] UI shows 📸 icon for historical data
- [ ] Pupil class changes don't affect past term fees

## **Final Notes**

1. **The snapshot system is now correctly implemented** to only create snapshots when terms end
2. **Current and future terms remain dynamic** as they should
3. **Historical accuracy is preserved** for financial calculations
4. **The stale data issue should be resolved** after cleanup

If after following this plan you still experience issues, the problem may be in the fee structure assignments or payment calculations rather than the snapshot system itself. 