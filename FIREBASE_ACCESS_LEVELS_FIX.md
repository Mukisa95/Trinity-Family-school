# Firebase Access Levels & Select.Item Fixes

## Issues Fixed

### 1. Firebase Composite Index Error

**Error:** 
```
Error fetching active access levels: FirebaseError: The query requires an index
```

**Cause:**
The `getActiveAccessLevels()` method in `src/lib/services/access-levels.service.ts` was querying Firestore with:
- `where('isActive', '==', true)`
- `orderBy('name', 'asc')`

This compound query requires a composite index.

**Fix:**
- Added composite index to `firestore.indexes.json`:
```json
{
  "collectionGroup": "accessLevels",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "isActive",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "name",
      "order": "ASCENDING"
    }
  ]
}
```
- Deployed the index using: `firebase deploy --only firestore:indexes`

**Status:** ✅ Deployed successfully

---

### 2. Select.Item Empty Value Error

**Error:**
```
Uncaught Error: A <Select.Item /> must have a value prop that is not an empty string
```

**Cause:**
Multiple components had `<SelectItem value="">` which is not allowed in the Select component. Empty strings cannot be used as values because the Select uses empty strings internally to clear selections.

**Files Fixed:**

#### a. `src/app/users/page.tsx`
- Changed access level "none" option from `value=""` to `value="none"`
- Updated `handleAccessLevelChange()` to properly handle the "none" value by clearing permissions
- Updated display logic to not show the info message when "none" is selected

#### b. `src/components/pupils/assignment-modal.tsx`
- Changed disabled placeholder from `value=""` to `value="none"`

#### c. `src/app/requirements/page.tsx`
- Changed all filter "All" options from `value=""` to `value="all_filter"`
- Updated all filter select handlers to convert "all_filter" back to empty string for filtering logic
- Filters affected: Gender, Class, Section, Group

#### d. `src/components/common/pupil-historical-selector.tsx`
- Changed "All Classes" from `value=""` to `value="all_filter"`
- Changed "All Sections" from `value=""` to `value="all_filter"`
- Updated handlers to convert "all_filter" back to empty string for filtering logic

**Pattern Used:**
For filter dropdowns where empty string represents "All":
```tsx
// Display value
<Select value={filterValue || "all_filter"} 
        onValueChange={(value) => setFilterValue(value === "all_filter" ? '' : value)}>
  <SelectItem value="all_filter">All</SelectItem>
  {/* Other options */}
</Select>
```

**Status:** ✅ All fixed, no linter errors

---

## Testing Checklist

- [ ] Access levels page loads without Firebase index error
- [ ] Users page: Access level selection works correctly
  - [ ] "No access level (manual permissions)" option works
  - [ ] Selecting an access level auto-fills permissions
  - [ ] Info message shows/hides correctly
- [ ] Requirements page: All filters work correctly
  - [ ] Gender filter
  - [ ] Class filter
  - [ ] Section filter
  - [ ] Group filter
- [ ] Pupil historical selector: Class and section filters work correctly
- [ ] Assignment modal: No errors when no fees are available

---

## Technical Notes

1. **Firebase Index Build Time:** Composite indexes can take several minutes to build. The index status can be checked at:
   https://console.firebase.google.com/project/trinity-family-ganda/firestore/indexes

2. **Select.Item Value Requirements:**
   - Must not be an empty string
   - Use meaningful placeholder values like "none", "all", or "all_filter"
   - Convert back to empty string in the handler if needed for logic

3. **Future Prevention:**
   - Always use non-empty values for `<SelectItem value={...}>`
   - Add composite indexes to `firestore.indexes.json` before deploying queries
   - Test filter dropdowns with "All" options to ensure they handle value conversion correctly

---

## Files Modified

1. `firestore.indexes.json` - Added accessLevels composite index
2. `src/app/users/page.tsx` - Fixed access level selection
3. `src/components/pupils/assignment-modal.tsx` - Fixed disabled fee option
4. `src/app/requirements/page.tsx` - Fixed all filter selects
5. `src/components/common/pupil-historical-selector.tsx` - Fixed filter selects

---

Date: October 24, 2025

