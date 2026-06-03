"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ToggleGroupProps {
  type: "single" | "multiple"
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  children: React.ReactNode
  className?: string
}

export function ToggleGroup({ 
  type, 
  value, 
  onValueChange, 
  children, 
  className 
}: ToggleGroupProps) {
  const handleItemToggle = (itemValue: string) => {
    if (type === "single") {
      onValueChange?.(itemValue)
    } else {
      const currentValue = Array.isArray(value) ? value : []
      const newValue = currentValue.includes(itemValue)
        ? currentValue.filter(v => v !== itemValue)
        : [...currentValue, itemValue]
      onValueChange?.(newValue)
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            onToggle: handleItemToggle,
            isToggled: type === "single" 
              ? value === child.props.value 
              : Array.isArray(value) && value.includes(child.props.value)
          })
        }
        return child
      })}
    </div>
  )
}

interface ToggleGroupItemProps {
  value: string
  children: React.ReactNode
  onToggle?: (value: string) => void
  isToggled?: boolean
  "aria-label"?: string
  className?: string
}

export function ToggleGroupItem({ 
  value, 
  children, 
  onToggle, 
  isToggled,
  className,
  ...props 
}: ToggleGroupItemProps) {
  return (
    <Button
      variant={isToggled ? "default" : "outline"}
      size="sm"
      onClick={() => onToggle?.(value)}
      className={cn("", className)}
      {...props}
    >
      {children}
    </Button>
  )
}
