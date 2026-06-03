"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModernDatePicker } from "@/components/common/modern-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { ExcludedDay, AcademicYear } from "@/types";
import {
  useExcludedDays,
  useCreateExcludedDay,
  useUpdateExcludedDay,
  useDeleteExcludedDay
} from "@/lib/hooks/use-excluded-days";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { PlusCircle, Trash2, CalendarOff, ArrowLeft, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

type ExcludedDayType = 'specific_date' | 'recurring_day_of_week' | 'recurring_monthly' | 'recurring_annual';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const MONTHS_OF_YEAR = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function ManageExcludedDaysPage() {
  const { toast } = useToast();
  const { data: excludedDays = [], isLoading: excludedDaysLoading } = useExcludedDays();
  const { data: academicYears = [], isLoading: academicYearsLoading } = useAcademicYears();
  const createExcludedDayMutation = useCreateExcludedDay();
  const updateExcludedDayMutation = useUpdateExcludedDay();
  const deleteExcludedDayMutation = useDeleteExcludedDay();

  const [newExcludedDayType, setNewExcludedDayType] = React.useState<ExcludedDayType>('specific_date');
  const [newExcludedDate, setNewExcludedDate] = React.useState<Date | undefined>(undefined);
  const [newApplicableYearId, setNewApplicableYearId] = React.useState<string>('all');
  const [newRecurringDay, setNewRecurringDay] = React.useState<string | undefined>(undefined);
  const [newRecurringDayOfMonth, setNewRecurringDayOfMonth] = React.useState<string | undefined>(undefined);
  const [newRecurringMonthOfYear, setNewRecurringMonthOfYear] = React.useState<string | undefined>(undefined);
  const [newDescription, setNewDescription] = React.useState("");

  const [dayToDelete, setDayToDelete] = React.useState<ExcludedDay | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const [selectedYearFilter, setSelectedYearFilter] = React.useState<string>('all');
  const hasInitializedFilter = React.useRef(false);

  React.useEffect(() => {
    if (academicYears.length > 0 && !hasInitializedFilter.current) {
      const now = new Date();
      // 1. Try to find the year that spans the current calendar date
      let defaultYear = academicYears.find((y: AcademicYear) => {
        const start = parseISO(y.startDate);
        const end = parseISO(y.endDate);
        return now >= start && now <= end;
      });

      // 2. Fallback to active year, then to first year in array
      if (!defaultYear) {
        defaultYear = academicYears.find((y: AcademicYear) => y.isActive) || academicYears[0];
      }

      setSelectedYearFilter(defaultYear.id);
      hasInitializedFilter.current = true;
    }
  }, [academicYears]);

  const filteredExcludedDays = React.useMemo(() => {
    if (selectedYearFilter === 'all') return excludedDays;

    const selectedYear = academicYears.find((y: AcademicYear) => y.id === selectedYearFilter);
    if (!selectedYear) return excludedDays;

    const yearStart = parseISO(selectedYear.startDate);
    const yearEnd = parseISO(selectedYear.endDate);

    return excludedDays.filter(day => {
      // 1. If specific date, only show if it falls within the year bounds
      if (day.type === 'specific_date' && day.date) {
        const d = parseISO(day.date);
        return d >= yearStart && d <= yearEnd;
      }

      // 2. If it's a recurring day
      // a) Skipped explicitly for this year?
      if (day.skippedYearIds && day.skippedYearIds.includes(selectedYear.id)) {
        return false;
      }

      // b) Scoped explicitly to another year?
      if (day.applicableYearId && day.applicableYearId !== 'all' && day.applicableYearId !== selectedYear.id) {
        return false;
      }

      // c) Ended before this year?
      if (day.endYearId) {
        const endYear = academicYears.find((y: AcademicYear) => y.id === day.endYearId);
        if (endYear && yearStart > parseISO(endYear.endDate)) {
          return false;
        }
      }

      if (day.startYearId) {
        const startYear = academicYears.find((y: AcademicYear) => y.id === day.startYearId);
        if (startYear && yearEnd < parseISO(startYear.startDate)) {
          return false;
        }
      }

      return true;
    });
  }, [excludedDays, selectedYearFilter, academicYears]);

  const handleAddExcludedDay = async () => {
    if (newExcludedDayType === 'specific_date' && !newExcludedDate) {
      toast({
        title: "Missing Date",
        description: "Please select a date for the exclusion.",
        variant: "destructive"
      });
      return;
    }
    if (newExcludedDayType === 'recurring_day_of_week' && newRecurringDay === undefined) {
      toast({
        title: "Missing Day",
        description: "Please select a day of the week for recurring exclusion.",
        variant: "destructive"
      });
      return;
    }
    if ((newExcludedDayType === 'recurring_monthly' || newExcludedDayType === 'recurring_annual') && newRecurringDayOfMonth === undefined) {
      toast({
        title: "Missing Day of Month",
        description: "Please specify a day of the month.",
        variant: "destructive"
      });
      return;
    }
    if (newExcludedDayType === 'recurring_annual' && newRecurringMonthOfYear === undefined) {
      toast({
        title: "Missing Month",
        description: "Please specify a month of the year.",
        variant: "destructive"
      });
      return;
    }
    if (!newDescription.trim()) {
      toast({
        title: "Missing Description",
        description: "Please provide a description for the exclusion.",
        variant: "destructive"
      });
      return;
    }

    let dayToAdd: Omit<ExcludedDay, 'id' | 'createdAt'>;

    if (newExcludedDayType === 'specific_date' && newExcludedDate) {
      dayToAdd = {
        date: format(newExcludedDate, "yyyy-MM-dd"),
        description: newDescription,
        type: 'specific_date',
      };
    } else if (newExcludedDayType === 'recurring_day_of_week' && newRecurringDay !== undefined) {
      dayToAdd = {
        dayOfWeek: parseInt(newRecurringDay) as ExcludedDay['dayOfWeek'],
        description: newDescription,
        type: 'recurring_day_of_week',
        applicableYearId: newApplicableYearId,
      };
    } else if (newExcludedDayType === 'recurring_monthly' && newRecurringDayOfMonth !== undefined) {
      dayToAdd = {
        dayOfMonth: parseInt(newRecurringDayOfMonth),
        description: newDescription,
        type: 'recurring_monthly',
        applicableYearId: newApplicableYearId,
      };
    } else if (newExcludedDayType === 'recurring_annual' && newRecurringDayOfMonth !== undefined && newRecurringMonthOfYear !== undefined) {
      dayToAdd = {
        dayOfMonth: parseInt(newRecurringDayOfMonth),
        monthOfYear: parseInt(newRecurringMonthOfYear),
        description: newDescription,
        type: 'recurring_annual',
        applicableYearId: newApplicableYearId,
      };
    } else {
      toast({
        title: "Error",
        description: "Invalid selection for excluded day.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createExcludedDayMutation.mutateAsync(dayToAdd);
      toast({
        title: "Excluded Day Added",
        description: `${newDescription} has been added to exclusions.`
      });
      setNewExcludedDate(undefined);
      setNewRecurringDay(undefined);
      setNewRecurringDayOfMonth(undefined);
      setNewRecurringMonthOfYear(undefined);
      setNewApplicableYearId('all');
      setNewDescription("");
    } catch (error) {
      console.error('Error creating excluded day:', error);
      toast({
        title: "Error",
        description: "Failed to add excluded day. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRequest = (excludedDay: ExcludedDay) => {
    // If it's a specific date or already scoped to a specific year, just delete it directly
    if (excludedDay.type === 'specific_date' || (excludedDay.applicableYearId && excludedDay.applicableYearId !== 'all')) {
      executeDeletion(excludedDay.id);
      return;
    }

    // Otherwise, it's a globally recurring rule. Ask the user how to handle it.
    setDayToDelete(excludedDay);
    setIsDeleteDialogOpen(true);
  };

  const confirmSmartDelete = async (mode: 'this_year' | 'upcoming_years' | 'all_years') => {
    if (!dayToDelete) return;

    // We need the active academic year to contextualize "this year" or "upcoming years"
    // Assuming the active year is the first one, or ideally we'd have an isActive flag.
    // For this example, we'll try to find an active one or fallback to the current date to guess.
    const activeYear = academicYears.find((y: AcademicYear) => y.isActive) || academicYears[0];

    if (!activeYear && mode !== 'all_years') {
      toast({
        title: "Error",
        description: "Could not determine the active academic year for this operation.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (mode === 'all_years') {
        await deleteExcludedDayMutation.mutateAsync(dayToDelete.id);
        toast({ title: "Excluded Day Removed", description: "Rule permanently deleted." });
      } else if (mode === 'this_year') {
        const skipped = dayToDelete.skippedYearIds || [];
        if (!skipped.includes(activeYear.id)) {
          await updateExcludedDayMutation.mutateAsync({
            id: dayToDelete.id,
            data: { skippedYearIds: [...skipped, activeYear.id] }
          });
          toast({ title: "Excluded Day Updated", description: `Rule skipped for ${activeYear.name}.` });
        }
      } else if (mode === 'upcoming_years') {
        await updateExcludedDayMutation.mutateAsync({
          id: dayToDelete.id,
          data: { endYearId: activeYear.id } // Stop applying after this year
        });
        toast({ title: "Excluded Day Updated", description: `Rule will stop applying after ${activeYear.name}.` });
      }
    } catch (error) {
      console.error('Error handling smart delete:', error);
      toast({ title: "Error", description: "Failed to update exclusion.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setDayToDelete(null);
    }
  };

  const executeDeletion = async (id: string) => {
    const dayToRemove = excludedDays.find(d => d.id === id);

    try {
      await deleteExcludedDayMutation.mutateAsync(id);
      toast({
        title: "Excluded Day Removed",
        description: `${dayToRemove?.description || 'Exclusion'} removed.`
      });
    } catch (error) {
      console.error('Error deleting excluded day:', error);
      toast({
        title: "Error",
        description: "Failed to remove excluded day. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatExcludedDay = (excludedDay: ExcludedDay) => {
    if (excludedDay.type === 'specific_date' && excludedDay.date) {
      return format(parseISO(excludedDay.date), "PPP");
    } else if (excludedDay.type === 'recurring_day_of_week' && excludedDay.dayOfWeek !== undefined) {
      const dayInfo = DAYS_OF_WEEK.find(d => d.value === excludedDay.dayOfWeek);
      return `Every ${dayInfo?.label}`;
    } else if (excludedDay.type === 'recurring_monthly' && excludedDay.dayOfMonth !== undefined) {
      return `Every ${excludedDay.dayOfMonth}${excludedDay.dayOfMonth % 10 === 1 && excludedDay.dayOfMonth !== 11 ? 'st' :
        excludedDay.dayOfMonth % 10 === 2 && excludedDay.dayOfMonth !== 12 ? 'nd' :
          excludedDay.dayOfMonth % 10 === 3 && excludedDay.dayOfMonth !== 13 ? 'rd' : 'th'
        } of the month`;
    } else if (excludedDay.type === 'recurring_annual' && excludedDay.dayOfMonth !== undefined && excludedDay.monthOfYear !== undefined) {
      const monthInfo = MONTHS_OF_YEAR.find(m => m.value === excludedDay.monthOfYear);
      const baseStr = `Every ${monthInfo?.label} ${excludedDay.dayOfMonth}`;
      if (excludedDay.applicableYearId && excludedDay.applicableYearId !== 'all') {
        const year = academicYears.find((y: AcademicYear) => y.id === excludedDay.applicableYearId);
        return year ? `${baseStr} (${year.name})` : baseStr;
      }
      return baseStr;
    }
    return "Unknown";
  };

  if (excludedDaysLoading || academicYearsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Manage Excluded Days"
        description="Define days that are not considered school days for attendance purposes."
        actions={
          <SmartBackButton fallbackHref="/attendance" className="mr-2 h-4 w-4">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Attendance Hub
</SmartBackButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <PlusCircle className="mr-2 h-5 w-5 text-primary" />
              Add New Exclusion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="exclusionType">Exclusion Type</Label>
              <Select value={newExcludedDayType} onValueChange={(value) => setNewExcludedDayType(value as ExcludedDayType)}>
                <SelectTrigger id="exclusionType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific_date">Specific Date</SelectItem>
                  <SelectItem value="recurring_day_of_week">Recurring Weekly (Day of Week)</SelectItem>
                  <SelectItem value="recurring_monthly">Recurring Monthly</SelectItem>
                  <SelectItem value="recurring_annual">Recurring Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newExcludedDayType !== 'specific_date' && (
              <div>
                <Label htmlFor="applicableYear">Applies To</Label>
                <Select value={newApplicableYearId} onValueChange={setNewApplicableYearId}>
                  <SelectTrigger id="applicableYear">
                    <SelectValue placeholder="All Academic Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Academic Years</SelectItem>
                    {academicYears.map((year: AcademicYear) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newExcludedDayType === 'specific_date' && (
              <div>
                <Label htmlFor="excludedDate">Select Date</Label>
                <ModernDatePicker
                  date={newExcludedDate}
                  setDate={setNewExcludedDate}
                  className="w-full"
                  placeholder="Select excluded date"
                  showQuickSelects={true}
                />
              </div>
            )}

            {newExcludedDayType === 'recurring_day_of_week' && (
              <div>
                <Label htmlFor="recurringDay">Select Day</Label>
                <Select value={newRecurringDay} onValueChange={setNewRecurringDay}>
                  <SelectTrigger id="recurringDay">
                    <SelectValue placeholder="Select day of the week" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(newExcludedDayType === 'recurring_annual') && (
              <div>
                <Label htmlFor="recurringMonth">Select Month</Label>
                <Select value={newRecurringMonthOfYear} onValueChange={setNewRecurringMonthOfYear}>
                  <SelectTrigger id="recurringMonth">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_OF_YEAR.map(month => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(newExcludedDayType === 'recurring_monthly' || newExcludedDayType === 'recurring_annual') && (
              <div>
                <Label htmlFor="recurringDayOfMonth">Day of Month</Label>
                <Input
                  id="recurringDayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={newRecurringDayOfMonth || ""}
                  onChange={(e) => setNewRecurringDayOfMonth(e.target.value)}
                  placeholder="e.g., 25"
                />
              </div>
            )}

            <div>
              <Label htmlFor="description">Description (e.g., Public Holiday, Weekend)</Label>
              <Input
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g., National Holiday"
              />
            </div>

            <Button
              onClick={handleAddExcludedDay}
              className="w-full"
              disabled={createExcludedDayMutation.isPending}
            >
              {createExcludedDayMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Excluded Day"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <CalendarOff className="mr-2 h-5 w-5 text-primary" />
                Current Excluded Days ({filteredExcludedDays.length})
              </div>
              <div className="flex items-center gap-2 text-sm font-normal w-64">
                <span className="text-muted-foreground whitespace-nowrap">Filter Year:</span>
                <Select value={selectedYearFilter} onValueChange={setSelectedYearFilter}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Academic Years</SelectItem>
                    {academicYears.map((year: AcademicYear) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExcludedDays.length === 0 ? (
              <div className="text-center py-8">
                <CalendarOff className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  No excluded days defined yet.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date/Day</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExcludedDays.map((excludedDay) => (
                      <TableRow key={excludedDay.id}>
                        <TableCell>
                          <span className="capitalize">
                            {excludedDay.type.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatExcludedDay(excludedDay)}
                        </TableCell>
                        <TableCell>{excludedDay.description}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRequest(excludedDay)}
                            disabled={deleteExcludedDayMutation.isPending || updateExcludedDayMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recurring Exclusion</DialogTitle>
            <DialogDescription>
              "{dayToDelete?.description}" is a recurring rule. How would you like to handle this deletion?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button variant="outline" onClick={() => confirmSmartDelete('this_year')} className="justify-start">
              Delete for current academic year only
            </Button>
            <Button variant="outline" onClick={() => confirmSmartDelete('upcoming_years')} className="justify-start">
              Delete for this and all upcoming years
            </Button>
            <Button variant="destructive" onClick={() => confirmSmartDelete('all_years')} className="justify-start">
              Delete permanently (includes historical data)
            </Button>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 