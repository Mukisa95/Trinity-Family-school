import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import type { 
  EventAttendanceDocument, 
  PupilAttendanceFormData, 
  StaffAttendanceFormData, 
  ParentAttendanceFormData,
  PupilAttendanceEntry,
  StaffAttendanceEntry,
  ParentAttendanceEntry
} from '@/types/attendance';
import type { Event } from '@/types';

// Hook to fetch event attendance document
export function useEventAttendance(eventId: string) {
  const [attendanceDoc, setAttendanceDoc] = useState<EventAttendanceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const fetchAttendance = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const docRef = doc(db, 'eventAttendance', eventId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Convert Firestore timestamps to Date objects
          const convertToDate = (value: any): Date => {
            if (!value) return new Date();
            if (value instanceof Date) return value;
            if (value.toDate && typeof value.toDate === 'function') return value.toDate();
            if (typeof value === 'string') return new Date(value);
            return new Date();
          };

          const attendanceDoc: EventAttendanceDocument = {
            ...data,
            eventDate: convertToDate(data.eventDate),
            lastUpdated: convertToDate(data.lastUpdated),
            createdAt: convertToDate(data.createdAt),
            pupils: data.pupils?.map((p: any) => ({
              ...p,
              recordedAt: convertToDate(p.recordedAt)
            })) || [],
            staff: data.staff?.map((s: any) => ({
              ...s,
              recordedAt: convertToDate(s.recordedAt)
            })) || [],
            parents: data.parents?.map((p: any) => ({
              ...p,
              recordedAt: convertToDate(p.recordedAt)
            })) || []
          } as EventAttendanceDocument;
          
          setAttendanceDoc(attendanceDoc);
        } else {
          setAttendanceDoc(null);
        }
      } catch (err) {
        console.error('Error fetching event attendance:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [eventId]);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const docRef = doc(db, 'eventAttendance', eventId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const convertToDate = (value: any): Date => {
          if (!value) return new Date();
          if (value instanceof Date) return value;
          if (value.toDate && typeof value.toDate === 'function') return value.toDate();
          if (typeof value === 'string') return new Date(value);
          return new Date();
        };

        const attendanceDoc: EventAttendanceDocument = {
          ...data,
          eventDate: convertToDate(data.eventDate),
          lastUpdated: convertToDate(data.lastUpdated),
          createdAt: convertToDate(data.createdAt),
          pupils: data.pupils?.map((p: any) => ({
            ...p,
            recordedAt: convertToDate(p.recordedAt)
          })) || [],
          staff: data.staff?.map((s: any) => ({
            ...s,
            recordedAt: convertToDate(s.recordedAt)
          })) || [],
          parents: data.parents?.map((p: any) => ({
            ...p,
            recordedAt: convertToDate(p.recordedAt)
          })) || []
        } as EventAttendanceDocument;
        
        setAttendanceDoc(attendanceDoc);
      } else {
        setAttendanceDoc(null);
      }
    } catch (err) {
      console.error('Error fetching event attendance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return { attendanceDoc, loading, error, refetch };
}

// Helper function to calculate summary statistics
function calculateSummary(
  pupils: PupilAttendanceEntry[],
  staff: StaffAttendanceEntry[],
  parents: ParentAttendanceEntry[]
) {
  const pupilStats = pupils.reduce(
    (acc, p) => {
      acc.total++;
      if (p.status === 'present') acc.present++;
      else if (p.status === 'absent') acc.absent++;
      else if (p.status === 'late') acc.late++;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0 }
  );

  const staffStats = staff.reduce(
    (acc, s) => {
      acc.total++;
      if (s.status === 'present') acc.present++;
      else if (s.status === 'absent') acc.absent++;
      else if (s.status === 'late') acc.late++;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0 }
  );

  const parentStats = parents.reduce(
    (acc, p) => {
      acc.total++;
      if (p.status === 'present') acc.present++;
      else if (p.status === 'absent') acc.absent++;
      else if (p.status === 'late') acc.late++;
      return acc;
    },
    { total: 0, present: 0, absent: 0, late: 0 }
  );

  return {
    totalPupils: pupilStats.total,
    presentPupils: pupilStats.present,
    absentPupils: pupilStats.absent,
    latePupils: pupilStats.late,
    totalStaff: staffStats.total,
    presentStaff: staffStats.present,
    absentStaff: staffStats.absent,
    lateStaff: staffStats.late,
    totalParentGroups: parentStats.total,
    presentParentGroups: parentStats.present,
    absentParentGroups: parentStats.absent,
    lateParentGroups: parentStats.late,
  };
}

// Hook to record pupil attendance
export function useRecordPupilAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const recordAttendance = async (eventId: string, event: Event, formData: PupilAttendanceFormData) => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const docRef = doc(db, 'eventAttendance', eventId);
      const docSnap = await getDoc(docRef);

      const newPupilEntries: PupilAttendanceEntry[] = formData.pupils.map(pupil => ({
        pupilId: pupil.pupilId,
        pupilName: pupil.pupilName,
        className: formData.className,
        status: pupil.status,
        recordedAt: new Date(),
        recordedBy: user.id
      }));

      if (docSnap.exists()) {
        // Update existing document
        const existingData = docSnap.data() as EventAttendanceDocument;
        
        // Remove existing pupil records from the same class to avoid duplicates
        const filteredPupils = (existingData.pupils || []).filter(
          p => p.className !== formData.className
        );
        
        const updatedPupils = [...filteredPupils, ...newPupilEntries];
        const summary = calculateSummary(
          updatedPupils,
          existingData.staff || [],
          existingData.parents || []
        );

        await updateDoc(docRef, cleanObject({
          pupils: updatedPupils,
          summary,
          lastUpdated: serverTimestamp()
        }));
      } else {
        // Create new document
        const summary = calculateSummary(newPupilEntries, [], []);
        
        const newDoc: Omit<EventAttendanceDocument, 'eventDate' | 'lastUpdated' | 'createdAt'> = {
          eventId,
          eventName: event.title,
          pupils: newPupilEntries,
          staff: [],
          parents: [],
          summary
        };

        await setDoc(docRef, cleanObject({
          ...newDoc,
          eventDate: event.startDate,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        }));
      }

      return true;
    } catch (err) {
      console.error('Error recording pupil attendance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { recordAttendance, loading, error };
}

// Hook to record staff attendance
export function useRecordStaffAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const recordAttendance = async (eventId: string, event: Event, formData: StaffAttendanceFormData) => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const docRef = doc(db, 'eventAttendance', eventId);
      const docSnap = await getDoc(docRef);

      const newStaffEntries: StaffAttendanceEntry[] = formData.staff.map(staff => ({
        staffId: staff.staffId,
        staffName: staff.staffName,
        position: staff.position,
        department: staff.department,
        email: staff.email,
        status: staff.status,
        recordedAt: new Date(),
        recordedBy: user.id
      }));

      if (docSnap.exists()) {
        // Update existing document
        const existingData = docSnap.data() as EventAttendanceDocument;
        
        const summary = calculateSummary(
          existingData.pupils || [],
          newStaffEntries,
          existingData.parents || []
        );

        await updateDoc(docRef, cleanObject({
          staff: newStaffEntries,
          summary,
          lastUpdated: serverTimestamp()
        }));
      } else {
        // Create new document
        const summary = calculateSummary([], newStaffEntries, []);
        
        const newDoc: Omit<EventAttendanceDocument, 'eventDate' | 'lastUpdated' | 'createdAt'> = {
          eventId,
          eventName: event.title,
          pupils: [],
          staff: newStaffEntries,
          parents: [],
          summary
        };

        await setDoc(docRef, cleanObject({
          ...newDoc,
          eventDate: event.startDate,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        }));
      }

      return true;
    } catch (err) {
      console.error('Error recording staff attendance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { recordAttendance, loading, error };
}

// Helper function to remove undefined values from objects
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanObject);
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObject(value);
    }
  }
  return cleaned;
}

