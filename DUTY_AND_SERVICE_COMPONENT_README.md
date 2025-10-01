# 🎯 Duty and Service Component

## Overview

The Duty and Service Component is a comprehensive management system for handling leadership positions, duty rotas, assessments, and performance rankings in the school management system. It provides a complete workflow for managing prefectoral positions, duty assignments, and performance tracking.

## 🚀 Features

### 1. **Prefectoral Management**
- Create and manage leadership positions (prefects)
- Define post names, positions of honor, and reign durations
- Set optional allowances for positions
- Assign/reassign pupils to posts with start/end dates
- Track history of pupils who held each post

### 2. **Duty Management**
- Create duty workflows (rotas) for staff, prefects, or pupils
- Define duty names, involved teams, and frequency
- Set team-specific allowances
- Manage date ranges and academic year integration
- Archive old rotas while keeping history

### 3. **Duty Assessment**
- Assign members to duty ranges (weekly, monthly, etc.)
- Assign supervisors for duty cycles
- Flexible assignment options (entire duration or per-week)
- Track duty performance and attendance

### 4. **Operations**
- **Prefectoral Body View**: Tree structure and list hierarchy
- **Duty Rota View**: Calendar/list view with team members and supervisors
- **Polls & Reviews**: Staff voting system for best performers
- Real-time updates and notifications

### 5. **Collage (Performance Rankings)**
- Dynamic leaderboards for staff and prefects
- Historical rankings with cumulative performance
- Charts and progress graphs
- Monthly, termly, and yearly performance tracking

## 🛠️ Technical Implementation

### **File Structure**
```
src/
├── app/duty-service/
│   └── page.tsx                    # Main component page
├── components/duty-service/
│   ├── PrefectoralManagement/
│   │   └── CreatePrefectoralPostModal.tsx
│   ├── DutyManagement/
│   │   └── CreateDutyRotaModal.tsx
│   └── Operations/
│       └── CreatePollModal.tsx
├── lib/
│   ├── services/
│   │   └── duty-service.service.ts # Firebase service layer
│   └── hooks/
│       └── use-duty-service.ts     # React Query hooks
└── types/
    └── duty-service.ts             # TypeScript definitions
```

### **Key Technologies**
- **Firebase Firestore**: Database for all duty and service data
- **React Query**: Data fetching, caching, and state management
- **TypeScript**: Type-safe development with comprehensive interfaces
- **Digital Signatures**: Audit trails for all mutations
- **Granular Permissions**: Module-level access control

### **Data Models**

#### **PrefectoralPost**
```typescript
interface PrefectoralPost {
  id: string;
  postName: string;
  positionOfHonour: PositionOfHonour; // 1-5 ranking
  reignDuration: ReignDuration; // termly, yearly, custom
  allowance?: number;
  academicYearId: string;
  termId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
```

#### **DutyRota**
```typescript
interface DutyRota {
  id: string;
  dutyName: string;
  teamsInvolved: TeamType[]; // staff, prefects, pupils
  frequency: DutyFrequency; // one_time, daily, weekly, etc.
  startDate: string;
  endDate: string;
  allowances: {
    staff: number;
    prefects: number;
    pupils: number;
  };
  academicYearId: string;
  termId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
```

#### **Poll**
```typescript
interface Poll {
  id: string;
  pollType: PollType; // best_staff, best_prefect, best_pupil
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  academicYearId: string;
  voters: PollVoter[];
  results: PollResult[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
```

## 🔐 Permissions

The component uses the existing granular permissions system:

- **Module Access**: `duty_service`
- **Page Permissions**: 
  - `prefectoral` - Prefectoral management
  - `duty_management` - Duty rota management
  - `assessment` - Duty assignments
  - `operations` - Operations and polls
  - `collage` - Performance rankings

