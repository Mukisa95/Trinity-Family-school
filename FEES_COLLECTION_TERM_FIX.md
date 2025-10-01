# Fees Collection Term-Based Class Mismatch Fix

## Problem Description

The fees collection page was showing incorrect fees for pupils when viewing historical terms because it was using the pupil's **current** class information instead of their **historical** class information for that term.

### Example Scenario
- A pupil was in **Top Class** during **Term 2** (2024) paying **150 UGX**
- The pupil was promoted to **Primary Seven** in **Term 3** (2025) paying **300 UGX**
- When viewing Term 2 fees, the system was:
  - ✅ Correctly showing the pupil was in "Top Class" in the snapshot display
  - ❌ **Incorrectly** fetching fees for "Primary Seven" (current class) instead of "Top Class" (historical class)
  - This resulted in showing **300 UGX** fees for Term 2 instead of the correct **150 UGX**

## Root Cause

The `usePupilFees` hook in `src/app/fees/collect/[id]/hooks/usePupilFees.ts` was using the current pupil object (with current `classId` and `section`) to filter applicable fees, regardless of which term was selected.

```typescript
// OLD CODE (INCORRECT)
const applicableFees = filterApplicableFees(
  currentTermFees,
  pupil,  // ❌ This has the CURRENT class, not the historical class for the selected term
  selectedTermId,
  selectedAcademicYear,
  allAcademicYears
);
```

## Solution

Modified the `usePupilFees` hook to:

1. **Fetch the historical pupil snapshot** for the selected term using `PupilSnapshotsService`
2. **Create a virtual pupil** with historical class/section data from the snapshot
3. **Use the historical pupil** for fee filtering and processing

### Changes Made

#### 1. Added Snapshot Service Import
```typescript
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
```

#### 2. Added Historical Pupil Query
```typescript
// 🔥 CRITICAL FIX: Fetch historical pupil snapshot for the selected term
const { data: historicalPupil, isLoading: isLoadingSnapshot } = useQuery<Pupil>({
  queryKey: ['pupil-snapshot', pupilId, selectedTermId, selectedAcademicYear?.id],
  queryFn: async () => {
    if (!pupil || !selectedTermId || !selectedAcademicYear) {
      return pupil!;
    }
    
    // Get or create snapshot for this term
    const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
      pupil,
      selectedTermId,
      selectedAcademicYear
    );
    
    // Create virtual pupil with historical data
    const virtualPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
    
    return virtualPupil;
  },
  enabled: !!pupil && !!selectedTermId && !!selectedAcademicYear,
  staleTime: 10 * 60 * 1000, // 10 minutes cache
  gcTime: 20 * 60 * 1000, // 20 minutes cache
});
```

#### 3. Updated Fee Processing to Use Historical Pupil
```typescript
// NEW CODE (CORRECT)
const applicableFees = filterApplicableFees(
  currentTermFees,
  historicalPupil, // ✅ This has the HISTORICAL class for the selected term
  selectedTermId,
  selectedAcademicYear,
  allAcademicYears
);

const processedFees = processPupilFees(
  applicableFees,
  pupilPayments,
  allFeeStructures,
  historicalPupil, // ✅ Use historical pupil here too
  selectedTermId,
  selectedAcademicYear,
  allAcademicYears
);
```

#### 4. Updated Dependencies and Loading State
```typescript
// Added historicalPupil to dependency array
}, [
  selectedAcademicYear,
  pupil,
  selectedTermId,
  historicalPupil,    // 🔥 CRITICAL: Use historical pupil for correct class-based fee filtering
  currentTermFees,
  allFeeStructures,
  pupilPayments,
  previousBalance,
  allAcademicYears,
  uniformFees
]);

// Added snapshot loading to isLoading check
const isLoading = isLoadingFees || isLoadingPayments || isLoadingPreviousBalance || isLoadingUniformFees || isLoadingSnapshot;
```

## How It Works Now

1. **User selects a term** (e.g., Term 2 - 2024)
2. **System fetches pupil snapshot** for that specific term from Firestore
3. **Snapshot contains historical data**: `classId: "top-class"`, `section: "Nursery"`
4. **Virtual pupil is created** with historical class/section but current pupil's other data
5. **Fee filtering uses historical class**: Only fees applicable to "Top Class" in Term 2 are retrieved
6. **Correct fees are displayed**: 150 UGX for Top Class fees, not 300 UGX for Primary Seven

## Benefits

