import type { DutyRota, DutyAssignment, DutyTimeline, DutyPeriod } from '@/types/duty-service';

export function generateDutyTimeline(rota: DutyRota, assignments: DutyAssignment[]): DutyTimeline {
  const periods: DutyPeriod[] = [];
  const startDate = new Date(rota.startDate);
  const endDate = new Date(rota.endDate);
  const currentDate = new Date();

  let periodNumber = 1;
  let currentPeriodStart = new Date(startDate);

  while (currentPeriodStart < endDate) {
    let periodEnd: Date;
    let periodName: string;

    switch (rota.frequency) {
      case 'daily':
        periodEnd = new Date(currentPeriodStart);
        periodEnd.setDate(periodEnd.getDate());
        periodName = `Day ${periodNumber}`;
        break;
      case 'weekly':
        periodEnd = new Date(currentPeriodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodName = `Week ${periodNumber}`;
        break;
      case 'monthly':
        periodEnd = new Date(currentPeriodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
        periodName = `Month ${periodNumber}`;
        break;
      case 'termly':
        periodEnd = new Date(endDate);
        periodName = `Term ${periodNumber}`;
        break;
      case 'yearly':
        periodEnd = new Date(endDate);
        periodName = `Year ${periodNumber}`;
        break;
      default:
        periodEnd = new Date(currentPeriodStart);
        periodName = `Period ${periodNumber}`;
    }

    // Ensure period doesn't exceed the overall end date
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    const periodStartStr = currentPeriodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // Find assignments for this period
    const periodAssignments = assignments.filter(assignment =>
      assignment.rotaId === rota.id &&
      assignment.startDate <= periodEndStr &&
      assignment.endDate >= periodStartStr
    );

    const isCompleted = periodEnd < currentDate;
    const isCurrent = currentPeriodStart <= currentDate && currentDate <= periodEnd;
    const isUpcoming = currentPeriodStart > currentDate;

    periods.push({
      periodNumber,
      startDate: periodStartStr,
      endDate: periodEndStr,
      periodName,
      assignments: periodAssignments,
      isCompleted,
      isCurrent,
      isUpcoming
    });

    // Move to next period
    if (rota.frequency === 'termly' || rota.frequency === 'yearly') {
      break; // Only one period for termly/yearly
    }

    currentPeriodStart = new Date(periodEnd);
    currentPeriodStart.setDate(currentPeriodStart.getDate() + 1);
    periodNumber++;
  }

  const completedPeriods = periods.filter(p => p.isCompleted).length;
  const currentPeriod = periods.find(p => p.isCurrent);
  const upcomingPeriods = periods.filter(p => p.isUpcoming);

  return {
    rotaId: rota.id,
    rotaName: rota.dutyName,
    frequency: rota.frequency,
    periods,
    totalPeriods: periods.length,
    completedPeriods,
    currentPeriod,
    upcomingPeriods
  };
}
