# Dynamic Attendance Selector Enhancement

## Overview
Enhanced the parent attendance dashboard with a dynamic selector that changes based on the selected view mode, providing context-aware filtering options.

## 🎯 Dynamic Selector Behavior

### **Daily View** 📅
- **Selector Type**: Date Selector
- **Options**: Last 30 days with full date format
- **Format**: "Monday, January 15, 2024"
- **Default**: Today's date
- **Example**: 
  - Today (Current)
  - Monday, January 15, 2024
  - Sunday, January 14, 2024
  - Saturday, January 13, 2024

### **Weekly View** 📊
- **Selector Type**: Week Selector
- **Options**: Last 12 weeks with week range
- **Format**: "Week of Jan 15 - Jan 21, 2024"
- **Default**: Current week
- **Example**:
  - Week of Jan 15 - Jan 21, 2024 (Current)
  - Week of Jan 8 - Jan 14, 2024
  - Week of Jan 1 - Jan 7, 2024

### **Monthly View** 📈
- **Selector Type**: Month Selector
- **Options**: Last 12 months
- **Format**: "January 2024"
- **Default**: Current month
- **Example**:
  - January 2024 (Current)
  - December 2023
  - November 2023

### **Yearly View** 🎓
- **Selector Type**: Academic Year Selector
- **Options**: All available academic years
- **Format**: "2024" or "2024 (Current)"
- **Default**: Active academic year
- **Example**:
  - 2024 (Current)
  - 2023
  - 2022

### **Term View** 📚
- **Selector Type**: Term Selector
- **Options**: Terms from selected academic year
- **Format**: "Term 1" or "Term 1 (Current)"
- **Default**: Current term
- **Example**:
  - Term 1 (Current)
  - Term 2
  - Term 3

## 🔧 Technical Implementation

### State Management
```typescript
const [selectedDate, setSelectedDate] = useState<string>('');
const [selectedWeek, setSelectedWeek] = useState<string>('');
const [selectedMonth, setSelectedMonth] = useState<string>('');
const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
const [selectedTermId, setSelectedTermId] = useState<string>('');
```

### Dynamic Options Generation
```typescript
const dynamicOptions = useMemo(() => {
  const now = new Date();
  
  switch (viewMode) {
    case 'daily':
      // Generate last 30 days
      return Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        return {
          value: format(date, 'yyyy-MM-dd'),
          label: format(date, 'EEEE, MMMM dd, yyyy'),
          isCurrent: i === 0
        };
      });
      
    case 'weekly':
      // Generate last 12 weeks
      return Array.from({ length: 12 }, (_, i) => {
        const weekStart = startOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        return {
          value: format(weekStart, 'yyyy-MM-dd'),
          label: `Week of ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`,
          isCurrent: i === 0
        };
      });
      
    // ... other cases
  }
}, [viewMode, academicYears, availableTerms]);
```

### Dynamic Value Management
```typescript
const getCurrentDynamicValue = () => {
  switch (viewMode) {
    case 'daily': return selectedDate;
    case 'weekly': return selectedWeek;
    case 'monthly': return selectedMonth;
    case 'yearly': return selectedAcademicYearId;
    case 'term': return selectedTermId;
    default: return '';
  }
};

const handleDynamicSelectionChange = (value: string) => {
  switch (viewMode) {
    case 'daily': setSelectedDate(value); break;
    case 'weekly': setSelectedWeek(value); break;
    case 'monthly': setSelectedMonth(value); break;
    case 'yearly': setSelectedAcademicYearId(value); break;
    case 'term': setSelectedTermId(value); break;
  }
};
```

## 🎨 User Interface Changes

### Controls Layout
- **Before**: 3-column grid (Academic Year, Term, View Mode)
- **After**: 2-column grid (Academic Year, View Mode) + Dynamic Selector below

### Dynamic Selector Features
1. **Context-Aware Label**: Changes based on view mode
   - "Select Date" for daily view
   - "Select Week" for weekly view
   - "Select Month" for monthly view
   - "Select Academic Year" for yearly view
   - "Select Term" for term view

2. **Smart Placeholder**: Dynamic placeholder text
3. **Current Indicators**: Shows "(Current)" for current selections
4. **Responsive Design**: Works on all screen sizes

### Enhanced Context Display
The attendance records title now shows:
- **Daily**: "Attendance Records (daily) • 2024 • Jan 15, 2024"
- **Weekly**: "Attendance Records (weekly) • 2024 • Week of Jan 15"
- **Monthly**: "Attendance Records (monthly) • 2024 • January 2024"
- **Yearly**: "Attendance Records (yearly) • 2024"
- **Term**: "Attendance Records (term) • 2024 • Term 1"

## 🔄 Data Flow

### View Mode Changes
1. User changes view mode
2. Dynamic selector updates with new options
3. Default selection is set (current date/week/month/year/term)
4. Attendance data filters accordingly

### Dynamic Selection Changes
1. User selects a different option
2. State updates for the specific view mode
3. Attendance statistics recalculate
4. Records list updates to show filtered data

### Academic Year Changes
1. User changes academic year
2. Term options update (if in term view)
3. All other selections remain unchanged
4. Data refilters based on new academic year

## 📊 Benefits

### For Parents
- **Intuitive Navigation**: Selector changes to match the view mode
- **Historical Access**: Easy access to past dates, weeks, months
- **Context Awareness**: Clear indication of what's being selected
- **Flexible Viewing**: Multiple granularity levels for data exploration

### For System
- **Reduced Complexity**: Single dynamic selector instead of multiple static ones
- **Better UX**: Context-aware interface reduces confusion
- **Scalable Design**: Easy to add new view modes in the future
- **Consistent Behavior**: Uniform interaction pattern across all view modes

## 🚀 Future Enhancements

### Potential Additions
1. **Custom Date Range**: Allow parents to select custom date ranges
2. **Quick Actions**: "Last 7 days", "This month", "Previous term" buttons
3. **Calendar Integration**: Visual calendar picker for date selection
4. **Saved Views**: Allow parents to save frequently used selections
5. **Export by Period**: Export attendance data for selected periods

### Technical Improvements
1. **Virtual Scrolling**: For large option lists (e.g., 365 days)
2. **Search Functionality**: Search within date/week/month options
3. **Keyboard Navigation**: Arrow keys for quick selection
4. **URL State**: Sync selections with URL parameters
5. **Caching**: Cache generated options for better performance