// Hook to record parent attendance
export function useRecordParentAttendance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const recordAttendance = async (eventId: string, event: Event, formData: ParentAttendanceFormData) => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const docRef = doc(db, 'eventAttendance', eventId);
      const docSnap = await getDoc(docRef);

      const newParentEntries: ParentAttendanceEntry[] = formData.groups.map(group => cleanObject({
        id: `${group.pupilId}_${Date.now()}`, // Simple unique ID
        pupilId: group.pupilId,
        pupilName: group.pupilName,
        className: group.className,
        attendees: group.attendees,
        status: group.status,
        recordedAt: new Date(),
        recordedBy: user.id
      }));

      if (docSnap.exists()) {
        // Update existing document
        const existingData = docSnap.data() as EventAttendanceDocument;
        
        // Append new parent entries
        const updatedParents = [...(existingData.parents || []), ...newParentEntries];
        
        const summary = calculateSummary(
          existingData.pupils || [],
          existingData.staff || [],
          updatedParents
        );

        await updateDoc(docRef, cleanObject({
          parents: updatedParents,
          summary,
          lastUpdated: serverTimestamp()
        }));
      } else {
        // Create new document
        const summary = calculateSummary([], [], newParentEntries);
        
        const newDoc: Omit<EventAttendanceDocument, 'eventDate' | 'lastUpdated' | 'createdAt'> = {
          eventId,
          eventName: event.title,
          pupils: [],
          staff: [],
          parents: newParentEntries,
          summary
        };

        await setDoc(docRef, cleanObject({
          ...newDoc,
          eventDate: event.startDate,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp()
        }));
      }

      return true;
    } catch (err) {
      console.error('Error recording parent attendance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { recordAttendance, loading, error };
}

// Hook to get already recorded pupils for a specific class (to filter them out)
export function useRecordedPupils(eventId: string, classId: string) {
  const [recordedPupils, setRecordedPupils] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !classId) {
      setLoading(false);
      return;
    }

    const fetchRecordedPupils = async () => {
      try {
        setLoading(true);
        
        const docRef = doc(db, 'eventAttendance', eventId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as EventAttendanceDocument;
          const classPupils = (data.pupils || [])
            .filter(p => p.className === classId)
            .map(p => p.pupilId);
          setRecordedPupils(classPupils);
        } else {
          setRecordedPupils([]);
        }
      } catch (err) {
        console.error('Error fetching recorded pupils:', err);
        setRecordedPupils([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordedPupils();
  }, [eventId, classId]);

  return { recordedPupils, loading };
}
