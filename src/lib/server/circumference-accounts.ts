import { createHash } from 'crypto';
import type { AuthenticatedAppUser } from './app-auth';
import { circumferenceOf, circumferenceWithin, validateCircumference } from '@/lib/access/circumference';
import { CircumferenceError } from './circumference';

export function assignableCircumference(actor: AuthenticatedAppUser, input: unknown, role = 'Staff') {
  let scope;
  try { scope = validateCircumference(input); } catch (error) { throw new CircumferenceError(error instanceof Error ? error.message : 'Invalid Circumference.', 400); }
  if (actor.user.role !== 'Admin' && (role === 'Admin' || !circumferenceWithin(scope, circumferenceOf(actor.user)))) throw new CircumferenceError('You can only grant access within your own Circumference.');
  return scope;
}
export function circumferenceClaims(data: { role?: string; circumference?: unknown }) {
  const scope = validateCircumference(data.circumference);
  return { circumferenceHash: createHash('sha256').update(JSON.stringify(scope)).digest('hex'),
    circumferenceRestricted: data.role === 'Staff' && [scope.classIds, scope.sections, scope.genders].some(axis => axis !== null) };
}
