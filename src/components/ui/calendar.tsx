"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const currentYear = new Date().getFullYear()
  return (
    <DayPicker
      captionLayout="dropdown-buttons"
      fromYear={props.fromYear || currentYear - 100}
      toYear={props.toYear || currentYear + 10}
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center mb-1",
        caption_label: "hidden", // hidden — we show dropdowns instead
        caption_dropdowns: "flex gap-2 items-center", // Month + Year side by side
        dropdown_month: "relative",
        dropdown_year: "relative",
        dropdown:
          "appearance-none bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 pr-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400 hover:bg-gray-200 transition-colors",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-8 w-8 bg-transparent p-0 inline-flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-gray-400 rounded-md w-10 font-semibold text-[0.65rem] uppercase tracking-wider text-center",
        row: "flex w-full mt-1",
        cell: cn(
          "h-10 w-10 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-sky-100/50",
          "[&:has([aria-selected])]:bg-sky-100/50",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-10 w-10 p-0 font-normal rounded-full text-sm",
          "inline-flex items-center justify-center",
          "hover:bg-sky-100 hover:text-sky-700 transition-colors duration-150",
          "aria-selected:opacity-100 cursor-pointer"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-sky-500 text-white hover:bg-sky-600 hover:text-white focus:bg-sky-500 focus:text-white rounded-full shadow-md shadow-sky-200",
        day_today:
          "border-2 border-sky-300 font-semibold text-sky-600",
        day_outside:
          "day-outside text-gray-300 aria-selected:bg-sky-100/50 aria-selected:text-gray-400",
        day_disabled: "text-gray-200 opacity-40 cursor-not-allowed hover:bg-transparent",
        day_range_middle:
          "aria-selected:bg-sky-100 aria-selected:text-sky-700 rounded-none",
        day_hidden: "invisible",
        vhidden: "sr-only",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: cls, ...p }) => (
          <ChevronLeft className={cn("h-4 w-4 text-gray-500", cls)} {...p} />
        ),
        IconRight: ({ className: cls, ...p }) => (
          <ChevronRight className={cn("h-4 w-4 text-gray-500", cls)} {...p} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
