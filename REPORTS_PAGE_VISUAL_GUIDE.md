# Reports Page - Visual Guide

## 📱 Page Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard    [Print]  [Export PDF]               │
│  📊 Reports & Analytics                                      │
│  School Management System                                    │
├─────────────────────────────────────────────────────────────┤
│  [Report Type ▼]  [Time Range ▼]                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   674    │  │    12    │  │    45    │  │   Term   │   │
│  │  Pupils  │  │ Classes  │  │  Staff   │  │  Period  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ 📈 Enrollment Trend  │  │ 🥧 Gender Split      │        │
│  │                      │  │                      │        │
│  │  [Area Chart]        │  │  [Pie Chart]         │        │
│  │                      │  │  Male: 314 (47%)     │        │
│  │                      │  │  Female: 360 (53%)   │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ 📚 Class Sizes       │  │ 🏠 Day vs Boarding   │        │
│  │                      │  │                      │        │
│  │  [Bar Chart]         │  │  [Pie Chart]         │        │
│  │                      │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ 📅 Age Groups        │  │ 👥 Staff Roles       │        │
│  │                      │  │                      │        │
│  │  [Bar Chart]         │  │  [Horizontal Bar]    │        │
│  │                      │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  📄 Summary Report                                           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  674   │ │  56.2  │ │   12   │ │ 314:360│ │   45   │   │
│  │Enrolled│ │Avg Size│ │Classes │ │ Gender │ │ Staff  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Statistics Cards
```
┌────────────────┐
│ 🔵 BLUE        │  Total Pupils
│ Gradient       │  
└────────────────┘

┌────────────────┐
│ 🟣 PURPLE      │  Total Classes
│ Gradient       │
└────────────────┘

┌────────────────┐
│ 🟢 GREEN       │  Staff Members
│ Gradient       │
└────────────────┘

┌────────────────┐
│ 🟠 ORANGE      │  Report Period
│ Gradient       │
└────────────────┘
```

## 📊 Chart Details

### 1. Enrollment Trend (Area Chart)
```
    Pupils
    800 ┤      ╭─────
    700 ┤    ╭─╯
    600 ┤  ╭─╯
    500 ┤╭─╯
        └─┴─┴─┴─┴─┴─┴─
         J F M A M J J
         
Blue gradient fill
Shows growth over time
Interactive tooltips
```

### 2. Gender Distribution (Pie Chart)
```
        ╭───────╮
      ╱   Male   ╲
     │    47%     │
     │            │
      ╲  Female  ╱
        ╰───────╯
          53%

Blue for Male
Pink for Female
Percentage labels
Legend included
```

### 3. Class Size Distribution (Bar Chart)
```
P1  ████████████████ 65
P2  ██████████████ 58
P3  █████████████ 55
P4  ████████████ 52
P5  ███████████ 48
P6  ██████████ 45

Green bars for pupils
Yellow bars for capacity
Horizontal comparison
```

### 4. Section Distribution (Pie Chart)
```
        ╭────────╮
      ╱    Day    ╲
     │     65%     │
     │             │
      ╲ Boarding  ╱
        ╰────────╯
          35%

Cyan for Day
Orange for Boarding
Clear percentages
```

### 5. Age Distribution (Bar Chart)
```
Under 6  ██████ 25
6-8      █████████████ 150
9-11     ████████████████ 220
12-14    ████████████████ 200
15+      ████████ 79

Multi-colored bars
Age range grouping
Easy to understand
```

### 6. Staff by Role (Horizontal Bar Chart)
```
Teacher    ████████████████ 25
Admin      ████ 5
Support    ██████ 8
Head       ██ 2

Different colors per role
Horizontal layout
Role comparison
```

## 🎯 Interactive Elements

### Filters
```
┌─────────────────────┐  ┌─────────────────────┐
│ Report Type      ▼  │  │ Time Range       ▼  │
├─────────────────────┤  ├─────────────────────┤
│ • Overview          │  │ • This Week         │
│ • Pupils Analysis   │  │ • This Month        │
│ • Fees Collection   │  │ • This Term     ✓   │
│ • Attendance        │  │ • This Year         │
│ • Staff Analysis    │  │                     │
└─────────────────────┘  └─────────────────────┘
```

