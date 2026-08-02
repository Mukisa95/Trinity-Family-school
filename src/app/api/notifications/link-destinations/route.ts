import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const dynamic = 'force-dynamic';
export const revalidate = false;

type DestinationEntity = 'pupil' | 'class';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function pupilLabel(data: Record<string, unknown>) {
  const nameFromFields = [text(data.firstName), text(data.lastName), text(data.otherNames)]
    .filter(Boolean)
    .join(' ');
  return nameFromFields || text(data.fullName) || text(data.name) || 'Unnamed pupil';
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const canSend = GranularPermissionService.canPerformAction(
      actor.user,
      'notifications',
      'list',
      'send_notification',
    );
    if (!canSend) {
      return NextResponse.json({ error: 'You do not have permission to create notification links.' }, { status: 403 });
    }

    const entity = request.nextUrl.searchParams.get('entity') as DestinationEntity | null;
    const search = text(request.nextUrl.searchParams.get('q')).toLowerCase();
    if (!entity || !['pupil', 'class'].includes(entity)) {
      return NextResponse.json({ error: 'Choose a supported destination type.' }, { status: 400 });
    }
    if (search.length < 2) return NextResponse.json({ results: [] });
    const searchTerms = search.split(/\s+/).filter(Boolean);

    await ensureServerFirestoreAuth();
    const db = getFirestore(getFirebaseAdminApp());
    const collectionName = entity === 'pupil' ? 'pupils' : 'classes';
    const snapshot = await db.collection(collectionName).limit(1000).get();
    const results = snapshot.docs
      .map(document => ({ id: document.id, data: document.data() as Record<string, unknown> }))
      .map(({ id, data }) => {
        if (entity === 'pupil') {
          const label = pupilLabel(data);
          const admissionNumber = text(data.admissionNumber)
            || text(data.learnerIdentificationNumber)
            || text(data.pupilIdentificationNumber)
            || text(data.registrationNumber);
          const className = text(data.className);
          return {
            id,
            label,
            description: [admissionNumber && `Admission ${admissionNumber}`, className].filter(Boolean).join(' · '),
            matchText: `${label} ${admissionNumber} ${className}`.toLowerCase(),
          };
        }
        const label = text(data.name) || text(data.className) || text(data.code) || 'Unnamed class';
        const code = text(data.code) || text(data.classCode);
        return { id, label, description: code, matchText: `${label} ${code}`.toLowerCase() };
      })
      .filter(result => searchTerms.every(term => result.matchText.includes(term)))
      .sort((left, right) => {
        const leftStarts = left.matchText.startsWith(search) ? 0 : 1;
        const rightStarts = right.matchText.startsWith(search) ? 0 : 1;
        return leftStarts - rightStarts || left.label.localeCompare(right.label);
      })
      .slice(0, 12)
      .map(({ matchText: _matchText, ...result }) => result);

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search application records.';
    const status = message === 'AUTH_REQUIRED' || message === 'APP_AUTH_REQUIRED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in again to search application records.' : message }, { status });
  }
}
