import { useMemo } from 'react';
import { usePupils } from './use-pupils';

export function usePupilsCount() {
  const { data: pupils = [] } = usePupils();
  
  return useMemo(() => {
    const activePupils = pupils.filter(p => p.status === 'Active');
    const malePupils = activePupils.filter(p => p.gender === 'Male');
    const femalePupils = activePupils.filter(p => p.gender === 'Female');
    
    return {
      total: activePupils.length,
      male: malePupils.length,
      female: femalePupils.length,
      inactive: pupils.filter(p => p.status === 'Inactive').length,
      all: pupils.length
    };
  }, [pupils]);
} 