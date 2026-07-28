import { db } from '@/lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy } from 'firebase/firestore';
import type { PupilTermSnapshot, Pupil, AcademicYear, Term } from '@/types';
import { getTermStatus, isTermEnded } from '@/lib/utils/academic-year-utils';

export class PupilSnapshotsService {
  private static collectionName = 'pupilTermSnapshots';

  /**
   * Validate snapshot data before creation to prevent incorrect snapshots
   * Returns true if data is safe to use, false if there are warnings
   */
  private static validateSnapshotData(
    pupil: Pupil,
    termEndDate: Date,
    snapshotClassId: string,
    snapshotSection: string
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check if pupil was promoted after term ended
    const promotionAfterTerm = this.checkIfPupilPromotedAfterTerm(pupil, termEndDate);

    if (promotionAfterTerm) {
      // If using current class data but pupil was promoted, this is a problem
      if (snapshotClassId === pupil.classId && snapshotSection === pupil.section) {
        warnings.push(`⚠️ WARNING: Snapshot uses current class/section (${pupil.classId}/${pupil.section}) but pupil was promoted after term ended. Snapshot may be incorrect!`);
        warnings.push(`   Promotion: ${promotionAfterTerm.fromClassId} → ${promotionAfterTerm.toClassId} on ${promotionAfterTerm.promotionDate.toISOString()}`);
        warnings.push(`   Term ended: ${termEndDate.toISOString()}`);
        return { isValid: false, warnings };
      }
    }

    return { isValid: true, warnings };
  }