✅ **Financial Accuracy**: Fees displayed are historically accurate for each term
✅ **Audit Trail**: Complete historical record of what fees were applicable when
✅ **Promotion Support**: Handles pupil promotions correctly across terms
✅ **Consistency**: Uses the same snapshot system as the carry-forward balance calculations
✅ **Performance**: Snapshots are cached for 10 minutes to reduce database queries

## Testing Recommendations

1. **Test with promoted pupils**: 
   - Select a pupil who was promoted between terms
   - View their fees for the old term
   - Verify fees match the old class, not current class

2. **Test with class changes**:
   - Select a pupil who changed sections between terms
   - Verify fees respect the historical section

3. **Test current term**:
   - Verify current term still uses current class correctly (via snapshot)

4. **Test new pupils**:
   - Verify pupils registered mid-year only show fees for valid terms

## Additional Fix: Default Term Selection

After implementing the historical snapshot fix, we discovered that the page wasn't defaulting to the current term on load. This was because:

1. Academic years fetched from the database don't have the `isCurrent` flag set on terms
2. The default term selection logic (line 255 in `PupilFeesCollectionClient.tsx`) was checking for `term.isCurrent`
3. Since this flag didn't exist, it would fall back to the first term instead of the actual current term

### Solution
Added processing to mark current terms when academic years are fetched:

```typescript
// Process academic years to mark current terms
const academicYears = useMemo(() => {
  return rawAcademicYears.map(year => ({
    ...year,
    terms: year.terms.map(term => ({
      ...term,
      isCurrent: isTermActive(term) // ✅ Calculate and set isCurrent flag
    }))
  }));
}, [rawAcademicYears]);
```

This ensures that:
- The current term is properly identified based on today's date
- The default term selection logic can find the current term
- Users see the current term by default when opening a pupil's fees page

## Extension: Family Accounts Page Fix

The same issue existed in the **Family Accounts** page where carry-forward balances were being calculated using the pupil's current class instead of their historical class for each term.

### Problem in Family Accounts
When viewing a family's fees, if a pupil was promoted from **Top Class** (150 UGX) in Term 2 to **Primary Seven** (300 UGX) in Term 3, the carry-forward balance shown in Term 3 would incorrectly show **300 UGX** for Term 2 instead of **150 UGX**.

### Solution Applied
Completely refactored `src/app/fees/family/[...slug]/page.tsx` to use the **EXACT SAME** fee processing logic as the individual pupil fees page:

1. **Process academic years** to mark current terms
2. **Fetch historical snapshots** for each pupil
3. **Use `filterApplicableFees()`** - the same function used in individual fees page
4. **Use `processPupilFees()`** - the same function for payment processing
5. **Use `calculatePreviousTermBalances()`** - the same function for carry-forward

```typescript
// Step 1: Get historical snapshot
const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
  pupil, selectedTermId, selectedAcademicYear
);
const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);

// Step 2: Filter current term fees (EXACT same logic as individual page)
const currentTermFees = filterApplicableFees(
  feeStructures, historicalPupil, selectedTermId, selectedAcademicYear!, academicYears
);

// Step 3: Process fees with payments (EXACT same logic as individual page)
const processedFees = processPupilFees(
  currentTermFees, allPayments, feeStructures, historicalPupil, 
  selectedTermId, selectedAcademicYear!, academicYears
);

// Step 4: Get carry-forward balances (EXACT same logic as individual page)
const previousBalance = await calculatePreviousTermBalances(
  pupil.id, selectedTermId, selectedAcademicYear!, academicYears,
  async () => feeStructures, async (pupilId) => allPayments, pupil
);
```

**Key Change:** The family page was using custom fee filtering logic that checked `academicYearId` but NOT `termId`, causing it to include fees from all terms in the year. Now it uses the exact same functions as the individual fees page, ensuring 100% consistency.

### Impact
- ✅ Family account carry-forward balances now show correct historical fees
- ✅ Multi-pupil families with promotions display accurate balances
- ✅ Consistent behavior between individual and family fee views

## Files Modified

- `src/app/fees/collect/[id]/hooks/usePupilFees.ts` - Historical snapshot integration for individual fees
- `src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx` - Current term marking for individual fees
- `src/app/fees/family/[...slug]/page.tsx` - Historical snapshot integration and current term marking for family accounts

## Related Systems

This fix aligns with the existing snapshot system used in:
- `calculatePreviousTermBalances()` in `feeProcessing.ts` - Already uses snapshots for historical terms
- `PupilFeesCollectionClient.tsx` - Uses snapshots for display purposes
- Carry-forward balance calculations - Uses snapshots to ensure accurate historical data

## Date
September 30, 2025
