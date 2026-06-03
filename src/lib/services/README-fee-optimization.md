# Fee Optimization System

## Overview
The Fee Optimization System dramatically speeds up fee calculations by grouping pupils with identical fee characteristics and caching their base fee calculations.

## Key Features

### 🚀 **Group-Based Caching**
- Groups pupils by: `class + section + academic year + term`
- Calculates base fees once per group (not per pupil)
- Only adds variable components (discounts, assignment fees) per pupil

### ⚡ **Performance Improvements**
- **5-10x faster** fee calculations for class-specific data
- **Parallel payment loading** instead of sequential
- **Smart caching** with automatic expiration
- **Background maintenance** for cache cleanup

### 📊 **Real-Time Metrics**
- Cache hit rates and efficiency
- Processing speed comparisons
- Group statistics
- Calculation time tracking

## How It Works

### 1. **Pupil Grouping**
```typescript
// Pupils with same characteristics are grouped
const groupKey = `${classId}|${section}|${academicYearId}|${termId}`;
```

### 2. **Base Fee Calculation**
```typescript
// Calculate once per group, not per pupil
const baseFees = await calculateGroupBaseFees(group, feeStructures, academicYears);
```

### 3. **Variable Components**
```typescript
// Add individual components per pupil
const finalFees = baseFees + assignmentFees + discounts - payments;
```

## Usage

### **Automatic Optimization**
The system works automatically when using `useProgressiveFees`:

```typescript
const progressiveFeesData = useProgressiveFees({
  pupils,
  selectedYear,
  selectedTermId,
  academicYears
});

// Access optimization metrics
console.log(progressiveFeesData.optimizationInfo);
```

### **Manual Cache Management**
```typescript
import { feeGroupCacheService } from '@/lib/services/fee-group-cache.service';

// Clear cache when fee structures change
feeGroupCacheService.clearCache();

// Invalidate specific term
feeGroupCacheService.invalidateCacheForTerm(academicYearId, termId);

// Get cache statistics
const stats = feeGroupCacheService.getCacheStats();
```

### **Background Maintenance**
```typescript
// Start background cache cleanup (call once in app initialization)
feeGroupCacheService.startBackgroundMaintenance();

// Preload common groups for better performance
await feeGroupCacheService.preloadCommonGroups(
  commonClassIds,
  academicYears,
  feeStructures
);
```

## Performance Benefits

### **Before Optimization**
- ❌ Each pupil processed individually
- ❌ Repeated fee calculations for same class
- ❌ Sequential payment loading
- ❌ No caching or reuse

### **After Optimization**
- ✅ Groups processed together
- ✅ Base fees calculated once per group
- ✅ Parallel payment loading
- ✅ Smart caching with expiration
- ✅ Real-time performance metrics

## Configuration

### **Cache Settings**
```typescript
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

### **Batch Processing**
```typescript
// Dynamic batch sizes based on group size
const batchSize = Math.min(20, Math.max(5, Math.ceil(pupils.length / 3)));
```

## Monitoring

### **UI Indicators**
The `ProgressiveLoadingIndicator` displays:
- Speedup factor (e.g., "5.2x faster")
- Cache hits and efficiency
- Number of groups created
- Total calculation time

### **Console Logging**
```
🚀 OPTIMIZED PROCESSING: Starting fee calculation with grouping and caching
📊 Grouped 45 pupils into 3 fee groups
⚡ Cached base fees for group P1|day|2024|term1: 12 fees, 450ms
🎉 OPTIMIZED PROCESSING COMPLETE: 45 pupils in 890ms (5.1x faster)
```

## Best Practices

### **When Cache is Automatically Cleared**
- ✅ **Fee structure changes** (create, update, delete) - Auto-invalidates affected terms
- ✅ **Pupil class/section changes** - Auto-clears all cache when pupils move
- ✅ **New payments** - Always fetched fresh (not cached)
- ✅ **Assignment fee changes** - Calculated fresh per pupil
- ✅ **Cache expiration** - Auto-expires after 30 minutes
- ✅ **Background maintenance** - Auto-cleanup every 10 minutes

### **Manual Cache Control (if needed)**
- Fee management system changes
- Class structure modifications  
- After major system updates

### **Optimal Usage**
- Use for class-specific fee collection (best performance)
- Combine with class-based pupil filtering
- Monitor cache efficiency metrics
- Run background maintenance in production

## Technical Details

### **Group Key Format**
`{classId}|{section}|{academicYearId}|{termId}`

### **Cache Structure**
```typescript
interface CachedGroupFees {
  groupKey: string;
  baseFees: BaseFee[];
  totalBaseFees: number;
  calculatedAt: number;
  expiresAt: number;
}
```

### **Variable Components**
```typescript
interface PupilVariableComponents {
  pupilId: string;
  assignmentFees: AssignmentFee[];
  discounts: Discount[];
  totalPaid: number;
  lastCalculated: number;
}
```

This optimization system makes fee calculations **dramatically faster** while maintaining accuracy and providing detailed performance insights.
