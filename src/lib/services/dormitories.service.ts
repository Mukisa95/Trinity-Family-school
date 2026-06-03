import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Dormitory } from '@/types';

const COLLECTION = 'dormitories';

export class DormitoriesService {
  static async getAll(): Promise<Dormitory[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dormitory));
  }

  static async getById(id: string): Promise<Dormitory | null> {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Dormitory;
  }

  static async create(payload: Omit<Dormitory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, COLLECTION), {
      ...payload,
      assignedPupilIds: payload.assignedPupilIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }

  static async update(id: string, payload: Partial<Omit<Dormitory, 'id' | 'createdAt'>>): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      ...payload,
      updatedAt: new Date().toISOString(),
    } as any);
  }

  static async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  // Assignment helpers
  static async assignPupils(id: string, pupilIds: string[]): Promise<void> {
    const dorm = await this.getById(id);
    if (!dorm) throw new Error('Dormitory not found');
    const set = new Set([...(dorm.assignedPupilIds ?? []), ...pupilIds]);
    await this.update(id, { assignedPupilIds: Array.from(set) });
  }

  static async unassignPupils(id: string, pupilIds: string[]): Promise<void> {
    const dorm = await this.getById(id);
    if (!dorm) throw new Error('Dormitory not found');
    const set = new Set(dorm.assignedPupilIds ?? []);
    pupilIds.forEach(pid => set.delete(pid));
    await this.update(id, { assignedPupilIds: Array.from(set) });
  }
}