- **Action Permissions**:
  - `create_prefectoral_post`
  - `update_prefectoral_post`
  - `delete_prefectoral_post`
  - `create_duty_rota`
  - `update_duty_rota`
  - `delete_duty_rota`
  - `assign_member_to_duty`
  - `create_poll`
  - `vote_in_poll`
  - `create_performance_ranking`

## 🚀 Getting Started

### **1. Access the Component**
Navigate to the sidebar and click on "Duty & Service" (Shield icon) to access the component.

### **2. Create Your First Prefectoral Post**
1. Go to the "Prefectoral" tab
2. Click "Create Post" button
3. Fill in the post details:
   - Post Name (e.g., "Head Prefect")
   - Position of Honour (1-5 ranking)
   - Reign Duration (termly, yearly, custom)
   - Optional allowance amount
4. Click "Create Post"

### **3. Create a Duty Rota**
1. Go to the "Duty Management" tab
2. Click "Create Rota" button
3. Fill in the rota details:
   - Duty Name (e.g., "Staff Weekly Duty")
   - Select teams involved (staff, prefects, pupils)
   - Set frequency and date range
   - Configure allowances for each team
4. Click "Create Rota"

### **4. Assign Members to Duties**
1. Go to the "Assessment" tab
2. Click "Assign Member" button
3. Select the duty rota and member
4. Set start and end dates
5. Assign supervisor role if needed

### **5. Create Polls**
1. Go to the "Operations" tab
2. Click "Create Poll" button
3. Select poll type and set voting period
4. Staff can vote for best performers

### **6. View Performance Rankings**
1. Go to the "Collage" tab
2. View dynamic leaderboards
3. Analyze historical performance data

## 🔧 Integration

### **Salary Component Integration**
- Prefectoral allowances automatically reflected in salaries
- Duty allowances integrated with staff compensation
- Performance bonuses from polls can be linked to salary adjustments

### **Procurement Component Integration**
- Duty and service allowances automatically budgeted
- Staff/pupil allowance categories in procurement system

### **Academic Year Integration**
- All data tied to specific academic years
- Term-based organization and filtering
- Historical data preservation across years

## 📊 Firebase Indexes

The component requires the following Firebase indexes for optimal performance:

```json
{
  "collectionGroup": "prefectoralPosts",
  "fields": [
    {"fieldPath": "academicYearId", "order": "ASCENDING"},
    {"fieldPath": "positionOfHonour", "order": "ASCENDING"}
  ]
},
{
  "collectionGroup": "dutyRotas", 
  "fields": [
    {"fieldPath": "academicYearId", "order": "ASCENDING"},
    {"fieldPath": "dutyName", "order": "ASCENDING"}
  ]
},
{
  "collectionGroup": "polls",
  "fields": [
    {"fieldPath": "academicYearId", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
}
```

## 🎯 Success Metrics

- **User Adoption**: Number of active prefectoral posts and duty rotas
- **Performance Tracking**: Completion rates of assigned duties
- **Engagement**: Poll participation rates
- **Efficiency**: Time saved in duty management and assignment
- **Data Quality**: Accuracy of performance rankings and historical data

## 🔄 Future Enhancements

- **Mobile App Integration**: Duty assignments and voting on mobile
- **Automated Notifications**: Reminders for duty assignments and polls
- **Advanced Analytics**: Detailed performance insights and trends
- **Integration APIs**: Connect with external school management systems
- **Reporting Dashboard**: Comprehensive reports and exports

## 🐛 Troubleshooting

### **Common Issues**

1. **Firebase Index Errors**
   - Deploy indexes: `firebase deploy --only firestore:indexes`
   - Check console for specific index requirements

2. **Permission Denied**
   - Verify user has `duty_service` module access
   - Check specific page and action permissions

3. **Data Not Loading**
   - Check Firebase connection
   - Verify academic year is set
   - Check browser console for errors

4. **Modal Not Opening**
   - Verify ActionGuard permissions
   - Check for JavaScript errors in console

### **Support**

For technical issues or feature requests, please refer to the main project documentation or contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: August 2025  
**Status**: ✅ Production Ready
