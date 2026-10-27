import { dutyServiceCacheName } from '@/lib/duty-service/contracts';
import { getEventCacheScope } from '@/lib/cache/event-cache';
import { circumferenceOf, hasCircumference } from '@/lib/access/circumference';
import type { SystemUser } from '@/types';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { ANDROID_OFFLINE_SESSION_DAYS, type AndroidOfflineSession } from './android-contracts';

export function createAndroidOfflineSession(user: SystemUser, pupilIds: string[], now = new Date(), features: { events?: boolean; dutyService?: boolean } = { events: true }): AndroidOfflineSession {
  const parent = user.role === 'Parent';
  const can = (module: string, page: string, action: string) => Permissions.canAccessPage(user, module, page)
    && Permissions.canPerformAction(user, module, page, action);
  const pupils = !parent && can('pupils', 'detail', 'access_page');
  const fields = ['id'];
  if (pupils) {
    fields.push('firstName', 'lastName', 'otherNames', 'admissionNumber', 'classId', 'className', 'classCode', 'streamId', 'streamName', 'streamCode', 'status', 'photo');
    if (can('pupils', 'detail', 'view_personal_info')) fields.push('gender', 'dateOfBirth', 'section', 'nationality', 'religion', 'registrationDate', 'address');
    if (can('pupils', 'detail', 'view_guardian_info')) fields.push('guardians');
    if (can('pupils', 'detail', 'view_medical_info')) fields.push('medicalConditions', 'allergies', 'bloodGroup', 'emergencyContact');
    if (can('pupils', 'detail', 'view_siblings')) fields.push('familyId');
    if (can('pupils', 'detail', 'view_academic_info')) fields.push('academicHistory', 'additionalIdentifiers');
  }
  const counts = ['pupils', 'staff'].filter(name => can('reports', 'dashboard', `view_stat_total_${name}`));
  return {
    schema: 1, accountId: user.id, role: user.role,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
    timeZone: 'Africa/Kampala',
    issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ANDROID_OFFLINE_SESSION_DAYS * 86400_000).toISOString(),
    pupilIds: parent || hasCircumference(user) ? [...new Set(pupilIds)] : [],
    circumference: hasCircumference(user) ? circumferenceOf(user) : undefined,
    grants: {
      dashboard: !parent && Permissions.canAccessPage(user, 'reports', 'dashboard'), pupils,
      timetable: !parent && can('timetable', 'list', 'view_timetable'),
      ...(features.events ? {
        events: !parent && (can('events', 'calendar', 'view_calendar') || can('events', 'calendar', 'view_events')),
        eventCacheScope: !parent ? getEventCacheScope(user.id, user.role, user.familyId) : '',
      } : {}),
      ...(features.dutyService ? { dutyService: !parent && user.isActive !== false && Permissions.canAccessPage(user, 'duty_service', 'list'), dutyServiceCacheName: !parent ? dutyServiceCacheName(user) : '' } : {}),
      pupilFields: fields, dashboardCounts: counts,
    },
  };
}