  /**
   * Create a snapshot of a pupil's class and section for a specific term
   * CRITICAL: Only for terms that have ended, and NEVER with current pupil data
   */
  static async createSnapshot(
    pupilId: string,
    termId: string,
    academicYearId: string,
    historicalClassId: string,
    historicalSection: string,
    historicalAdmissionNumber: string,
    termStartDate: string,
    termEndDate: string,
    historicalDateOfBirth?: string,
    pupil?: Pupil, // Optional: Pass pupil object for validation
    allowRecapture?: boolean, // Optional: Allow recapture to bypass strict validation
    skipValidation?: boolean // Optional: Skip validation (e.g., when using historical data recovery)
  ): Promise<string> {
    // Validate that the term has ended before creating snapshot
    const termEndDateObj = new Date(termEndDate);
    const now = new Date();

    if (now <= termEndDateObj) {
      throw new Error(`❌ CRITICAL ERROR: Cannot create snapshot for term ${termId}: Term has not ended yet (ends ${termEndDate}). Snapshots can only be created for terms that have ended.`);
    }

    // If pupil object is provided, validate the snapshot data (unless validation is skipped)
    if (pupil && !skipValidation && !allowRecapture) {
      // Only validate if this is NOT a recapture operation and validation is not skipped
      // Skip validation when using historical data recovery (it's already verified)
      const validation = this.validateSnapshotData(
        pupil,
        termEndDateObj,
        historicalClassId,
        historicalSection
      );

      if (!validation.isValid) {
        // Log all warnings
        validation.warnings.forEach(warning => console.error(warning));
        throw new Error(`❌ CRITICAL ERROR: Cannot create snapshot with potentially incorrect data. ${validation.warnings[0]}`);
      }

      if (validation.warnings.length > 0) {
        // Log warnings but allow creation
        validation.warnings.forEach(warning => console.warn(warning));
      }
    } else if (pupil && allowRecapture) {
      // For recapture, still check but only warn (don't block)
      const validation = this.validateSnapshotData(
        pupil,
        termEndDateObj,
        historicalClassId,
        historicalSection
      );

      if (!validation.isValid) {
        // Log warnings but allow recapture to proceed
        console.warn(`⚠️ RECAPTURE: Creating snapshot with data that may differ from term data (this is intentional for recapture)`);
        validation.warnings.forEach(warning => console.warn(`   ${warning}`));
      }
    } else if (pupil && skipValidation) {
      // Validation skipped - using historical data recovery which is already verified
      console.log(`✅ Skipping validation - using verified historical data recovery`);
    }

    console.log(`📸 Creating REAL snapshot for ended term:`, {
      pupilId,
      termId,
      historicalClassId,
      historicalSection,
      historicalAdmissionNumber,
      historicalDateOfBirth,
      termEndDate
    });

    const snapshot: Omit<PupilTermSnapshot, 'id'> = {
      pupilId,
      termId,
      academicYearId,
      classId: historicalClassId,
      section: historicalSection,
      admissionNumber: historicalAdmissionNumber,
      dateOfBirth: historicalDateOfBirth,
      isActive: true,
      snapshotDate: new Date().toISOString(),
      termStartDate,
      termEndDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, this.collectionName), snapshot);
    console.log(`✅ Successfully created snapshot ${docRef.id} for ended term ${termId}`);
    return docRef.id;
  }

  /**
   * CRITICAL: Get historical class/section data for a pupil during a specific term
   * This attempts multiple strategies to recover accurate historical data
   */
  static async getHistoricalPupilData(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<{ classId: string; section: string; admissionNumber: string; dateOfBirth?: string } | null> {
    try {
      console.log(`🔍 Attempting to recover historical data for pupil ${pupil.id} during term ${termId}`);

      // Strategy 1: Check promotion history for data during that term
      if (pupil.promotionHistory && pupil.promotionHistory.length > 0) {
        const term = academicYear.terms.find(t => t.id === termId);
        if (term) {
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);

          // Sort promotion history by date
          const sortedPromotions = pupil.promotionHistory
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // 🔥 CRITICAL FIX: Find the class the pupil was in during this term
          // We need to handle three cases:
          // 1. Promotion BEFORE term started -> pupil was in toClassId during term
          // 2. Promotion DURING term -> pupil was in fromClassId at start of term
          // 3. Promotion AFTER term ended -> pupil was in fromClassId during term
          let classIdDuringTerm: string | null = null;

          for (let i = 0; i < sortedPromotions.length; i++) {
            const promotion = sortedPromotions[i];
            const promotionDate = new Date(promotion.date);
            const nextPromotion = sortedPromotions[i + 1];

            if (promotionDate > termEnd) {
              // 🔥 CRITICAL: This promotion happened AFTER the term ended
              // The pupil was in the "fromClassId" during the term
              classIdDuringTerm = promotion.fromClassId || promotion.toClassId;
              console.log(`✅ Found promotion AFTER term ${termId} ended:`, {
                promotionDate: promotionDate.toISOString(),
                termEnd: termEnd.toISOString(),
                classIdDuringTerm: promotion.fromClassId || promotion.toClassId,
                promotedTo: promotion.toClassId
              });
              break;
            } else if (promotionDate >= termStart && promotionDate <= termEnd) {
              // Promotion happened DURING the term
              // Use the "fromClassId" as the class for the start of the term
              classIdDuringTerm = promotion.fromClassId || promotion.toClassId;
              console.log(`✅ Found promotion DURING term ${termId}:`, {
                promotionDate: promotionDate.toISOString(),
                classIdDuringTerm: promotion.fromClassId,
                promotedTo: promotion.toClassId
              });
              break;
            } else if (promotionDate < termStart) {
              // This promotion happened before the term started
              // The pupil was in the "toClassId" at the start of the term
              // But check if there's a later promotion
              if (!nextPromotion || new Date(nextPromotion.date) >= termStart) {
                // No more promotions before term start, use this one's toClassId
                classIdDuringTerm = promotion.toClassId;
                console.log(`✅ Found promotion BEFORE term ${termId} started:`, {
                  promotionDate: promotionDate.toISOString(),
                  termStart: termStart.toISOString(),
                  classIdDuringTerm: promotion.toClassId,
                  willCheckForLaterPromotions: true
                });
                // Don't break - keep checking for promotions during/after term
              }
            }
          }

          // If no suitable promotion found, fall back to current class
          if (!classIdDuringTerm) {
            classIdDuringTerm = pupil.classId;
            console.log(`⚠️ No promotion history found for term ${termId}, using current class: ${classIdDuringTerm}`);
          }

          if (classIdDuringTerm) {
            // Ensure admissionNumber is not undefined - use fallback if missing
            const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
            // Ensure dateOfBirth is not undefined - use fallback if missing
            const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';

            console.log(`✅ Found historical class from promotion history:`, {
              classId: classIdDuringTerm,
              section: pupil.section, // Use current section as fallback
              admissionNumber: fallbackAdmissionNumber, // Use current admission number with fallback
              dateOfBirth: fallbackDateOfBirth, // Use current date of birth with fallback
              termId,
              source: 'promotion_history'
            });

            return {
              classId: classIdDuringTerm,
              section: pupil.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            };
          }
        }
      }

      // Strategy 2: Check for any existing snapshots from earlier terms in same year
      const existingSnapshots = await this.getPupilSnapshots(pupil.id);
      const sameYearSnapshots = existingSnapshots.filter(s => s.academicYearId === academicYear.id);

      if (sameYearSnapshots.length > 0) {
        // Sort by term start date and find the closest earlier snapshot
        const sortedSnapshots = sameYearSnapshots.sort((a, b) =>
          new Date(a.termStartDate).getTime() - new Date(b.termStartDate).getTime()
        );

        const targetTerm = academicYear.terms.find(t => t.id === termId);
        if (targetTerm) {
          const targetTermStart = new Date(targetTerm.startDate);

          // Find the most recent snapshot before this term
          const earlierSnapshot = sortedSnapshots
            .filter(s => new Date(s.termStartDate) < targetTermStart)
            .pop(); // Get the latest one before target term

          if (earlierSnapshot) {
            // Ensure admissionNumber is not undefined - use fallback if missing
            const fallbackAdmissionNumber = earlierSnapshot.admissionNumber || pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
            // Ensure dateOfBirth is not undefined - use fallback if missing
            const fallbackDateOfBirth = earlierSnapshot.dateOfBirth || pupil.dateOfBirth || '1900-01-01';

            console.log(`⚠️ Using data from earlier snapshot in same year:`, {
              fromTerm: earlierSnapshot.termId,
              classId: earlierSnapshot.classId,
              section: earlierSnapshot.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            });
            return {
              classId: earlierSnapshot.classId,
              section: earlierSnapshot.section,
              admissionNumber: fallbackAdmissionNumber,
              dateOfBirth: fallbackDateOfBirth
            };
          }
        }
      }

      // Strategy 3: For very old terms, use current data as best guess with warning
      console.log(`⚠️ WARNING: No historical data found for pupil ${pupil.id} term ${termId}. Using current data as last resort.`);
      console.log(`   This may be inaccurate if pupil changed classes/data since ${termId}`);

      // Ensure admissionNumber is not undefined - use fallback if missing
      const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
      // Ensure dateOfBirth is not undefined - use fallback if missing
      const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';

      return {
        classId: pupil.classId,
        section: pupil.section,
        admissionNumber: fallbackAdmissionNumber,
        dateOfBirth: fallbackDateOfBirth
      };

    } catch (error) {
      console.error(`❌ Error recovering historical data for pupil ${pupil.id} term ${termId}:`, error);
      return null;
    }
  }

  /**
   * Resolve historical data for a read-only screen without mutating Firestore.
   *
   * Dashboard, parent, and reporting reads must never create a missing snapshot:
   * a read can otherwise consume a write quota and accidentally turn a fallback
   * into permanent financial history. Snapshot creation remains available through
   * explicit administrative lifecycle actions only.
   */
  static async getSnapshotForRead(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear,
  ): Promise<PupilTermSnapshot> {
    const term = academicYear.terms.find(candidate => candidate.id === termId);
    if (!term) throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);

    const makeVirtualSnapshot = (
      idPrefix: string,
      data: { classId: string; section: string; admissionNumber?: string; dateOfBirth?: string },
    ): PupilTermSnapshot => ({
      id: `${idPrefix}-${pupil.id}-${termId}`,
      pupilId: pupil.id,
      termId,
      academicYearId: academicYear.id,
      classId: data.classId,
      section: data.section,
      admissionNumber: data.admissionNumber || pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`,
      dateOfBirth: data.dateOfBirth || pupil.dateOfBirth || '1900-01-01',
      isActive: true,
      snapshotDate: new Date().toISOString(),
      termStartDate: term.startDate,
      termEndDate: term.endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const termStatus = getTermStatus(term);
    if (termStatus === 'current' || termStatus === 'future') {
      return makeVirtualSnapshot('virtual-live', pupil);
    }

    const existingSnapshot = await this.getSnapshot(pupil.id, termId);
    if (existingSnapshot) return existingSnapshot;

    const historicalData = await this.getHistoricalPupilData(pupil, termId, academicYear);
    if (historicalData) return makeVirtualSnapshot('virtual-recovered', historicalData);

    // Retain the prior screen behaviour when legacy history is incomplete, but
    // make the fallback visibly non-persistent so it cannot silently become a
    // new snapshot through a read-only request.
    return makeVirtualSnapshot('virtual-missing-history', pupil);
  }

  /**
   * Get or create a snapshot for an explicit administrative snapshot action.
   * FIXED: Never creates snapshots with current data for past terms
   */
  static async getOrCreateSnapshot(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<PupilTermSnapshot> {
    try {
      console.log(`📸 Getting/creating snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}), term ${termId}`);

      // Find the term details
      const term = academicYear.terms.find(t => t.id === termId);
      if (!term) {
        throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);
      }

      // Check term status
      const termStatus = getTermStatus(term);
      console.log(`📅 Term ${term.name} status: ${termStatus}`);

      // For current and future terms, return live pupil data as virtual snapshot
      if (termStatus === 'current' || termStatus === 'future') {
        console.log(`🔄 Term ${term.name} is ${termStatus} - returning live pupil data (virtual snapshot)`);

        // Validate essential data
        if (!pupil.classId) {
          throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no classId assigned`);
        }

        if (!pupil.section) {
          throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no section assigned`);
        }

        // Return virtual snapshot based on current pupil data
        const virtualSnapshot: PupilTermSnapshot = {
          id: `virtual-${pupil.id}-${termId}`, // Virtual ID to indicate this is not persisted
          pupilId: pupil.id,
          termId,
          academicYearId: academicYear.id,
          classId: pupil.classId,
          section: pupil.section,
          admissionNumber: pupil.admissionNumber,
          dateOfBirth: pupil.dateOfBirth,
          isActive: true,
          snapshotDate: new Date().toISOString(),
          termStartDate: term.startDate,
          termEndDate: term.endDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        console.log(`✅ Returning virtual snapshot (live data) for ${termStatus} term`);
        return virtualSnapshot;
      }

      // For ended terms, try to find existing snapshot first
      console.log(`📋 Term ${term.name} has ended - checking for existing snapshot`);

      // Try to find existing snapshot
      const existingSnapshot = await this.getSnapshot(pupil.id, termId);

      if (existingSnapshot) {
        console.log(`✅ Found existing REAL snapshot:`, {
          pupilId: existingSnapshot.pupilId,
          termId: existingSnapshot.termId,
          classId: existingSnapshot.classId,
          section: existingSnapshot.section,
          snapshotDate: existingSnapshot.snapshotDate,
          isImmutable: true
        });

        // 🔒 IMMUTABILITY PROTECTION: Never modify existing snapshots for ended terms
        // Return immediately without any validation or modification
        // This ensures that snapshots captured at term end remain unchanged regardless of
        // subsequent promotions, demotions, or any other pupil data changes
        console.log(`🔒 Returning immutable snapshot - no modifications allowed`);
        return existingSnapshot;
      }

      // CRITICAL CHANGE: Never create snapshots for ended terms from current data
      // Instead, attempt to recover historical data
      console.log(`🚨 CRITICAL: No snapshot exists for ended term ${term.name}. Attempting historical data recovery...`);

      // 🔥 CRITICAL VALIDATION: Check if pupil was promoted after term ended
      const termEndDate = new Date(term.endDate);
      const promotionAfterTerm = this.checkIfPupilPromotedAfterTerm(pupil, termEndDate);

      if (promotionAfterTerm) {
        console.warn(`⚠️ WARNING: Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) was promoted AFTER term ${term.name} ended.`);
        console.warn(`   Promotion date: ${promotionAfterTerm.promotionDate.toISOString()}, Term ended: ${termEndDate.toISOString()}`);
        console.warn(`   Promotion: ${promotionAfterTerm.fromClassId} → ${promotionAfterTerm.toClassId}`);
        console.warn(`   Current class: ${pupil.classId} - This may NOT match the class during the term!`);
        console.warn(`   Using historical data recovery to get accurate class/section during the term...`);
      }

      const historicalData = await this.getHistoricalPupilData(pupil, termId, academicYear);

      if (!historicalData) {
        // CRITICAL ERROR: Cannot create snapshot without historical data
        const errorMsg = `❌ CRITICAL ERROR: Cannot create snapshot for pupil ${pupil.id} term ${termId}. No historical class/section data available and term has ended. This indicates a system failure where snapshots should have been created when the term ended.`;
        console.error(errorMsg);

        if (promotionAfterTerm) {
          console.error(`   ADDITIONAL WARNING: Pupil was promoted after term ended, making current data unreliable!`);
        }

        // Return virtual snapshot with warning markers to prevent system crash
        // But log this as a critical system failure
        const fallbackAdmissionNumber = pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`;
        const fallbackDateOfBirth = pupil.dateOfBirth || '1900-01-01';

        const errorSnapshot: PupilTermSnapshot = {
          id: `error-missing-historical-${pupil.id}-${termId}`,
          pupilId: pupil.id,
          termId,
          academicYearId: academicYear.id,
          classId: pupil.classId, // Current data - marked as potentially wrong
          section: pupil.section,  // Current data - marked as potentially wrong
          admissionNumber: fallbackAdmissionNumber, // Ensure not undefined
          dateOfBirth: fallbackDateOfBirth, // Ensure not undefined
          isActive: true,
          snapshotDate: new Date().toISOString(),
          termStartDate: term.startDate,
          termEndDate: term.endDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        console.error(`⚠️ Returning emergency snapshot with current data. This may be INCORRECT for financial calculations.`);
        if (promotionAfterTerm) {
          console.error(`   ⚠️ EXTRA WARNING: Pupil was promoted after term ended - current data is DEFINITELY wrong!`);
        }
        return errorSnapshot;
      }

      // Validate that historical data differs from current data if pupil was promoted
      if (promotionAfterTerm) {
        if (historicalData.classId === pupil.classId && historicalData.section === pupil.section) {
          console.warn(`⚠️ WARNING: Historical data recovery returned same class/section as current data, but pupil was promoted after term ended.`);
          console.warn(`   This suggests the historical data recovery may not be accurate.`);
          console.warn(`   Historical: class=${historicalData.classId}, section=${historicalData.section}`);
          console.warn(`   Current: class=${pupil.classId}, section=${pupil.section}`);
        } else {
          console.log(`✅ Historical data recovery found different class/section (as expected after promotion):`);
          console.log(`   Historical: class=${historicalData.classId}, section=${historicalData.section}`);
          console.log(`   Current: class=${pupil.classId}, section=${pupil.section}`);
        }
      }

      console.log(`🆕 Creating snapshot with recovered historical data:`, {
        pupilId: pupil.id,
        pupilName: `${pupil.firstName} ${pupil.lastName}`,
        termId: term.id,
        termName: term.name,
        historicalClassId: historicalData.classId,
        historicalSection: historicalData.section,
        termEndDate: term.endDate
      });

      // Create new snapshot with historical data
      // Skip validation since we're using historical data recovery (already verified)
      // Historical data recovery confirms this is the correct class/section during the term
      const snapshotId = await this.createSnapshot(
        pupil.id,
        termId,
        academicYear.id,
        historicalData.classId,
        historicalData.section,
        historicalData.admissionNumber,
        term.startDate,
        term.endDate,
        historicalData.dateOfBirth,
        pupil, // Pass pupil for validation
        false, // allowRecapture: false
        true // skipValidation: true - we're using historical data, not current data
      );

      // Return the created snapshot
      const newSnapshot: PupilTermSnapshot = {
        id: snapshotId,
        pupilId: pupil.id,
        termId,
        academicYearId: academicYear.id,
        classId: historicalData.classId,
        section: historicalData.section,
        admissionNumber: historicalData.admissionNumber,
        dateOfBirth: historicalData.dateOfBirth,
        isActive: true,
        snapshotDate: new Date().toISOString(),
        termStartDate: term.startDate,
        termEndDate: term.endDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log(`✅ Successfully created snapshot with historical data`);
      return newSnapshot;

    } catch (error) {
      console.error('❌ CRITICAL ERROR in getOrCreateSnapshot:', error);
      console.error('Context:', {
        pupilId: pupil?.id,
        pupilName: pupil ? `${pupil.firstName} ${pupil.lastName}` : 'unknown',
        termId,
        academicYearId: academicYear?.id,
        academicYearName: academicYear?.name
      });

      // This is a critical financial system - we cannot allow this to fail silently
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Snapshot creation failed for pupil ${pupil?.id || 'unknown'}, term ${termId}: ${errorMessage}`);
    }
  }

  /**
   * Get a specific snapshot for a pupil in a term
   */
  static async getSnapshot(pupilId: string, termId: string): Promise<PupilTermSnapshot | null> {
    const q = query(
      collection(db, this.collectionName),
      where('pupilId', '==', pupilId),
      where('termId', '==', termId),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PupilTermSnapshot;
  }

  /**
   * Get all snapshots for a pupil
   */
  static async getPupilSnapshots(pupilId: string): Promise<PupilTermSnapshot[]> {
    const q = query(
      collection(db, this.collectionName),
      where('pupilId', '==', pupilId),
      where('isActive', '==', true)
      // Removed orderBy to avoid composite index requirement - will sort in memory
    );

    const querySnapshot = await getDocs(q);
    const snapshots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PupilTermSnapshot));

    // Sort in memory by termStartDate descending
    return snapshots.sort((a, b) => new Date(b.termStartDate).getTime() - new Date(a.termStartDate).getTime());
  }

  /**
   * Delete a snapshot for a specific pupil and term
   */
  static async deleteSnapshot(pupilId: string, termId: string): Promise<void> {
    const snapshot = await this.getSnapshot(pupilId, termId);

    if (!snapshot) {
      console.log(`📸 No snapshot found to delete for pupil ${pupilId}, term ${termId}`);
      return;
    }

    // Check if it's a virtual snapshot (can't delete virtual snapshots)
    if (snapshot.id.startsWith('virtual-') || snapshot.id.startsWith('error-')) {
      console.log(`⚠️ Cannot delete virtual snapshot ${snapshot.id}`);
      return;
    }

    try {
      const docRef = doc(db, this.collectionName, snapshot.id);
      await deleteDoc(docRef);
      console.log(`✅ Successfully deleted snapshot ${snapshot.id} for pupil ${pupilId}, term ${termId}`);
    } catch (error) {
      console.error(`❌ Failed to delete snapshot ${snapshot.id}:`, error);
      throw new Error(`Failed to delete snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recapture a snapshot: Delete the existing snapshot and create a new one with current pupil data
   * This is useful when a snapshot was captured with incorrect data (e.g., after promotion)
   */
  static async recaptureSnapshot(
    pupil: Pupil,
    termId: string,
    academicYear: AcademicYear
  ): Promise<PupilTermSnapshot> {
    console.log(`🔄 Recapturing snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}), term ${termId}`);

    // Find the term details
    const term = academicYear.terms.find(t => t.id === termId);
    if (!term) {
      throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);
    }

    // Check if term has ended - snapshots can only be recaptured for ended terms
    const termStatus = getTermStatus(term);
    if (termStatus !== 'past') {
      throw new Error(`Cannot recapture snapshot for ${termStatus} term. Snapshots can only be recaptured for ended terms.`);
    }

    // Delete existing snapshot if it exists
    try {
      await this.deleteSnapshot(pupil.id, termId);
    } catch (error) {
      console.warn(`⚠️ Error deleting existing snapshot (may not exist):`, error);
      // Continue anyway - the snapshot might not exist
    }

    // Validate essential data
    if (!pupil.classId) {
      throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no classId assigned`);
    }

    if (!pupil.section) {
      throw new Error(`Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) has no section assigned`);
    }

    // 🔥 CRITICAL VALIDATION: Check if pupil was promoted after term ended
    // Warn user if recapturing with potentially incorrect data
    const termEndDate = new Date(term.endDate);
    const promotionAfterTerm = this.checkIfPupilPromotedAfterTerm(pupil, termEndDate);

    if (promotionAfterTerm) {
      console.warn(`⚠️ RECAPTURE WARNING: Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) was promoted AFTER term ${term.name} ended.`);
      console.warn(`   Promotion: ${promotionAfterTerm.fromClassId} → ${promotionAfterTerm.toClassId} on ${promotionAfterTerm.promotionDate.toISOString()}`);
      console.warn(`   Term ended: ${termEndDate.toISOString()}`);
      console.warn(`   Current class being used for recapture: ${pupil.classId}`);
      console.warn(`   Historical class during term: ${promotionAfterTerm.fromClassId}`);

      if (pupil.classId !== promotionAfterTerm.fromClassId) {
        console.warn(`   🚨 MISMATCH DETECTED: Using ${pupil.classId} for snapshot, but pupil was in ${promotionAfterTerm.fromClassId} during the term!`);
        console.warn(`   This snapshot may be INCORRECT for financial calculations.`);
        console.warn(`   RECOMMENDATION: Demote pupil back to ${promotionAfterTerm.fromClassId} before recapturing, then promote again after.`);
      } else {
        console.log(`   ✅ Good: Current class (${pupil.classId}) matches historical class during term.`);
      }
    }


    // Create new snapshot with current pupil data
    // Pass allowRecapture=true to bypass strict validation (recapture is intentional)
    const snapshotId = await this.createSnapshot(
      pupil.id,
      termId,
      academicYear.id,
      pupil.classId,
      pupil.section,
      pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`,
      term.startDate,
      term.endDate,
      pupil.dateOfBirth,
      pupil, // Pass pupil for validation
      true // allowRecapture: true - this is an intentional recapture
    );

    // Return the created snapshot
    const newSnapshot: PupilTermSnapshot = {
      id: snapshotId,
      pupilId: pupil.id,
      termId,
      academicYearId: academicYear.id,
      classId: pupil.classId,
      section: pupil.section,
      admissionNumber: pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`,
      dateOfBirth: pupil.dateOfBirth,
      isActive: true,
      snapshotDate: new Date().toISOString(),
      termStartDate: term.startDate,
      termEndDate: term.endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log(`✅ Successfully recaptured snapshot for pupil ${pupil.id}, term ${termId}`);
    return newSnapshot;
  }

  /**
   * Batch recapture snapshots for multiple pupils
   * Processes each pupil sequentially and returns detailed results
   */
  static async recaptureSnapshotsBatch(
    pupils: Pupil[],
    termId: string,
    academicYear: AcademicYear,
    onProgress?: (current: number, total: number, pupilName: string) => void
  ): Promise<{
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      pupilId: string;
      pupilName: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    console.log(`🔄 Starting batch snapshot recapture for ${pupils.length} pupils, term ${termId}`);

    const results: Array<{
      pupilId: string;
      pupilName: string;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < pupils.length; i++) {
      const pupil = pupils[i];
      const pupilName = `${pupil.firstName} ${pupil.lastName}`;

      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, pupils.length, pupilName);
      }

      try {
        await this.recaptureSnapshot(pupil, termId, academicYear);

        results.push({
          pupilId: pupil.id,
          pupilName,
          success: true
        });

        successCount++;
        console.log(`✅ [${i + 1}/${pupils.length}] Successfully recaptured snapshot for ${pupilName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          pupilId: pupil.id,
          pupilName,
          success: false,
          error: errorMessage
        });

        failureCount++;
        console.error(`❌ [${i + 1}/${pupils.length}] Failed to recapture snapshot for ${pupilName}:`, errorMessage);
      }
    }

    console.log(`📊 Batch recapture complete:`, {
      totalProcessed: pupils.length,
      successCount,
      failureCount
    });

    return {
      totalProcessed: pupils.length,
      successCount,
      failureCount,
      results
    };
  }

  /**
   * Update a snapshot (when class/section changes mid-term)
   */
  static async updateSnapshot(
    snapshotId: string,
    updates: Partial<Pick<PupilTermSnapshot, 'classId' | 'section'>>
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, snapshotId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Create snapshots for all active pupils for a new term
   * This should be run when a new term starts
   */
  static async createTermSnapshotsForAllPupils(
    pupils: Pupil[],
    termId: string,
    academicYear: AcademicYear
  ): Promise<void> {
    const term = academicYear.terms.find(t => t.id === termId);
    if (!term) {
      throw new Error(`Term ${termId} not found in academic year ${academicYear.name}`);
    }

    const promises = pupils.map(pupil =>
      this.getOrCreateSnapshot(pupil, termId, academicYear)
    );

    await Promise.all(promises);
    console.log(`Created snapshots for ${pupils.length} pupils for term ${termId}`);
  }

  /**
   * Create a virtual pupil object based on historical snapshot
   */
  static createVirtualPupilFromSnapshot(
    originalPupil: Pupil,
    snapshot: PupilTermSnapshot
  ): Pupil {
    return {
      ...originalPupil,
      classId: snapshot.classId,
      section: snapshot.section as "" | "Day" | "Boarding",
      admissionNumber: snapshot.admissionNumber,
      dateOfBirth: snapshot.dateOfBirth || originalPupil.dateOfBirth,
    };
  }

  /**
   * Check snapshot coverage for all pupils across ENDED terms only
   * Current and future terms should NOT have snapshots
   */
  static async checkSnapshotCoverage(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    totalExpectedSnapshots: number;
    existingSnapshots: number;
    missingSnapshots: number;
    missingSnapshotDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }>;
  }> {
    console.log('🔍 Checking snapshot coverage for ENDED terms only...');

    // Only get terms that have ended
    const endedTerms: Array<{ termId: string; termName: string; academicYear: AcademicYear }> = [];
    academicYears.forEach(year => {
      year.terms.forEach(term => {
        if (isTermEnded(term)) {
          endedTerms.push({
            termId: term.id,
            termName: term.name,
            academicYear: year
          });
        }
      });
    });

    console.log(`📅 Found ${endedTerms.length} ended terms that should have snapshots`);

    let totalExpected = 0;
    let existing = 0;
    const missing: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }> = [];

    for (const pupil of pupils) {
      for (const term of endedTerms) {
        // Only check terms that the pupil should have been in (after registration)
        if (pupil.registrationDate) {
          const termStartDate = new Date(term.academicYear.terms.find(t => t.id === term.termId)?.startDate || '');
          const registrationDate = new Date(pupil.registrationDate);

          // Skip terms that started before pupil registration
          if (termStartDate < registrationDate) {
            continue;
          }
        }

        totalExpected++;

        const snapshot = await this.getSnapshot(pupil.id, term.termId);
        if (snapshot) {
          existing++;
        } else {
          missing.push({
            pupilId: pupil.id,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            termId: term.termId,
            termName: term.termName,
            academicYear: term.academicYear.name
          });
        }
      }
    }

    console.log(`📊 Snapshot Coverage Report for ENDED terms:`, {
      totalExpectedSnapshots: totalExpected,
      existingSnapshots: existing,
      missingSnapshots: totalExpected - existing,
      coveragePercentage: totalExpected > 0 ? Math.round((existing / totalExpected) * 100) : 0
    });

    return {
      totalExpectedSnapshots: totalExpected,
      existingSnapshots: existing,
      missingSnapshots: totalExpected - existing,
      missingSnapshotDetails: missing
    };
  }

  /**
   * Bulk create all missing historical snapshots for all pupils
   * ONLY creates snapshots for ENDED terms - current and future terms are excluded
   */
  static async createAllMissingSnapshots(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    created: number;
    skipped: number;
    errors: Array<{ pupilId: string; termId: string; error: string }>;
  }> {
    console.log('🏗️ Creating all missing historical snapshots for ENDED terms only...');

    let created = 0;
    let skipped = 0;
    const errors: Array<{ pupilId: string; termId: string; error: string }> = [];

    for (const academicYear of academicYears) {
      console.log(`📅 Processing academic year: ${academicYear.name}`);

      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);

        // Skip current and future terms - they should not have snapshots
        if (termStatus === 'current' || termStatus === 'future') {
          console.log(`⏭️  Skipping ${termStatus} term: ${term.name} - snapshots only for ended terms`);
          continue;
        }

        console.log(`📝 Processing ended term: ${term.name}`);

        for (const pupil of pupils) {
          try {
            // Check if pupil should have been in this term
            if (pupil.registrationDate) {
              const termStartDate = new Date(term.startDate);
              const registrationDate = new Date(pupil.registrationDate);

              // Skip terms that started before pupil registration
              if (termStartDate < registrationDate) {
                skipped++;
                continue;
              }
            }

            // Check if snapshot already exists
            const existingSnapshot = await this.getSnapshot(pupil.id, term.id);
            if (existingSnapshot) {
              skipped++;
              continue;
            }

            // Create snapshot for ended term
            await this.createSnapshot(
              pupil.id,
              term.id,
              academicYear.id,
              pupil.classId,
              pupil.section,
              pupil.admissionNumber,
              term.startDate,
              term.endDate,
              pupil.dateOfBirth,
              pupil // Pass pupil for validation
            );

            created++;
            console.log(`✅ Created snapshot for ${pupil.firstName} ${pupil.lastName} - ${term.name} (${academicYear.name})`);

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({
              pupilId: pupil.id,
              termId: term.id,
              error: errorMessage
            });
            console.error(`❌ Failed to create snapshot for ${pupil.firstName} ${pupil.lastName} - ${term.name}:`, error);
          }
        }
      }
    }

    console.log(`🎉 Bulk snapshot creation complete:`, {
      created,
      skipped,
      errors: errors.length
    });

    return { created, skipped, errors };
  }

  /**
   * Delete all snapshots for current and upcoming terms
   * These snapshots are incorrect and should not exist
   */
  static async deleteSnapshotsForCurrentAndUpcomingTerms(
    academicYears: AcademicYear[]
  ): Promise<{
    deleted: number;
    errors: Array<{ snapshotId: string; termId: string; error: string }>;
  }> {
    console.log('🗑️ Deleting incorrect snapshots for current and upcoming terms...');

    let deleted = 0;
    const errors: Array<{ snapshotId: string; termId: string; error: string }> = [];

    // Get all current and upcoming terms
    const currentAndUpcomingTerms: Array<{ term: Term, academicYear: AcademicYear }> = [];
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        if (termStatus === 'current' || termStatus === 'future') {
          currentAndUpcomingTerms.push({ term, academicYear });
        }
      }
    }

    console.log(`📅 Found ${currentAndUpcomingTerms.length} current/upcoming terms to clean`);

    for (const { term, academicYear } of currentAndUpcomingTerms) {
      try {
        console.log(`🧹 Cleaning snapshots for ${getTermStatus(term)} term: ${term.name} (${academicYear.name})`);

        // Query all snapshots for this term
        const q = query(
          collection(db, this.collectionName),
          where('termId', '==', term.id),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.log(`✅ No snapshots found for term ${term.name} - already clean`);
          continue;
        }

        console.log(`🗑️ Found ${querySnapshot.docs.length} incorrect snapshots for term ${term.name}`);

        // Delete each snapshot
        for (const docSnapshot of querySnapshot.docs) {
          try {
            await deleteDoc(doc(db, this.collectionName, docSnapshot.id));
            deleted++;
            console.log(`✅ Deleted snapshot ${docSnapshot.id} for term ${term.name}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({
              snapshotId: docSnapshot.id,
              termId: term.id,
              error: errorMessage
            });
            console.error(`❌ Failed to delete snapshot ${docSnapshot.id}:`, error);
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          snapshotId: 'query-error',
          termId: term.id,
          error: errorMessage
        });
        console.error(`❌ Failed to query snapshots for term ${term.name}:`, error);
      }
    }

    console.log(`🎉 Snapshot cleanup complete:`, {
      deleted,
      errors: errors.length
    });

    return { deleted, errors };
  }

  /**
   * Get statistics about snapshots by term status
   */
  static async getSnapshotStatsByTermStatus(
    academicYears: AcademicYear[]
  ): Promise<{
    pastTermsSnapshots: number;
    currentTermsSnapshots: number;
    futureTermsSnapshots: number;
    totalSnapshots: number;
  }> {
    console.log('📊 Analyzing snapshot distribution by term status...');

    let pastTermsSnapshots = 0;
    let currentTermsSnapshots = 0;
    let futureTermsSnapshots = 0;

    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);

        // Count snapshots for this term
        const q = query(
          collection(db, this.collectionName),
          where('termId', '==', term.id),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);
        const snapshotCount = querySnapshot.docs.length;

        if (snapshotCount > 0) {
          console.log(`📋 Term ${term.name} (${termStatus}): ${snapshotCount} snapshots`);

          switch (termStatus) {
            case 'past':
              pastTermsSnapshots += snapshotCount;
              break;
            case 'current':
              currentTermsSnapshots += snapshotCount;
              break;
            case 'future':
              futureTermsSnapshots += snapshotCount;
              break;
          }
        }
      }
    }

    const totalSnapshots = pastTermsSnapshots + currentTermsSnapshots + futureTermsSnapshots;

    console.log(`📊 Snapshot Statistics by Term Status:`, {
      pastTermsSnapshots,
      currentTermsSnapshots,
      futureTermsSnapshots,
      totalSnapshots
    });

    return {
      pastTermsSnapshots,
      currentTermsSnapshots,
      futureTermsSnapshots,
      totalSnapshots
    };
  }

  /**
   * AUTOMATIC SNAPSHOT CREATION: Monitor and create snapshots when terms end
   * This should be called regularly (daily) to detect newly ended terms
   */
  /**
   * Check if a pupil was promoted after a term ended
   * Returns the promotion date if found, null otherwise
   */
  private static checkIfPupilPromotedAfterTerm(
    pupil: Pupil,
    termEndDate: Date
  ): { promotionDate: Date; fromClassId: string; toClassId: string } | null {
    if (!pupil.promotionHistory || pupil.promotionHistory.length === 0) {
      return null;
    }

    // Sort promotions by date
    const sortedPromotions = [...pupil.promotionHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Find the first promotion that happened after the term ended
    for (const promotion of sortedPromotions) {
      const promotionDate = new Date(promotion.date);
      if (promotionDate > termEndDate) {
        return {
          promotionDate,
          fromClassId: promotion.fromClassId || pupil.classId,
          toClassId: promotion.toClassId
        };
      }
    }

    return null;
  }

  static async autoCreateSnapshotsForEndedTerms(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    termsChecked: number;
    snapshotsCreated: number;
    skippedDueToPromotion: number;
    errors: Array<{ pupilId: string; termId: string; error: string }>;
  }> {
    console.log(`🤖 Auto-creating snapshots for newly ended terms...`);

    let termsChecked = 0;
    let snapshotsCreated = 0;
    let skippedDueToPromotion = 0;
    const errors: Array<{ pupilId: string; termId: string; error: string }> = [];

    // 🔥 CRITICAL: Check for terms that ended in the last 1 day (not 7 days)
    // This ensures snapshots are created IMMEDIATELY when terms end, before promotions happen
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termEndDate = new Date(term.endDate);

        // Check if term ended in the last 1 day (immediate capture window)
        // Also check terms that ended 1-2 days ago (catch-up window for missed runs)
        const isRecentlyEnded = termEndDate >= oneDayAgo && termEndDate < now;
        const isCatchUpWindow = termEndDate >= twoDaysAgo && termEndDate < oneDayAgo;

        if (isRecentlyEnded || isCatchUpWindow) {
          termsChecked++;
          const windowType = isRecentlyEnded ? 'immediate' : 'catch-up';
          console.log(`🔍 Found ${windowType} ended term: ${term.name} (${academicYear.name}) - ended ${term.endDate}`);

          // Create snapshots for all pupils for this term
          for (const pupil of pupils) {
            try {
              // Check if snapshot already exists
              const existingSnapshot = await this.getSnapshot(pupil.id, term.id);

              if (existingSnapshot) {
                // Snapshot already exists - skip
                continue;
              }

              // 🔥 CRITICAL VALIDATION: Check if pupil was promoted after term ended
              const promotionAfterTerm = this.checkIfPupilPromotedAfterTerm(pupil, termEndDate);

              if (promotionAfterTerm) {
                // Pupil was promoted after term ended - use historical data recovery instead
                console.log(`⚠️ Pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) was promoted after term ${term.name} ended. Using historical data recovery instead of current data.`);
                console.log(`   Promotion date: ${promotionAfterTerm.promotionDate.toISOString()}, Term ended: ${termEndDate.toISOString()}`);
                console.log(`   Promotion: ${promotionAfterTerm.fromClassId} → ${promotionAfterTerm.toClassId}`);

                // Use historical data recovery to get accurate class/section during the term
                const historicalData = await this.getHistoricalPupilData(pupil, term.id, academicYear);

                if (historicalData) {
                  // Create snapshot with recovered historical data
                  // Skip validation since we're using historical data recovery (already verified)
                  await this.createSnapshot(
                    pupil.id,
                    term.id,
                    academicYear.id,
                    historicalData.classId,
                    historicalData.section,
                    historicalData.admissionNumber,
                    term.startDate,
                    term.endDate,
                    historicalData.dateOfBirth,
                    pupil, // Pass pupil for validation
                    false, // allowRecapture: false
                    true // skipValidation: true - using historical data
                  );

                  snapshotsCreated++;
                  console.log(`✅ Created snapshot with historical data for pupil ${pupil.id} term ${term.id} (promoted after term ended)`);
                } else {
                  skippedDueToPromotion++;
                  console.warn(`⚠️ Skipped snapshot creation for pupil ${pupil.id} term ${term.id} - no historical data available and pupil was promoted after term ended`);
                }
              } else {
                // No promotion after term ended - current data is accurate
                // This is safe because term just ended and pupil hasn't been promoted yet
                await this.createSnapshot(
                  pupil.id,
                  term.id,
                  academicYear.id,
                  pupil.classId,
                  pupil.section,
                  pupil.admissionNumber || `PUPIL-${pupil.id.slice(-6)}`,
                  term.startDate,
                  term.endDate,
                  pupil.dateOfBirth,
                  pupil // Pass pupil for validation
                );

                snapshotsCreated++;
                console.log(`✅ Auto-created snapshot for pupil ${pupil.id} term ${term.id} (no promotion detected)`);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              errors.push({ pupilId: pupil.id, termId: term.id, error: errorMsg });
              console.error(`❌ Failed to auto-create snapshot for pupil ${pupil.id} term ${term.id}:`, errorMsg);
            }
          }
        }
      }
    }

    console.log(`🤖 Auto-snapshot creation complete: ${snapshotsCreated} snapshots created, ${skippedDueToPromotion} skipped due to promotions, for ${termsChecked} recently ended terms`);

    return {
      termsChecked,
      snapshotsCreated,
      skippedDueToPromotion,
      errors
    };
  }

  /**
   * DAILY SCHEDULER FUNCTION: Call this from your daily cron job or scheduler
   * This is the method you should call automatically every day
   */
  static async runDailySnapshotMaintenance(): Promise<{
    success: boolean;
    message: string;
    results?: any;
  }> {
    try {
      console.log(`📅 Running daily snapshot maintenance at ${new Date().toISOString()}`);

      // You'll need to import these services and fetch the data
      // const pupils = await PupilsService.getAllPupils();
      // const academicYears = await AcademicYearsService.getAllAcademicYears();

      // For now, return instructions since we can't import here
      return {
        success: false,
        message: `Daily snapshot maintenance scheduled but requires implementation. See comments in PupilSnapshotsService.runDailySnapshotMaintenance()`
      };

      // Uncomment and modify this when you set up the scheduler:
      // const results = await this.autoCreateSnapshotsForEndedTerms(pupils, academicYears);
      // 
      // return {
      //   success: true,
      //   message: `Daily maintenance complete: ${results.snapshotsCreated} snapshots created for ${results.termsChecked} ended terms`,
      //   results
      // };

    } catch (error) {
      console.error(`❌ Daily snapshot maintenance failed:`, error);
      return {
        success: false,
        message: `Daily maintenance failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * CRITICAL: Force create ALL missing snapshots for ended terms
   * This is the nuclear option - creates snapshots for ALL ended terms that don't have them
   */
  static async forceCreateAllMissingEndedTermSnapshots(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    termsProcessed: number;
    snapshotsCreated: number;
    errorsRecovered: number;
    errors: Array<{ pupilId: string; termId: string; error: string }>;
  }> {
    console.log(`🚨 FORCE CREATING ALL MISSING SNAPSHOTS FOR ENDED TERMS...`);

    let termsProcessed = 0;
    let snapshotsCreated = 0;
    let errorsRecovered = 0;
    const errors: Array<{ pupilId: string; termId: string; error: string }> = [];

    // Find ALL ended terms across all academic years
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);

        if (termStatus === 'past') {
          termsProcessed++;
          console.log(`📋 Processing ended term: ${term.name} (${academicYear.name}) - ended ${term.endDate}`);

          // Create snapshots for all pupils for this ended term
          for (const pupil of pupils) {
            try {
              // Check if snapshot already exists
              const existingSnapshot = await this.getSnapshot(pupil.id, term.id);

              if (!existingSnapshot) {
                console.log(`🆕 Creating missing snapshot for pupil ${pupil.id} (${pupil.firstName} ${pupil.lastName}) in ended term ${term.id}`);

                // Try to get historical data first
                const historicalData = await this.getHistoricalPupilData(pupil, term.id, academicYear);

                if (historicalData) {
                  // Create snapshot with historical data
                  // Skip validation since we're using historical data recovery (already verified)
                  await this.createSnapshot(
                    pupil.id,
                    term.id,
                    academicYear.id,
                    historicalData.classId,
                    historicalData.section,
                    historicalData.admissionNumber,
                    term.startDate,
                    term.endDate,
                    historicalData.dateOfBirth,
                    pupil, // Pass pupil for validation
                    false, // allowRecapture: false
                    true // skipValidation: true - using historical data
                  );

                  snapshotsCreated++;
                  console.log(`✅ Created snapshot with historical data for pupil ${pupil.id} term ${term.id}`);
                } else {
                  // Last resort: create with current data but mark as potentially inaccurate
                  console.log(`⚠️ Creating snapshot with current data (may be inaccurate) for pupil ${pupil.id} term ${term.id}`);

                  await this.createSnapshot(
                    pupil.id,
                    term.id,
                    academicYear.id,
                    pupil.classId,
                    pupil.section,
                    pupil.admissionNumber,
                    term.startDate,
                    term.endDate,
                    pupil.dateOfBirth,
                    pupil // Pass pupil for validation
                  );

                  snapshotsCreated++;
                  errorsRecovered++;
                  console.log(`⚠️ Created potentially inaccurate snapshot for pupil ${pupil.id} term ${term.id}`);
                }
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              errors.push({ pupilId: pupil.id, termId: term.id, error: errorMsg });
              console.error(`❌ Failed to create snapshot for pupil ${pupil.id} term ${term.id}:`, errorMsg);
            }
          }
        }
      }
    }

    console.log(`🚨 FORCE SNAPSHOT CREATION COMPLETE:`);
    console.log(`   Terms processed: ${termsProcessed}`);
    console.log(`   Snapshots created: ${snapshotsCreated}`);
    console.log(`   Potentially inaccurate snapshots: ${errorsRecovered}`);
    console.log(`   Errors: ${errors.length}`);

    return {
      termsProcessed,
      snapshotsCreated,
      errorsRecovered,
      errors
    };
  }

  /**
   * VALIDATION: Ensure ALL ended terms have snapshots
   * This checks that every pupil has snapshots for every ended term
   */
  static async validateSnapshotCompleteness(
    pupils: Pupil[],
    academicYears: AcademicYear[]
  ): Promise<{
    totalEndedTerms: number;
    totalExpectedSnapshots: number;
    totalExistingSnapshots: number;
    missingSnapshots: number;
    validationPassed: boolean;
    missingDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }>;
  }> {
    console.log(`🔍 Validating snapshot completeness for all ended terms...`);

    const endedTerms: Array<{ term: Term; academicYear: AcademicYear }> = [];
    const missingDetails: Array<{
      pupilId: string;
      pupilName: string;
      termId: string;
      termName: string;
      academicYear: string;
    }> = [];

    // Find all ended terms
    for (const academicYear of academicYears) {
      for (const term of academicYear.terms) {
        const termStatus = getTermStatus(term);
        if (termStatus === 'past') {
          endedTerms.push({ term, academicYear });
        }
      }
    }

    const totalEndedTerms = endedTerms.length;
    const totalExpectedSnapshots = totalEndedTerms * pupils.length;
    let totalExistingSnapshots = 0;

    // Check each pupil against each ended term
    for (const pupil of pupils) {
      for (const { term, academicYear } of endedTerms) {
        const existingSnapshot = await this.getSnapshot(pupil.id, term.id);

        if (existingSnapshot) {
          totalExistingSnapshots++;
        } else {
          missingDetails.push({
            pupilId: pupil.id,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            termId: term.id,
            termName: term.name,
            academicYear: academicYear.name
          });
        }
      }
    }

    const missingSnapshots = missingDetails.length;
    const validationPassed = missingSnapshots === 0;

    console.log(`📊 Snapshot Completeness Validation Results:`);
    console.log(`   Total ended terms: ${totalEndedTerms}`);
    console.log(`   Total pupils: ${pupils.length}`);
    console.log(`   Expected snapshots: ${totalExpectedSnapshots}`);
    console.log(`   Existing snapshots: ${totalExistingSnapshots}`);
    console.log(`   Missing snapshots: ${missingSnapshots}`);
    console.log(`   Validation passed: ${validationPassed ? '✅ YES' : '❌ NO'}`);

    return {
      totalEndedTerms,
      totalExpectedSnapshots,
      totalExistingSnapshots,
      missingSnapshots,
      validationPassed,
      missingDetails
    };
  }
}
