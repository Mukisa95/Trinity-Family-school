import { StaffClockingStaffDetails } from '@/components/staff-clocking/staff-clocking-staff-details';

export default async function IndividualStaffClockingPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  return <StaffClockingStaffDetails key={staffId} staffId={staffId} />;
}
