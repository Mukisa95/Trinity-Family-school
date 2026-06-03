import type { Pupil, PupilStatus, StatusChangeHistoryEntry } from "@/types";

/**
 * Determines what a pupil's status was on a specific date, accounting for their status change history.
 * A pupil is considered "Active" if they were enrolled and not yet graduated/transferred/inactive.
 * 
 * @param pupil The pupil object containing current status and historical changes
 * @param targetDateStr ISO date string (YYYY-MM-DD or full timestamp) to check status on
 * @returns boolean indicating if the pupil was active on the target date
 */
export const wasPupilActiveOnDate = (pupil: Pupil, targetDateStr: string): boolean => {
  const targetDate = targetDateStr.split('T')[0];

  // Fast path: if graduated and before graduationDate, they were active
  if (pupil.status === "Graduated" && pupil.graduationDate) {
    if (targetDate < pupil.graduationDate) return true;
    if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) return false;
  }

  // If there's no history, we only have their current status to go by
  if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) {
    return pupil.status === "Active" || pupil.status === "Pending" || pupil.status === "";
  }

  // Walk history chronologically (oldest first) to replay their status up to the target date
  const sortedHistory = [...pupil.statusChangeHistory].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Initial status is whatever the 'fromStatus' of the very first change was
  // (Usually this is 'N/A' or 'Pending' or 'Active')
  let currentStatusStatusAtDate: PupilStatus = sortedHistory[0].fromStatus === 'N/A' ? 'Active' : sortedHistory[0].fromStatus;

  // Replay all changes that happened ON or BEFORE the target date
  for (const entry of sortedHistory) {
    const entryDate = entry.date.split('T')[0];
    
    // If this change took effect on or before our target date, apply it
    if (entryDate <= targetDate) {
      currentStatusStatusAtDate = entry.toStatus;
    } else {
      // As soon as we hit a change that happened AFTER our target date,
      // the status right before it is what was in effect on the target date
      break;
    }
  }

  return currentStatusStatusAtDate === "Active" || currentStatusStatusAtDate === "Pending" || currentStatusStatusAtDate === "";
};

/**
 * Determines if a pupil was active for *at least one day* within a given date range.
 * Used for weekly/monthly summary views where a pupil should appear if they were enrolled
 * during any part of the reporting period.
 * 
 * @param pupil The pupil object
 * @param startDateStr Start date ISO string
 * @param endDateStr End date ISO string
 * @returns boolean true if pupil was active on ANY date in the range
 */
export const wasPupilActiveInDateRange = (pupil: Pupil, startDateStr: string, endDateStr: string): boolean => {
  const start = startDateStr.split('T')[0];
  const end = endDateStr.split('T')[0];

  // If currently active and no history, they were active the whole time
  if (
    (pupil.status === "Active" || pupil.status === "Pending" || pupil.status === "") && 
    (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0)
  ) {
    return true;
  }

  // If currently graduated and graduation date is known
  if (pupil.status === "Graduated" || pupil.status === "Inactive" || pupil.status === "Transferred") {
    if (pupil.graduationDate) {
      // If graduation happened before the range started, they were NOT active
      if (pupil.graduationDate <= start) {
        return false;
      }
      // If graduation happened after the range started, they WERE active for at least part of it
      return true;
    }
  }

  // Complex history walking logic - check the start date and end date
  // Since students rarely drop in and out multiple times in a week/month,
  // checking if they were active on the start OR end date, OR if a status change occurred inside the boundary
  
  const wasActiveAtStart = wasPupilActiveOnDate(pupil, start);
  const wasActiveAtEnd = wasPupilActiveOnDate(pupil, end);

  if (wasActiveAtStart || wasActiveAtEnd) return true;

  // Pupil might have enrolled AND dropped out entirely within the date window
  if (pupil.statusChangeHistory && pupil.statusChangeHistory.length > 0) {
    return pupil.statusChangeHistory.some(entry => {
      const entryDate = entry.date.split('T')[0];
      return entryDate >= start && entryDate <= end && (entry.toStatus === "Active" || entry.fromStatus === "Active");
    });
  }

  return false;
};
