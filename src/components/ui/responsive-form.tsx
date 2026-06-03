"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveFormProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
  }
}

const ResponsiveForm = React.forwardRef<HTMLDivElement, ResponsiveFormProps>(
  ({ className, columns = { sm: 1, md: 1, lg: 2, xl: 3 }, children, ...props }, ref) => {
    const gridClasses = [
      "grid grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`,
      columns["2xl"] && `2xl:grid-cols-${columns["2xl"]}`,
      "gap-3 sm:gap-4 md:gap-6 lg:gap-8"
    ].filter(Boolean).join(" ")

    return (
      <div
        ref={ref}
        className={cn(gridClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ResponsiveForm.displayName = "ResponsiveForm"

interface ResponsiveFormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
  }
}

const ResponsiveFormSection = React.forwardRef<HTMLDivElement, ResponsiveFormSectionProps>(
  ({ className, span, children, ...props }, ref) => {
    const spanClasses = [
      span?.sm && `sm:col-span-${span.sm}`,
      span?.md && `md:col-span-${span.md}`,
      span?.lg && `lg:col-span-${span.lg}`,
      span?.xl && `xl:col-span-${span.xl}`,
      span?.["2xl"] && `2xl:col-span-${span["2xl"]}`
    ].filter(Boolean).join(" ")

    return (
      <div
        ref={ref}
        className={cn("space-y-3 md:space-y-4", spanClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ResponsiveFormSection.displayName = "ResponsiveFormSection"

interface ResponsiveFormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  required?: boolean
  description?: string
}

const ResponsiveFormField = React.forwardRef<HTMLDivElement, ResponsiveFormFieldProps>(
  ({ className, label, required, description, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-1 md:space-y-2", className)}
        {...props}
      >
        <label className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {children}
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    )
  }
)
ResponsiveFormField.displayName = "ResponsiveFormField"

interface ResponsiveFormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
  }
}

const ResponsiveFormRow = React.forwardRef<HTMLDivElement, ResponsiveFormRowProps>(
  ({ className, columns = { sm: 1, md: 2 }, children, ...props }, ref) => {
    const gridClasses = [
      "grid grid-cols-1",
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`,
      columns["2xl"] && `2xl:grid-cols-${columns["2xl"]}`,
      "gap-3 md:gap-4"
    ].filter(Boolean).join(" ")

    return (
      <div
        ref={ref}
        className={cn(gridClasses, className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ResponsiveFormRow.displayName = "ResponsiveFormRow"

export {
  ResponsiveForm,
  ResponsiveFormSection,
  ResponsiveFormField,
  ResponsiveFormRow
} 