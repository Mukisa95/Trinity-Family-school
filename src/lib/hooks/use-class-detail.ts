import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ClassesService } from '../services/classes.service';
import type { Class } from '@/types';

export function useClassDetail(id: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached classes data immediately to find class by id
  const cachedClasses = queryClient.getQueryData<Class[]>(['classes', 'list']);

  // 🚀 OPTIMIZED: Set up real-time listener for instant updates
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'classes', id),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const classData = {
            id: snapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as Class;

          // Update cache instantly
          queryClient.setQueryData(['class', 'detail', id], classData);
        }
      },
      (error) => {
        console.error('Error in class detail listener:', error);
      }
    );

    return () => unsubscribe();
  }, [id, queryClient]);

  return useQuery({
    queryKey: ['class', 'detail', id],
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached classes, find the class by id (instant!)
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        if (foundClass) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ useClassDetail: Using class from cache (instant!)`);
          }
          return foundClass;
        }
      }
      
      // Fallback to service if cache doesn't have this class
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useClassDetail: No cache, fetching from server...');
      }
      return ClassesService.getById(id);
    },
    enabled: !!id,
    // 🚀 OPTIMIZED: Cache-first strategy for instant loading
    staleTime: 30 * 60 * 1000, // 30 minutes - classes rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        return foundClass || undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached classes, find and use the class immediately
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        if (foundClass) {
          return foundClass;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}
