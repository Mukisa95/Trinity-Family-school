"use client"

import * as React from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  /** If true the year range includes future years (useful for academic years, events) */
  allowFuture?: boolean
  label?: string
  isCompact?: boolean
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder = "Select date",
  disabled = false,
  minDate,
  maxDate,
  allowFuture = false,
  label,
  isCompact = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [pendingDate, setPendingDate] = React.useState<Date | undefined>(date)
  const [displayMonth, setDisplayMonth] = React.useState<Date>(date ?? new Date())

  // sync external change
  React.useEffect(() => {
    setPendingDate(date)
    if (date) {
      setDisplayMonth(date)
    }
  }, [date])

  const handleConfirm = () => {
    setDate(pendingDate)
    setOpen(false)
  }

  const handleCancel = () => {
    setPendingDate(date) // revert to last confirmed
    setOpen(false)
  }

  const isDateDisabled = (d: Date) => {
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const currentYear = new Date().getFullYear()

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          handleCancel()
        } else {
          setDisplayMonth(pendingDate ?? date ?? new Date())
          setOpen(true)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 w-full border border-gray-200 bg-white shadow-sm hover:border-sky-300 hover:shadow-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-left",
            isCompact ? "px-2.5 py-1.5 h-8 rounded-lg" : "px-3 py-2.5 min-h-[52px] rounded-xl",
            className
          )}
          type="button"
        >
          <div className="flex flex-col items-start min-w-0 flex-1">
            {label && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                {label}
              </span>
            )}
            <span className={cn(
              "font-semibold truncate",
              isCompact ? "text-xs" : "text-[15px]",
              date ? "text-gray-800" : "text-gray-400"
            )}>
              {date ? format(date, isCompact ? "MMM d, yy" : "MMMM d, yyyy") : placeholder}
            </span>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 border-0 shadow-2xl rounded-2xl overflow-hidden bg-white"
        align="start"
        sideOffset={6}
      >
        {/* Calendar */}
        <div className="p-4 pb-2">
          <Calendar
            mode="single"
            selected={pendingDate}
            onSelect={(selectedDate) => {
              setPendingDate(selectedDate)
              if (selectedDate) {
                setDisplayMonth(selectedDate)
              }
            }}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            disabled={isDateDisabled}
            fromDate={minDate}
            toDate={maxDate}
            fromYear={currentYear - 100}
            toYear={allowFuture ? currentYear + 10 : currentYear + 5}
            className="rounded-xl"
          />
        </div>

        {/* Footer — selected date display + Cancel / Confirm */}
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gray-700 truncate">
            {pendingDate ? format(pendingDate, "MMMM d, yyyy") : <span className="text-gray-400 font-normal">No date selected</span>}
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="text-sm font-semibold text-sky-500 hover:text-sky-600 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
