import { normalizeCustomPhotoTemplate, type CustomPhotoTemplate } from './custom-photo-types';

const LEGACY_KEY = 'trinity-docx-custom-photo-templates-v1';

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('trinity-document-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other studio tabs and try saving again.'));
  });
}

export async function readStudioTemplates(): Promise<CustomPhotoTemplate[]> {
  let legacy: CustomPhotoTemplate[] = [];
  try {
    const value = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(value)) legacy = value.map(normalizeCustomPhotoTemplate);
  } catch { /* Keep valid IndexedDB templates available if old local data is malformed. */ }
  let db: IDBDatabase;
  try { db = await openStore(); }
  catch (error) { if (legacy.length) return legacy; throw error; }
  try {
    const stored = await new Promise<CustomPhotoTemplate[]>((resolve, reject) => {
      const transaction = db.transaction('templates', 'readonly');
      const request = transaction.objectStore('templates').getAll();
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const all = new Map(legacy.map(template => [template.id, template]));
    stored.forEach(template => all.set(template.id, normalizeCustomPhotoTemplate(template)));
    return [...all.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally { db.close(); }
}

export async function writeStudioTemplate(template: CustomPhotoTemplate): Promise<void> {
  const db = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('templates', 'readwrite');
      transaction.objectStore('templates').put(template);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
