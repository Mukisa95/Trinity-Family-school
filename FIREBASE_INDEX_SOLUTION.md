# Firebase Index Solution for Mobile View Error

## Problem
The class view works properly on desktop but shows Firebase index errors on mobile:
- `Error fetching pupils by class: FirebaseError: The query requires an index`
- `Error fetching exams by class: FirebaseError: The query requires an index`

## Root Cause
Firebase Firestore requires **composite indexes** for queries that combine:
1. A `where` clause (filtering)
2. An `orderBy` clause (sorting)

The failing queries are:
1. **Pupils**: `where('classId', '==', classId)` + `orderBy('lastName', 'asc')`
2. **Exams**: `where('classId', '==', classId)` + `orderBy('createdAt', 'desc')`
3. **Attendance Records**: `where('pupilId', '==', pupilId)` + `orderBy('date', 'asc')`

## Solution: Create Required Indexes

### 1. Pupils Index
**Collection**: `pupils`  
**Fields**:
- `classId` (Ascending)
- `lastName` (Ascending) 
- `__name__` (Ascending)

**Direct Link**: https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=ClVwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wdXBpbHMvaW5kZXhlcy9fEAEaCwoHY2xhc3NJZBABGgwKCGxhc3ROYW1lEAEaDAoIX19uYW1lX18QAQ

### 2. Exams Index
**Collection**: `exams`  
**Fields**:
- `classId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Direct Link**: https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=ClRwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9leGFtcy9pbmRleGVzL18QARoLCgdjbGFzc0lkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg

### 3. Attendance Records Index
**Collection**: `attendanceRecords`  
**Fields**:
- `pupilId` (Ascending)
- `date` (Ascending)
- `__name__` (Ascending)

**Direct Link**: https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=CmBwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hdHRlbmRhbmNlUmVjb3Jkcy9pbmRleGVzL18QARoLCgdwdXBpbElkEAEaCAoEZGF0ZRACGgwKCF9fbmFtZV9fEAI

### 4. Payments Index
**Collection**: `payments`  
**Fields**:
- `pupilId` (Ascending)
- `paymentDate` (Ascending)
- `__name__` (Ascending)

**Direct Link**: https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=Cldwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wYXltZW50cy9pbmRleGVzL18QARoLCgdwdXBpbElkEAEaDwoLcGF5bWVudERhdGUQAhoMCghfX25hbWVfXxAC

## Steps to Create Indexes

1. **Click the direct links above** (they will open Firebase Console)
2. **Sign in** to your Firebase account
3. **Review** the index configuration (should be pre-filled)
4. **Click "Create Index"**
5. **Wait** for indexes to build (1-5 minutes)
6. **Monitor progress** in Firebase Console > Firestore > Indexes

## Why Desktop Works But Mobile Doesn't

This difference is likely due to:
- **Different caching behavior** between desktop and mobile browsers
- **Network conditions** that trigger index requirements differently
- **Browser-specific optimizations** that may bypass certain query paths on desktop

## Verification

After creating the indexes:
1. Wait for them to show as "Enabled" in Firebase Console
2. Test the class view on mobile again
3. The errors should be resolved and data should load properly

## Code Location

The failing queries are in:
- `src/lib/services/pupils.service.ts` - `getPupilsByClass()` method
- `src/lib/services/exams.service.ts` - `getExamsByClass()` method

These methods are called by:
- `src/lib/hooks/use-pupils.ts` - `usePupilsByClass()` hook
- `src/lib/hooks/use-exams.ts` - `useExamsByClass()` hook
- `src/app/class-detail/page.tsx` - Class detail page
