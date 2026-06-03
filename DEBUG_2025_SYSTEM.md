# Debug: 2025 Academic Year & Snapshot Issues

## **Critical Insight: We're in 2025!**

You're absolutely right - we are in 2025, not 2024. This changes everything!

## **Expected System State for 2025:**

### **2024 Academic Year (PAST YEAR):**
- **All Terms**: Completely ended (Term 1: Feb-May 2024, Term 2: May-Aug 2024, Term 3: Sep-Dec 2024)
- **Status**: Should be LOCKED and have ALL real snapshots
- **Snapshot Requirement**: Every pupil should have real snapshots for ALL 2024 terms

### **2025 Academic Year (CURRENT YEAR):**
- **Term 1**: Feb 3, 2025 - May 2, 2025 (ENDED - it's June 2025!)
- **Term 2**: May 26, 2025 - Aug 22, 2025 (CURRENT or ENDED depending on exact date)
- **Term 3**: Sep 15, 2025 - Dec 5, 2025 (FUTURE)

## **What's Probably Wrong:**

1. **System thinks 2024 is still active** instead of 2025
2. **Missing snapshots for ALL of 2024**
3. **Possibly missing snapshots for 2025 Term 1** (which has already ended)

## **Immediate Debug Steps:**

### **Step 1: Check Active Year**
```javascript
// Run in browser console on /academic-years page
const activeYear = document.querySelector('[data-year-status="Active"]')?.textContent;
console.log('Active Year:', activeYear);

// Or check via API
fetch('/api/academic-years/active').then(r => r.json()).then(console.log);
```

### **Step 2: Check Current Date vs Academic Structure**
Today is approximately **June 9, 2025**, so:
- **2024**: ALL terms ended → Should have snapshots
- **2025 Term 1** (Feb-May 2025): ENDED → Should have snapshots
- **2025 Term 2** (May-Aug 2025): CURRENT → Should NOT have snapshots
- **2025 Term 3** (Sep-Dec 2025): FUTURE → Should NOT have snapshots

### **Step 3: Manual System Check**

**Go to your application and verify:**

1. **Navigate to `/academic-years`**
   - Which year shows "Active" badge?
   - If it's 2024: This is WRONG - 2025 should be active
   - If it's 2025: This is correct

2. **Check term statuses in active year:**
   - Are any terms marked as "Current"?
   - Which term is marked as "Next"?

3. **Navigate to `/dev-tools/snapshots`**
   - Click "Analyze Snapshots"
   - Check distribution by year and term

## **Expected Debug Results:**

### **If 2024 is still marked as active (WRONG):**
```
Problem: System hasn't transitioned to 2025
Solution: Set 2025 as active academic year
Impact: All fee calculations are using wrong academic year
```

### **If 2025 is active but Term 1 doesn't have snapshots (LIKELY):**
```
Problem: 2025 Term 1 ended but no snapshots created
Solution: Create snapshots for 2025 Term 1
Impact: Fee calculations for 2025 Term 1 use current data instead of historical
```

### **If 2024 is locked but missing snapshots (POSSIBLE):**
```
Problem: 2024 terms missing snapshots completely
Solution: Create snapshots for all 2024 terms
Impact: Fee calculations for 2024 terms use current data
```

## **Fix Priority Order:**

### **Priority 1: Set Correct Active Year**
If 2024 is still active:
1. Go to academic years management
2. Set 2025 as active year
3. Lock 2024 year
4. Verify term detection works correctly

### **Priority 2: Create Missing Snapshots**
1. For ALL 2024 terms (if missing)
2. For 2025 Term 1 (if it has ended)
3. Delete any incorrect snapshots for current/future terms

### **Priority 3: Test Fee Processing**
1. Test pupil fees for 2024 terms
2. Test pupil fees for 2025 Term 1
3. Verify snapshots are being used correctly

## **Debug Commands for 2025:**

```javascript
// Check current system date vs academic year setup
const now = new Date();
console.log('Current Date:', now.toISOString().split('T')[0]);
console.log('Current Year:', now.getFullYear());

// Check academic year setup
const academicYears = await AcademicYearsService.getAllAcademicYears();
academicYears.forEach(year => {
  console.log(`${year.name}: ${year.isActive ? 'ACTIVE' : 'inactive'} ${year.isLocked ? 'LOCKED' : 'unlocked'}`);
});

// Check 2025 term statuses
const year2025 = academicYears.find(y => y.name === '2025');
if (year2025) {
  year2025.terms.forEach(term => {
    const status = getTermStatus(term);
    console.log(`2025 ${term.name}: ${status} (${term.startDate} to ${term.endDate})`);
  });
}
```

## **Expected Outcome After Fix:**

- **2024**: Locked, all terms have real snapshots
- **2025**: Active, Term 1 has real snapshots, Terms 2&3 remain dynamic
- **Fee processing**: Uses historical data for ended terms, live data for current/future terms
- **Snapshot system**: Only creates snapshots when terms actually end

This explains why "pupils with term one fees data are not using snapshots" - if the system is confused about which year is active and which terms have ended! 