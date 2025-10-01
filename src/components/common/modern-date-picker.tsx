"use client"

import * as React from "react"
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isWeekend, nextMonday, nextFriday } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, Clock, Zap, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ModernDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showQuickSelects?: boolean;
  minDate?: Date;
  maxDate?: Date;
  examMode?: boolean; // Special mode for exam scheduling
  excludeWeekends?: boolean;
}

const getQuickSelectOptions = (examMode: boolean = false) => {
  const baseOptions = [
    { label: "Today", getValue: () => new Date() },
    { label: "Tomorrow", getValue: () => addDays(new Date(), 1) },
    { label: "Next Week", getValue: () => addWeeks(new Date(), 1) },
    { label: "Next Month", getValue: () => addMonths(new Date(), 1) },
  ];

  if (examMode) {
    return [
      ...baseOptions,
      { label: "Next Monday", getValue: () => nextMonday(new Date()) },
      { label: "Next Friday", getValue: () => nextFriday(new Date()) },
      { label: "In 2 Weeks", getValue: () => addWeeks(new Date(), 2) },
      { label: "Month End", getValue: () => endOfMonth(new Date()) },
    ];
  }

  return [
    ...baseOptions,
    { label: "Start of Week", getValue: () => startOfWeek(new Date()) },
    { label: "End of Week", getValue: () => endOfWeek(new Date()) },
    { label: "Start of Month", getValue: () => startOfMonth(new Date()) },
    { label: "End of Month", getValue: () => endOfMonth(new Date()) },
  ];
};

export function ModernDatePicker({ 
  date, 
  setDate, 
  className,
  placeholder = "Pick a date",
  disabled = false,
  showQuickSelects = true,
  minDate,
  maxDate,
  examMode = false,
  excludeWeekends = false
}: ModernDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showQuickSelect, setShowQuickSelect] = React.useState(false);
  const [showWarning, setShowWarning] = React.useState(false);

  const quickSelectOptions = React.useMemo(() => getQuickSelectOptions(examMode), [examMode]);

  const handleQuickSelect = (getValue: () => Date) => {
    const selectedDate = getValue();
    
    // Check for weekend warning in exam mode
    if (examMode && excludeWeekends && isWeekend(selectedDate)) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
      return;
    }
    
    setDate(selectedDate);
    setIsOpen(false);
    setShowQuickSelect(false);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      setIsOpen(false);
      return;
    }

    // Check for weekend warning in exam mode
    if (examMode && excludeWeekends && isWeekend(selectedDate)) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 3000);
      return;
    }

    setDate(selectedDate);
    setIsOpen(false);
  };

  const formatDisplayDate = (date: Date) => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const yesterday = subDays(today, 1);
    
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return "Today";
    } else if (format(date, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
      return "Tomorrow";
    } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return "Yesterday";
    }
    
    return format(date, "MMM dd, yyyy");
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    if (examMode && excludeWeekends && isWeekend(date)) return true;
    return false;
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal h-8 text-xs relative overflow-hidden group transition-all duration-300",
              !date && "text-muted-foreground",
              "hover:shadow-md hover:border-primary/50 hover:bg-gradient-to-r hover:from-background hover:to-primary/5",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              disabled && "opacity-50 cursor-not-allowed",
              examMode && "border-blue-200 hover:border-blue-400",
              className
            )}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={false}
            />
            <div className="relative flex items-center w-full">
              <CalendarIcon className={cn(
                "mr-2 h-3 w-3 transition-colors duration-200",
                examMode ? "text-blue-500 group-hover:text-blue-600" : "text-primary/70 group-hover:text-primary"
              )} />
              <span className="flex-1 truncate">
                {date ? formatDisplayDate(date) : placeholder}
              </span>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
              </motion.div>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 z-[99999] shadow-xl border-0 bg-white/95 backdrop-blur-sm" 
          align="start"
          sideOffset={4}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "rounded-lg border shadow-lg bg-gradient-to-br from-white to-gray-50/50",
              examMode && "border-blue-200"
            )}
          >
            {showQuickSelects && (
              <div className={cn(
                "border-b",
                examMode ? "bg-gradient-to-r from-blue-50 to-transparent" : "bg-gradient-to-r from-primary/5 to-transparent"
              )}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Zap className={cn("h-4 w-4", examMode ? "text-blue-500" : "text-primary")} />
                    <span className="text-sm font-medium text-gray-700">
                      {examMode ? "Exam Quick Dates" : "Quick Select"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickSelect(!showQuickSelect)}
                    className="h-6 px-2 text-xs"
                  >
                    {showQuickSelect ? "Hide" : "Show"}
                  </Button>
                </div>
                
                <AnimatePresence>
                  {showQuickSelect && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-1 p-3 pt-0">
                        {quickSelectOptions.map((option) => (
                          <motion.button
                            key={option.label}
                            onClick={() => handleQuickSelect(option.getValue)}
                            className={cn(
                              "text-xs p-2 rounded-md transition-all duration-200 text-left group",
                              examMode 
                                ? "hover:bg-blue-50 hover:text-blue-600" 
                                : "hover:bg-primary/10 hover:text-primary"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                              {option.label}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            <div className="p-1">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                fromDate={minDate}
                toDate={maxDate}
                className="rounded-md"
                classNames={{
                  day_selected: examMode 
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:bg-blue-500 hover:text-white focus:bg-blue-500 focus:text-white shadow-md"
                    : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md",
                  day_today: "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground font-semibold",
                  day: "hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/5 transition-all duration-200 hover:scale-105",
                  day_disabled: "text-gray-300 opacity-50 cursor-not-allowed",
                }}
              />
            </div>
            
            {examMode && excludeWeekends && (
              <div className="border-t bg-blue-50/50 p-2">
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>Weekends are disabled for exam scheduling</span>
                </div>
              </div>
            )}
            

            
            {date && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "border-t p-3",
                  examMode ? "bg-gradient-to-r from-blue-50 to-transparent" : "bg-gradient-to-r from-gray-50 to-transparent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Selected:</span>
                  <span className={cn(
                    "text-xs font-medium",
                    examMode ? "text-blue-600" : "text-primary"
                  )}>
                    {format(date, "EEEE, MMMM do, yyyy")}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </PopoverContent>
      </Popover>

      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-1 z-50"
          >
            <Alert variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription>
                Weekend dates are not recommended for exam scheduling.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 