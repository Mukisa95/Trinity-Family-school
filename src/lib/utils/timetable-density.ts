/** One width calculation for headers, merged blocks and the live time marker. */
export function getTimetablePeriodWidth(durationMinutes: number, zoom: number, compact: boolean) {
    const duration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 40;
    return Math.max(40, Math.round(duration * (compact ? 1.2 : 1.8) * zoom));
}
