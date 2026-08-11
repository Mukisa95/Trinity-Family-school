import {
  getDoc,
  getDocFromCache,
  getDocFromServer,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SchoolSettings } from '@/types';
import { isFirestoreOfflineError } from '@/lib/utils/firestore-helpers';
import {
  readSchoolSettingsCache,
} from '@/lib/cache/school-settings-cache';
import {
  schoolSettingsDocumentRef,
  schoolSettingsMetaDocumentRef,
} from './dashboard-revision-documents';

function cleanUndefinedValues(value: any): any {
  if (Array.isArray(value)) return value.map(cleanUndefinedValues);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, cleanUndefinedValues(entry)]),
  );
}

/** School profile data must never carry the hot cache-revision map again. */
function withoutDataRevisions(settings: SchoolSettings): SchoolSettings {
  const { dataRevisions: _legacyRevisions, ...profile } = settings;
  return profile as SchoolSettings;
}

function toSettings(snapshot: { id: string; data: () => unknown }): SchoolSettings {
  return {
    id: snapshot.id,
    ...(snapshot.data() as object),
  } as unknown as SchoolSettings;
}

export class SchoolSettingsService {
  /**
   * Shared callers (PDFs and legacy utility code) first use the persisted
   * profile cache, then Firestore's own IndexedDB cache. The only normal
   * server read is owned by the settings-cache bootstrap after a meta revision
   * changes or on a cold device.
   */
  static async getSchoolSettings(): Promise<SchoolSettings | null> {
    const persisted = await readSchoolSettingsCache();
    if (persisted) return persisted.data;

    const docRef = schoolSettingsDocumentRef();
    try {
      const cached = await getDocFromCache(docRef);
      if (cached.exists()) return withoutDataRevisions(toSettings(cached));
    } catch {
      // A first-use IndexedDB cache miss is expected.
    }

    try {
      const snapshot = await getDoc(docRef);
      return snapshot.exists() ? withoutDataRevisions(toSettings(snapshot)) : null;
    } catch (error) {
      if (isFirestoreOfflineError(error)) return null;
      throw error;
    }
  }

  /** Strict server read used only by the single settings-cache owner. */
  static async getSchoolSettingsFromServer(): Promise<SchoolSettings | null> {
    try {
      const snapshot = await getDocFromServer(schoolSettingsDocumentRef());
      return snapshot.exists() ? withoutDataRevisions(toSettings(snapshot)) : null;
    } catch (error) {
      if (isFirestoreOfflineError(error)) return null;
      throw error;
    }
  }

  private static async saveProfile(
    changes: Partial<SchoolSettings>,
    options: { replace?: boolean } = {},
  ): Promise<void> {
    const profileChanges = withoutDataRevisions(changes as SchoolSettings);
    await runTransaction(db, async transaction => {
      const meta = await transaction.get(schoolSettingsMetaDocumentRef());
      const revision = Number(meta.data()?.revision || 0) + 1;
      const updatedAt = new Date().toISOString();

      transaction.set(
        schoolSettingsDocumentRef(),
        cleanUndefinedValues({ ...profileChanges, updatedAt }),
        { merge: options.replace !== true },
      );
      transaction.set(schoolSettingsMetaDocumentRef(), {
        revision,
        updatedAt,
        schema: 1,
      }, { merge: true });
    });
  }

  static async updateSchoolSettings(settings: SchoolSettings): Promise<void> {
    await this.saveProfile(settings);
  }

  static async initializeSchoolSettings(settings: SchoolSettings): Promise<void> {
    await this.saveProfile(settings, { replace: true });
  }

  static async updateGeneralInfo(generalInfo: SchoolSettings['generalInfo']): Promise<void> {
    await this.saveProfile({ generalInfo } as Partial<SchoolSettings>);
  }

  static async updateContactInfo(contact: SchoolSettings['contact']): Promise<void> {
    await this.saveProfile({ contact } as Partial<SchoolSettings>);
  }

  static async updateAddress(address: SchoolSettings['address']): Promise<void> {
    await this.saveProfile({ address } as Partial<SchoolSettings>);
  }
}
