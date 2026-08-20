import { FieldValue, Timestamp, getFirestore, type DocumentData, type UpdateData } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { assertUniqueStreams, joinClassAndStream } from '@/lib/utils/class-streams';
import type { Class, ClassStreamConfiguration, Pupil, PupilAcademicYearHistoryEntry } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TRANSACTION_PUPILS = 200;

type StreamAssignmentRequest = {
  academicYearId: string;
  activeStreamIds: string[];
  assignments: Array<{ pupilId: string; streamId: string }>;
  expectedVersion: number;
  operationId: string;
  enabled?: boolean;
};

function cleanId(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} is required.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 200 || cleaned.includes('/')) throw new Error(`${field} is invalid.`);
  return cleaned;
}

function parseBody(value: unknown): StreamAssignmentRequest {
  if (!value || typeof value !== 'object') throw new Error('A stream setup payload is required.');
  const body = value as Record<string, unknown>;
  const activeStreamIds = Array.isArray(body.activeStreamIds)
    ? Array.from(new Set(body.activeStreamIds.map(item => cleanId(item, 'streamId'))))
    : [];
  const assignments = Array.isArray(body.assignments)
    ? body.assignments.map(item => {
        if (!item || typeof item !== 'object') throw new Error('Every assignment must identify a pupil and stream.');
        const assignment = item as Record<string, unknown>;
        return {
          pupilId: cleanId(assignment.pupilId, 'pupilId'),
          streamId: cleanId(assignment.streamId, 'streamId'),
        };
      })
    : [];
  const expectedVersion = Number(body.expectedVersion ?? 0);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error('expectedVersion is invalid.');
  return {
    academicYearId: cleanId(body.academicYearId, 'academicYearId'),
    activeStreamIds,
    assignments,
    expectedVersion,
    operationId: cleanId(body.operationId, 'operationId'),
    enabled: body.enabled !== false,
  };
}