### Action Buttons
```
┌────────────────┐  ┌─────────────────┐
│ 🖨️  Print      │  │ ⬇️  Export PDF  │
└────────────────┘  └─────────────────┘
```

### Navigation
```
┌──────────────────────┐
│ ← Back to Dashboard  │
└──────────────────────┘
```

## 📱 Responsive Behavior

### Desktop (1920px+)
```
[4 stat cards in a row]
[2 charts per row × 3 rows]
[Summary section full width]
```

### Tablet (768px - 1023px)
```
[2 stat cards per row]
[2 charts per row]
[Summary section full width]
```

### Mobile (< 768px)
```
[1 stat card per row]
[1 chart per row]
[Summary section full width]
```

## 🎭 Animations

### On Page Load
```
Statistics Cards: Fade in + Slide up (staggered)
   Card 1: 0.1s delay
   Card 2: 0.2s delay
   Card 3: 0.3s delay
   Card 4: 0.4s delay

Charts: Fade in + Scale up (staggered)
   Chart 1: 0.5s delay
   Chart 2: 0.6s delay
   Chart 3: 0.7s delay
   Chart 4: 0.8s delay
   Chart 5: 0.9s delay
   Chart 6: 1.0s delay

Summary: Fade in + Slide up
   1.1s delay
```

### On Hover
```
Cards: Scale up 1.05×
Buttons: Shadow increase
Charts: Tooltip appears
```

## 🎨 Color Palette Reference

```css
Primary (Blue):    #3B82F6  ████
Secondary (Purple): #8B5CF6  ████
Success (Green):   #10B981  ████
Warning (Orange):  #F59E0B  ████
Danger (Red):      #EF4444  ████
Info (Cyan):       #06B6D4  ████
Purple:            #A855F7  ████
Pink:              #EC4899  ████
Orange:            #F97316  ████
Teal:              #14B8A6  ████
```

## 📊 Data Flow

```
Database
    ↓
Hooks (useActivePupils, useClasses, useStaff)
    ↓
useMemo (Calculate statistics)
    ↓
Charts (Recharts components)
    ↓
User Interface
```

## 🖼️ Summary Section Layout

```
┌───────────────────────────────────────────────────────────┐
│  📄 Summary Report                                        │
│  Key insights and statistics                              │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   674   │  │  56.2   │  │   12    │  │ 314:360 │    │
│  │ Enrolled│  │Avg Class│  │ Classes │  │  Gender │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                            │
│  ┌─────────┐  ┌─────────┐                                │
│  │   45    │  │  1:15   │                                │
│  │  Staff  │  │ Staff:  │                                │
│  │ Members │  │ Pupils  │                                │
│  └─────────┘  └─────────┘                                │
└───────────────────────────────────────────────────────────┘
```

## 🎉 User Experience Flow

1. **Click "Reports" on Dashboard**
   → Beautiful loading animation

2. **Page Loads**
   → Statistics cards animate in
   → Charts render with data
   → Everything color-coded

3. **Interact with Filters**
   → Change report type
   → Adjust time range
   → Data updates (future feature)

4. **View Insights**
   → Hover over charts for details
   → Read summary statistics
   → Identify trends

5. **Export/Print**
   → Click Print for hard copy
   → Click Export for PDF (future)

6. **Return to Dashboard**
   → Click back button
   → Smooth navigation

## 🎁 What Makes It Special

✨ **Beautiful Design**: Modern, professional appearance
📊 **Real Data**: Live statistics from your database
🎨 **Color Coded**: Easy visual identification
📱 **Responsive**: Works on all devices
⚡ **Fast**: Smooth animations and loading
🖱️ **Interactive**: Hover for more details
🖨️ **Printable**: Print-optimized layout
📈 **Insightful**: Clear data visualizations

## 🚀 Ready to Explore!

Navigate to `/reports` or click the Reports card on your dashboard to see it in action!

