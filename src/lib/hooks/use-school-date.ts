'use client';

import { useEffect, useState } from 'react';
import { getSchoolClock } from '@/lib/dashboard/teacher-day';

/** Only changes state at school-local midnight, including after a suspended tab resumes. */
export function useSchoolDate() {
  const [date, setDate] = useState(() => getSchoolClock().date);
  useEffect(() => {
    const update = () => setDate(getSchoolClock().date);
    const timer = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return date;
}