function updateAcademicYearHistory(
  history: PupilAcademicYearHistoryEntry[] | undefined,
  academicYearId: string,
  stream: { id: string; name: string; code: string } | null,
): PupilAcademicYearHistoryEntry[] | undefined {
  if (!history?.some(entry => entry.academicYearId === academicYearId)) return history;
  return history.map(entry => entry.academicYearId !== academicYearId
    ? entry
    : stream
      ? { ...entry, streamId: stream.id, streamName: stream.name, streamCode: stream.code }
      : (() => {
          const { streamId: _streamId, streamName: _streamName, streamCode: _streamCode, ...withoutStream } = entry;
          return withoutStream;
        })());
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    const canManage = GranularPermissionService.canPerformAction(actor.user, 'classes', 'detail', 'manage_streams')
      || GranularPermissionService.canPerformAction(actor.user, 'classes', 'list', 'edit_class');
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage class streams.' }, { status: 403 });
    }

    const { classId: rawClassId } = await params;
    const classId = cleanId(rawClassId, 'classId');
    const body = parseBody(await request.json());
    const adminDb = getFirestore(getFirebaseAdminApp());
    const classRef = adminDb.collection('classes').doc(classId);
    const operationRef = adminDb.collection('classStreamOperations').doc(body.operationId);

    const result = await adminDb.runTransaction(async transaction => {
      const operationSnapshot = await transaction.get(operationRef);
      if (operationSnapshot.exists) {
        return { duplicate: true, ...(operationSnapshot.data()?.result || {}) };
      }

      const classSnapshot = await transaction.get(classRef);
      if (!classSnapshot.exists) throw new Error('CLASS_NOT_FOUND');
      const schoolClass = { id: classSnapshot.id, ...classSnapshot.data() } as Class;
      const streams = schoolClass.streams || [];
      assertUniqueStreams(streams);
      const streamById = new Map(streams.map(stream => [stream.id, stream]));

      if (body.enabled && body.activeStreamIds.length === 0) {
        throw new Error('Choose at least one active stream.');
      }
      body.activeStreamIds.forEach(streamId => {
        if (!streamById.has(streamId)) throw new Error('A selected stream no longer exists. Refresh and try again.');
      });

      const currentConfiguration = (schoolClass.streamConfigurations || [])
        .find(configuration => configuration.academicYearId === body.academicYearId);
      const currentVersion = currentConfiguration?.version || 0;
      if (currentVersion !== body.expectedVersion) throw new Error('STREAM_SETUP_STALE');

      const pupilsSnapshot = await transaction.get(
        adminDb.collection('pupils').where('classId', '==', classId),
      );
      const pupils = pupilsSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Pupil));
      const activePupils = pupils.filter(pupil => pupil.status === 'Active');
      if (activePupils.length > MAX_TRANSACTION_PUPILS) throw new Error('CLASS_TOO_LARGE');

      const assignmentMap = new Map<string, string>();
      body.assignments.forEach(assignment => {
        if (assignmentMap.has(assignment.pupilId)) throw new Error('A pupil was assigned more than once.');
        assignmentMap.set(assignment.pupilId, assignment.streamId);
      });

      if (body.enabled) {
        const activePupilIds = new Set(activePupils.map(pupil => pupil.id));
        if (assignmentMap.size !== activePupils.length) throw new Error('Every active pupil must be assigned to one stream.');
        assignmentMap.forEach((streamId, pupilId) => {
          if (!activePupilIds.has(pupilId)) throw new Error('An assignment contains a pupil who is no longer active in this class.');
          if (!body.activeStreamIds.includes(streamId)) throw new Error('An assignment uses a disabled stream.');
        });
        const usedStreams = new Set(assignmentMap.values());
        body.activeStreamIds.forEach(streamId => {
          if (!usedStreams.has(streamId)) throw new Error('Every active stream must contain at least one pupil.');
        });
      } else if (assignmentMap.size > 0) {
        throw new Error('Disabled stream setup cannot contain assignments.');
      }

      const operationalRef = adminDb.collection('settings').doc('data-revisions-operational');
      const referenceRef = adminDb.collection('settings').doc('data-revisions-reference');
      const legacySettingsRef = adminDb.collection('settings').doc('school-settings');
      const operationalSnapshot = await transaction.get(operationalRef);
      const referenceSnapshot = await transaction.get(referenceRef);
      const legacySnapshot = await transaction.get(legacySettingsRef);
      const currentPupilRevision = Math.max(
        Number(operationalSnapshot.data()?.pupils || 0),
        Number(legacySnapshot.data()?.dataRevisions?.pupils || 0),
      );
      const changedPupils = activePupils.filter(pupil => {
        const nextStreamId = body.enabled ? assignmentMap.get(pupil.id) : undefined;
        return pupil.streamId !== nextStreamId || pupil.streamAcademicYearId !== body.academicYearId;
      });
      const lastPupilRevision = currentPupilRevision + changedPupils.length;
      const now = new Date().toISOString();
      const nextConfiguration: ClassStreamConfiguration = {
        academicYearId: body.academicYearId,
        activeStreamIds: body.enabled ? body.activeStreamIds : [],
        enabled: Boolean(body.enabled),
        version: currentVersion + 1,
        configuredAt: now,
        configuredBy: actor.decoded.uid,
      };
      const nextConfigurations = [
        ...(schoolClass.streamConfigurations || []).filter(configuration => configuration.academicYearId !== body.academicYearId),
        nextConfiguration,
      ];

      transaction.update(classRef, { streamConfigurations: nextConfigurations });
      transaction.set(referenceRef, { classes: Number(referenceSnapshot.data()?.classes || 0) + 1 }, { merge: true });

      changedPupils.forEach((pupil, index) => {
        const pupilRef = adminDb.collection('pupils').doc(pupil.id);
        const stream = body.enabled ? streamById.get(assignmentMap.get(pupil.id) || '') || null : null;
        const update: UpdateData<DocumentData> = stream
          ? {
              streamId: stream.id,
              streamName: stream.name,
              streamCode: stream.code,
              streamClassId: classId,
              streamAcademicYearId: body.academicYearId,
              streamAssignedAt: now,
              streamAssignedBy: actor.decoded.uid,
              className: joinClassAndStream(schoolClass.name, stream.name),
              classCode: joinClassAndStream(schoolClass.code, stream.code),
              updatedAt: now,
            }
          : {
              streamId: FieldValue.delete(),
              streamName: FieldValue.delete(),
              streamCode: FieldValue.delete(),
              streamClassId: FieldValue.delete(),
              streamAcademicYearId: FieldValue.delete(),
              streamAssignedAt: FieldValue.delete(),
              streamAssignedBy: FieldValue.delete(),
              className: schoolClass.name,
              classCode: schoolClass.code,
              updatedAt: now,
            };
        const history = updateAcademicYearHistory(pupil.academicYearHistory, body.academicYearId, stream);
        if (history) update.academicYearHistory = history;
        transaction.update(pupilRef, update);
        const revision = currentPupilRevision + index + 1;
        transaction.set(
          adminDb.collection('pupilCacheChanges').doc(String(revision).padStart(16, '0')),
          { revision, pupilId: pupil.id, operation: 'upsert', changedAt: Timestamp.now() },
        );
      });

      if (changedPupils.length > 0) {
        transaction.set(operationalRef, { pupils: lastPupilRevision }, { merge: true });
      }
      transaction.set(legacySettingsRef, {
        dataRevisions: {
          classes: FieldValue.increment(1),
          ...(changedPupils.length > 0 ? { pupils: lastPupilRevision } : {}),
        },
      }, { merge: true });

      const operationResult = {
        classId,
        academicYearId: body.academicYearId,
        version: nextConfiguration.version,
        changedPupilCount: changedPupils.length,
        activeStreamCount: nextConfiguration.activeStreamIds.length,
      };
      transaction.set(operationRef, {
        ...operationResult,
        assignments: Object.fromEntries(assignmentMap),
        configuredBy: actor.decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
        result: operationResult,
      });
      return { duplicate: false, ...operationResult };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403
        : message === 'CLASS_NOT_FOUND' ? 404
          : message === 'STREAM_SETUP_STALE' ? 409
            : message === 'CLASS_TOO_LARGE' ? 413
              : message === 'Unknown error' ? 500 : 400;
    const publicMessage = message === 'STREAM_SETUP_STALE'
      ? 'Stream setup changed on another device. Refresh before saving.'
      : message === 'CLASS_TOO_LARGE'
        ? 'This class is too large for one safe stream transaction. Contact support.'
        : status >= 500 ? 'Unable to save stream setup.' : message;
    console.error('Class stream setup failed:', error);
    return NextResponse.json({ error: publicMessage }, { status });
  }
}
