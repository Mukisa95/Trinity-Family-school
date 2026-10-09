/** Always show all three units so long waits never appear as 120 minutes. */
export function formatTimetableCountdown(seconds: number): string {
    const remaining = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remaining % 60).padStart(2, '0')}s`;
}
