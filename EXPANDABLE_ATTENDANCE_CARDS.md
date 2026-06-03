# Expandable Attendance Cards Feature

## Overview
Enhanced the dashboard attendance cards ("Present Today" and "Absent Today") to be expandable, showing a detailed class-by-class breakdown when clicked.

## Problem Solved
Users needed to see attendance breakdown by class without navigating away from the dashboard. The static cards only showed overall numbers, requiring navigation to the attendance page for detailed information.

## Solution
Created expandable cards that:
1. Show total present/absent count (collapsed state)
2. Expand to show breakdown by class when clicked
3. Display each class with format: "P.7 = 45 of 51"
4. Include visual progress bars for quick assessment
5. Allow clicking on individual classes to view full details

## Features

### 1. Expandable Card Component
New `ExpandableAttendanceCard` component with:
- **Collapsed State**: Shows total count
- **Expanded State**: Shows class-by-class breakdown
- **Smooth Animation**: Slide down/up with fade effect
- **Visual Indicators**: Chevron icons show expand/collapse state

### 2. Class Breakdown Display
Each class row shows:
- **Class Name**: e.g., "P.7", "S.1", etc.
- **Count**: "45 of 51" format
- **Progress Bar**: Visual representation of percentage
- **Color Coding**:
  - Green for present pupils
  - Red for absent pupils
- **Clickable**: Navigate to class attendance details

### 3. Data Structure

#### Attendance Data (Enhanced)
```typescript
{
  present: number,      // Total present
  absent: number,       // Total absent
  late: number,         // Total late
  total: number,        // Total records
  records: [],          // Raw records
  byClass: [            // NEW: Class breakdown
    {
      classId: string,
      className: string,
      present: number,
      absent: number,
      late: number,
      total: number     // Records for this class
    }
  ]
}
```

### 4. Smart Calculations
The component intelligently:
- Groups attendance records by class
- Merges with pupil data to get class totals
- Calculates "X of Y" format showing recorded vs total pupils
- Computes percentage for progress bars
- Sorts classes numerically (P.1, P.2, ... P.7, S.1, etc.)

## User Experience

### Interaction Flow

1. **Default View**
   - Cards show total numbers
   - Hint text: "Click to see by class"
   - Chevron down icon

2. **Expanded View**
   - Smooth slide-down animation
   - Class list appears with scrolling (if many classes)
   - Hint text changes to: "Click to collapse"
   - Chevron up icon

3. **Class Row Click**
   - Navigates to attendance page for that class
   - Pre-filtered to show class attendance
   - Allows quick access to specific class details

### Visual Design

#### Collapsed Card
```
┌─────────────────────────────┐
│ PRESENT TODAY          ✓    │
│ 245                          │
│ In attendance                │
│                              │
│ Click to see by class    ▼  │
└─────────────────────────────┘
```

#### Expanded Card
```
┌─────────────────────────────┐
│ PRESENT TODAY          ✓    │
│ 245                          │
│ In attendance                │
│                              │
│ Click to collapse        ▲  │
├─────────────────────────────┤
│ By Class:                    │
│ ┌─────────────────────────┐ │
│ │ P.1  ████████  20 of 25 │ │
│ │ P.2  ██████    18 of 22 │ │
│ │ P.3  ████████  23 of 28 │ │
│ │ P.7  ████████  45 of 51 │ │
│ │ S.1  ██████    32 of 45 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## Technical Implementation

### Files Modified

1. **`src/lib/hooks/use-dashboard-data.ts`**
   - Added `byClass` calculation in attendance query
   - Groups records by classId
   - Counts present, absent, late per class
   - Returns array of class-level data

2. **`src/app/page.tsx`**
   - Created `ExpandableAttendanceCard` component
   - Added expand/collapse state management
   - Implemented class breakdown calculation
   - Merged attendance data with pupil totals
   - Added click handlers for navigation
   - Replaced static cards with expandable ones

### Key Components

#### ExpandableAttendanceCard Props
```typescript
{
  title: string;              // "Present Today" or "Absent Today"
  value: number;              // Total count
  icon: LucideIcon;          // CheckCircle or XCircle
  color: ColorScheme;        // Green or red theme
  subtitle: string;          // Description text
  isLoading: boolean;        // Loading state
  attendanceData: any;       // Attendance data with byClass
  pupils: Pupil[];           // All pupils (for totals)
  filterType: 'present' | 'absent';  // Which metric to show
}
```

#### Class Breakdown Logic
```typescript
// 1. Group pupils by class to get totals
const pupilsByClass = pupils.reduce((acc, pupil) => {
  acc[pupil.classId] = { total: count };
  return acc;
}, {});

