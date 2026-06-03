import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { House } from '@/types';

const COLLECTION = 'houses';

export class HousesService {
  static async getAll(): Promise<House[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as House));
  }

  static async getById(id: string): Promise<House | null> {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as House;
  }

  static async create(payload: Omit<House, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, COLLECTION), {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }

  static async update(id: string, payload: Partial<Omit<House, 'id' | 'createdAt'>>): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      ...payload,
      updatedAt: new Date().toISOString(),
    } as any);
  }

  static async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }
}


