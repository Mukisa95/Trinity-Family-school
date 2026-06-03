import { useMemo } from 'react';
import { useActivePupils, usePupils } from './use-pupils';

// 🚀 OPTIMIZED: Use database-level filtering for active pupils
export function usePupilsCount() {
  // Use the optimized active pupils query instead of fetching all pupils
  const { data: activePupils = [] } = useActivePupils();
  // Only fetch all pupils if we need inactive count
  const { data: allPupils = [] } = usePupils();
  
  return useMemo(() => {
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');
    
    return {
      total: activePupils.length,
      male: malePupils.length,
      female: femalePupils.length,
      inactive: allPupils.filter(p => p.status === 'Inactive').length,
      all: allPupils.length
    };
  }, [activePupils, allPupils]);
}

// 🚀 NEW: Optimized version that only counts active pupils (no inactive count)
// Use this on dashboard for better performance
export function useActivePupilsCount() {
  const { data: activePupils = [] } = useActivePupils();
  
  return useMemo(() => {
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');
    
    return {
      total: activePupils.length,
      male: malePupils.length,
      female: femalePupils.length,
    };
  }, [activePupils]);
} 