// 2. Merge with attendance data
const breakdown = attendanceData.byClass.map(classData => ({
  ...classData,
  total: pupilsByClass[classData.classId].total,
  percentage: (classData.present / total) * 100
}));

// 3. Sort numerically
breakdown.sort((a, b) => 
  extractNumber(a.className) - extractNumber(b.className)
);
```

### Animation Details
```typescript
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  {/* Breakdown content */}
</motion.div>
```

## Performance Considerations

### Efficient Data Fetching
- ✅ No additional queries needed
- ✅ Uses existing attendance data
- ✅ Groups records in memory (fast)
- ✅ Calculations cached with `useMemo`

### Optimized Rendering
- ✅ Only renders expanded content when needed
- ✅ AnimatePresence handles mount/unmount
- ✅ Scrollable list for many classes (max-height: 240px)
- ✅ Event propagation controlled to prevent bubbling

### Memory Efficiency
- ✅ Expanded state per card (independent)
- ✅ Breakdown recalculated only when data changes
- ✅ No unnecessary re-renders

## Benefits

### For Users
1. **Quick Overview**: See attendance breakdown at a glance
2. **No Navigation**: Stay on dashboard while exploring data
3. **Visual Feedback**: Progress bars show status quickly
4. **Easy Access**: Click any class to view full details
5. **Responsive**: Works on desktop and mobile

### For School Administrators
1. **Efficiency**: Quickly identify classes with low attendance
2. **Decision Making**: Spot patterns without extra clicks
3. **Time Saving**: No need to navigate to attendance page for overview
4. **Action Oriented**: Direct links to problem classes

### For Development
1. **Reusable Component**: Can be used for other expandable cards
2. **Type Safe**: Proper TypeScript interfaces
3. **Maintainable**: Clear separation of concerns
4. **Extensible**: Easy to add more metrics or filters

## Example Usage

### Present Today Card
Shows which classes have good attendance:
- P.7: 45 of 51 (88%) ✅
- S.1: 32 of 45 (71%) ⚠️

### Absent Today Card
Shows which classes have attendance issues:
- P.3: 5 of 28 (18%) - needs attention
- S.2: 8 of 42 (19%) - needs attention

## Future Enhancements

Potential improvements:
1. **Threshold Alerts**: Highlight classes below certain attendance %
2. **Trend Indicators**: Show if attendance is up/down from yesterday
3. **Quick Actions**: Mark attendance button per class
4. **Export Data**: Download class breakdown as CSV
5. **Time-based View**: Toggle between today/this week/this month
6. **Search/Filter**: Find specific class quickly
7. **Sorting Options**: Sort by attendance %, class name, or absent count

## Testing

### Verify Feature is Working

1. **Navigate to Dashboard**
   - Should see "Present Today" and "Absent Today" cards
   - Cards should show hint: "Click to see by class"

2. **Click on Present Today Card**
   - Card should expand smoothly
   - Should see list of classes
   - Each class shows "X of Y" format
   - Progress bars should be green

3. **Click on Absent Today Card**
   - Card should expand independently
   - Should see list of classes
   - Each class shows absent count
   - Progress bars should be red

4. **Click on a Class Row**
   - Should navigate to attendance view page
   - Should be filtered to that class
   - Can verify detailed attendance

5. **Click to Collapse**
   - Card should collapse smoothly
   - Returns to original state
   - Can expand again

### Edge Cases Handled

- ✅ No attendance data (shows "No data available")
- ✅ No classes (shows empty state)
- ✅ Loading state (shows spinner)
- ✅ Class without recorded attendance (shows 0 of X)
- ✅ Very long class list (scrollable)
- ✅ Mobile responsive (works on small screens)

## Accessibility

- ✅ Keyboard accessible (can tab through)
- ✅ Clear visual indicators (chevrons)
- ✅ Proper ARIA labels
- ✅ Hover states for interactive elements
- ✅ Good color contrast
- ✅ Descriptive text for screen readers

## Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS/Android)

## Summary

✅ **Expandable cards** for Present/Absent attendance  
✅ **Class-by-class breakdown** with visual progress bars  
✅ **No additional queries** - uses existing data  
✅ **Smooth animations** with Framer Motion  
✅ **Clickable class rows** for detailed navigation  
✅ **Mobile responsive** design  

**The dashboard now provides actionable attendance insights without leaving the page!** 🎯

Last Updated: {{ DATE }}

