import { authorizedFetch } from '@/lib/access/authorized-fetch';
import type { Event } from '@/types';
export async function saveEventPlan(eventData: Partial<Event>, eventId?: string, exam?: Record<string, unknown>): Promise<{
    event: Event;
    examIds: string[];
}> {
    const response = await authorizedFetch('/api/events/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, eventData, exam }) });
    const result = await response.json();
    if (!response.ok)
        throw new Error(result.error || 'The event and its reminders could not be saved.');
    return result;
}
