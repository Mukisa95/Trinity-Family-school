"use client";

import * as React from "react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, endOfDay } from "date-fns";
import { Loader2, Printer, Calendar as CalendarIcon, FileText, LayoutGrid } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Class, AcademicYear, ExcludedDay } from "@/types";

export type PrintAttendanceConfig = {
  reportType: "summary" | "detailed";
  classId: string;
  startDate: string;
  endDate: string;
  excludedDays: ExcludedDay[];
};

interface AttendancePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: PrintAttendanceConfig) => void;
  onExportCSV?: () => void;
  classes: Class[];
  academicYears: AcademicYear[];
  selectedAcademicYearId: string;
  selectedTermId: string;
  defaultClassId?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  excludedDays: ExcludedDay[];
}

export function AttendancePrintModal({
  isOpen,
  onClose,
  onConfirm,
  onExportCSV,
  classes,
  academicYears,
  selectedAcademicYearId,
  selectedTermId,
  defaultClassId = "",
  defaultStartDate = "",
  defaultEndDate = "",
  excludedDays = [],
}: AttendancePrintModalProps) {
  const [exportFormat, setExportFormat] = React.useState<"pdf" | "csv">("pdf");
  const [reportType, setReportType] = React.useState<"summary" | "detailed">("detailed");
  const [classId, setClassId] = React.useState<string>(defaultClassId === "_all_" ? "" : defaultClassId);
  const [startDate, setStartDate] = React.useState<string>(defaultStartDate);
  const [endDate, setEndDate] = React.useState<string>(defaultEndDate);
  const [datePreset, setDatePreset] = React.useState<string>("custom");

  React.useEffect(() => {
    if (isOpen) {
      setExportFormat("pdf");
    }
  }, [isOpen]);

  const selectedAcademicYear = React.useMemo(() => {
    return academicYears.find(year => year.id === selectedAcademicYearId) || null;
  }, [academicYears, selectedAcademicYearId]);

  // Handle Preset Changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();

    switch (preset) {
      case "this_week":
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        break;
      case "this_month":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "term":
        if (selectedAcademicYear && selectedTermId && selectedTermId !== "_all_") {
          const currentTerm = selectedAcademicYear.terms.find(t => t.id === selectedTermId);
          if (currentTerm) {
            setStartDate(currentTerm.startDate.split("T")[0]);
            setEndDate(currentTerm.endDate.split("T")[0]);
          }
        }
        break;
      default:
        break; // Keep existing dates for "custom"
    }
  };

  const handleConfirm = () => {
    if (!classId || !startDate || !endDate) return;
    onConfirm({
      reportType,
      classId,
      startDate: new Date(startDate).toISOString(),
      endDate: endOfDay(new Date(endDate)).toISOString(),
      excludedDays
    });
    // Let the parent manage closing so PDF generators can mount
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            Export & Print Attendance
          </DialogTitle>
          <DialogDescription>
            Choose your preferred export format and options.
          </DialogDescription>
        </DialogHeader>

        {/* Format Selection Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100/80 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setExportFormat("pdf")}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              exportFormat === "pdf"
                ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Printer className="h-3.5 w-3.5" />
            PDF Report
          </button>
          <button
            type="button"
            onClick={() => setExportFormat("csv")}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              exportFormat === "csv"
                ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            CSV Spreadsheet
          </button>
        </div>

        {exportFormat === "pdf" ? (
          <div className="grid gap-6 py-2">
            {/* Report Type */}
            <div className="space-y-3">
              <Label className="text-gray-700">Report Layout</Label>
              <RadioGroup
                value={reportType}
                onValueChange={(val: "summary" | "detailed") => setReportType(val)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="detailed" id="r-detailed" className="peer sr-only" />
                  <Label
                    htmlFor="r-detailed"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 cursor-pointer"
                  >
                    <LayoutGrid className="mb-2 h-6 w-6 text-gray-500" />
                    <div className="text-center font-semibold">Detailed Grid</div>
                    <div className="text-center text-xs text-muted-foreground mt-1">Full daily tracker with register boxes</div>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="summary" id="r-summary" className="peer sr-only" />
                  <Label
                    htmlFor="r-summary"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50 cursor-pointer"
                  >
                    <FileText className="mb-2 h-6 w-6 text-gray-500" />
                    <div className="text-center font-semibold">Summary Totals</div>
                    <div className="text-center text-xs text-muted-foreground mt-1">Clean list of presence percentages</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Class Selection (Required for printing) */}
            <div className="space-y-2">
              <Label htmlFor="print-class" className="text-gray-700">Target Class <span className="text-red-500">*</span></Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="print-class" className="w-full">
                  <SelectValue placeholder="Select a class to print..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Selection */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                <Label className="text-gray-700 flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" /> Date Range
                </Label>
                <Select value={datePreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-[130px] h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom" className="text-xs">Custom Dates</SelectItem>
                    <SelectItem value="this_week" className="text-xs">This Week</SelectItem>
                    <SelectItem value="this_month" className="text-xs">This Month</SelectItem>
                    <SelectItem value="term" className="text-xs">Entire Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs text-gray-500">From</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs text-gray-500">To</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-9"
                  />
                </div>
              </div>
              {reportType === "detailed" && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-start gap-2 mt-2 border border-amber-100">
                  <span className="font-bold scale-110 mt-0.5">ⓘ</span>
                  Detailed grids are best printed in batches of a <b>single month</b>. Wider ranges may look cramped.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-blue-50/50 p-6 rounded-xl border border-blue-100/50 text-center py-8 my-2">
            <FileText className="h-10 w-10 text-blue-500 mx-auto mb-2 animate-pulse" />
            <h4 className="font-semibold text-blue-900 text-sm">Export Data as CSV</h4>
            <p className="text-xs text-blue-700/80 max-w-xs mx-auto leading-relaxed">
              Download the current attendance tracker statistics and record list as a comma-separated values (.csv) spreadsheet file.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {exportFormat === "pdf" ? (
            <Button 
              onClick={handleConfirm} 
              disabled={!classId || !startDate || !endDate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              Generate PDF
            </Button>
          ) : (
            <Button 
              onClick={() => {
                onExportCSV?.();
                onClose();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
