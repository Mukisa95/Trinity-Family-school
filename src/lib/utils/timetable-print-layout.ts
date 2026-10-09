import type { GeneratedPeriod, TimetableEntry, TimetableProfile } from '@/types';
import {
    findTimetableEntryForRow,
    getTimetableRenderedPeriodSpan,
    getTimetableStreamMode,
    type TimetableClassRow,
} from '@/lib/utils/timetable-streams';

export type TimetablePrintCell = {
    periodIndex: number;
    rowSpan: number;
    colSpan: number;
    entry?: TimetableEntry;
};

export const isTimetablePrintBreak = (period: GeneratedPeriod) =>
    period.type === 'break' || period.type === 'lunch' || period.type === 'assembly';

/** Plan every occupied slot, including rows beneath merged activities and stream lessons. */
export function buildTimetablePrintDayCells(
    rows: TimetableClassRow[],
    templatePeriods: GeneratedPeriod[],
    periods: GeneratedPeriod[],
    entries: TimetableEntry[],
    dayId: number,
    profile?: Pick<TimetableProfile, 'streamLayouts'>,
): TimetablePrintCell[][] {
    const covered = rows.map(() => templatePeriods.map(isTimetablePrintBreak));
    return rows.map((row, rowIndex) => {
        const cells: TimetablePrintCell[] = [];
        templatePeriods.forEach((template, periodIndex) => {
            if (covered[rowIndex][periodIndex]) return;
            const period = periods.find(candidate => candidate.dayOfWeek === dayId
                && candidate.type === template.type && candidate.periodNumber === template.periodNumber);
            const mode = getTimetableStreamMode(profile, row.classItem.id, dayId, period?.id);
            const groupEntry = period && entries.find(candidate => candidate.periodId === period.id
                && !candidate.streamId && candidate.entryType === 'activity'
                && candidate.linkedClassIds?.length
                && [candidate.classId, ...candidate.linkedClassIds].includes(row.classItem.id));
            const entry = groupEntry || (period && findTimetableEntryForRow(
                entries, row.classItem.id, period.id, mode, mode === 'separate' ? row.stream?.id : undefined,
            ));
            let rowSpan = row.stream && mode === 'consolidated' ? row.streamCount - row.streamIndex : 1;
            if (groupEntry) {
                const groupIds = [groupEntry.classId, ...(groupEntry.linkedClassIds || [])];
                rowSpan = 1;
                // Non-adjacent linked classes must not hide intervening class rows.
                while (rowIndex + rowSpan < rows.length && groupIds.includes(rows[rowIndex + rowSpan].classItem.id)) rowSpan++;
            }
            rowSpan = Math.min(rowSpan, rows.length - rowIndex);
            let colSpan = getTimetableRenderedPeriodSpan(templatePeriods, periodIndex, entry?.periodSpan);
            for (let offset = 1; offset < colSpan; offset++) {
                if (covered.slice(rowIndex, rowIndex + rowSpan).some(slots => slots[periodIndex + offset])) {
                    colSpan = offset;
                    break;
                }
            }
            for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
                for (let c = periodIndex; c < periodIndex + colSpan; c++) covered[r][c] = true;
            }
            cells.push({ periodIndex, rowSpan, colSpan, entry: entry || undefined });
        });
        return cells;
    });
}

export type PrintTextMeasurement = { width: number; height: number };

/** Fit the full line box inside 75% of the cell, with a minimum border clearance. */
export function fitTimetablePrintText(
    lines: string[], width: number, height: number,
    measure: (line: string) => PrintTextMeasurement,
    direction: 'horizontal' | 'vertical' | 'rotated' = 'horizontal',
): number {
    const measured = lines.map(measure);
    const textWidth = Math.max(1, ...measured.map(size => size.width));
    const glyphHeight = Math.max(1, ...measured.map(size => size.height));
    const boxWidth = direction === 'rotated' ? height : width;
    const boxHeight = direction === 'rotated' ? width : height;
    const availableWidth = Math.max(1, boxWidth - 2 * Math.max(3, boxWidth * 0.125));
    const availableHeight = Math.max(1, boxHeight - 2 * Math.max(2, boxHeight * 0.125));
    const lineCount = Math.max(1, lines.length);
    const heightAt100 = lineCount * Math.max(direction === 'vertical' ? 100 : 115, glyphHeight);
    return Math.max(1, Math.floor(Math.min(availableWidth / textWidth, availableHeight / heightAt100) * 100 * 2) / 2);
}

/** Pick line breaks that make a long label largest in its own cell. */
export function layoutTimetablePrintText(
    text: string, width: number, height: number,
    measure: (line: string) => PrintTextMeasurement,
): { lines: string[]; fontSize: number } {
    let best = { lines: [text], fontSize: fitTimetablePrintText([text], width, height, measure) };
    const words = text.trim().split(/\s+/);
    const widths = new Set<number>();
    for (let start = 0; start < words.length; start++) {
        for (let end = start + 1; end <= words.length; end++) widths.add(measure(words.slice(start, end).join(' ')).width);
    }
    for (const maxWidth of widths) {
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (line && measure(next).width > maxWidth) { lines.push(line); line = word; }
            else line = next;
        }
        if (line) lines.push(line);
        const fontSize = fitTimetablePrintText(lines, width, height, measure);
        if (fontSize > best.fontSize) best = { lines, fontSize };
    }
    return best;
}
