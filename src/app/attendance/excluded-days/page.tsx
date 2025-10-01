"use client";

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
import { useToast } from "@/hooks/use-toast";
import type { ExcludedDay } from "@/types";
import { 
  useExcludedDays, 
  useCreateExcludedDay, 
  useDeleteExcludedDay 
} from "@/lib/hooks/use-excluded-days";
import { PlusCircle, Trash2, CalendarOff, ArrowLeft, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

type ExcludedDayType = 'specific_date' | 'recurring_day_of_week';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function ManageExcludedDaysPage() {
  const { toast } = useToast();
  const { data: excludedDays = [], isLoading: excludedDaysLoading } = useExcludedDays();
  const createExcludedDayMutation = useCreateExcludedDay();
  const deleteExcludedDayMutation = useDeleteExcludedDay();
  
  const [newExcludedDayType, setNewExcludedDayType] = React.useState<ExcludedDayType>('specific_date');
  const [newExcludedDate, setNewExcludedDate] = React.useState<Date | undefined>(undefined);
  const [newRecurringDay, setNewRecurringDay] = React.useState<string | undefined>(undefined); 
  const [newDescription, setNewDescription] = React.useState("");

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

  const handleRemoveExcludedDay = async (id: string) => {
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
    }
    return "Unknown";
  };

  if (excludedDaysLoading) {
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
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Attendance Hub
            </Link>
          </Button>
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
                  <SelectItem value="recurring_day_of_week">Recurring Day of Week</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
            <CardTitle className="flex items-center">
              <CalendarOff className="mr-2 h-5 w-5 text-primary" />
              Current Excluded Days ({excludedDays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {excludedDays.length === 0 ? (
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
                    {excludedDays.map((excludedDay) => (
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
                            onClick={() => handleRemoveExcludedDay(excludedDay.id)}
                            disabled={deleteExcludedDayMutation.isPending}
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
    </>
  );
} 