import { Event, EventStatus } from '@/types';
import { isBefore, isAfter, isWithinInterval, parseISO } from 'date-fns';

/**
 * Dynamically computes the status of an event based on its dates and current time.
 * Logic:
 * - If current date/time is before the start date/time, it is 'Scheduled'.
 * - If current date/time is within the start and end date/time, it is 'Ongoing'.
 * - If current date/time is after the end date/time, it is 'Completed'.
 * 
 * Special handling:
 * - Falls back to the stored event.status if it was marked as 'Cancelled' or 'Draft' and we still want to respect that.
 *   However, in our current requirements, we only surface Scheduled, Ongoing, Completed.
 *   We will still return 'Cancelled' or 'Draft' if specifically stored, but UI will likely phase them out.
 */
export function getComputedEventStatus(event: Partial<Event>): EventStatus {
    // If explicitly cancelled, we might want to keep that state if it's still needed, but for now we prioritize computed
    if (event.status === 'Cancelled' || event.status === 'Draft') {
        return event.status;
    }

    const now = new Date();

    try {
        const startDateTimeStr = event.isAllDay
            ? `${event.startDate}T00:00:00`
            : `${event.startDate}T${event.startTime || '00:00'}:00`;

        // For all-day events, the end time is essentially the end of the day.
        const endDateTimeStr = event.isAllDay
            ? `${event.endDate}T23:59:59`
            : `${event.endDate}T${event.endTime || '23:59'}:59`;

        const start = parseISO(startDateTimeStr);
        const end = parseISO(endDateTimeStr);

        if (isBefore(now, start)) {
            return 'Scheduled';
        }

        if (isAfter(now, end)) {
            return 'Completed';
        }

        // If it's not before start and not after end, it must be ongoing
        return 'Ongoing';
    } catch (error) {
        // Fallback if dates are invalid or missing
        return event.status || 'Scheduled';
    }
}
