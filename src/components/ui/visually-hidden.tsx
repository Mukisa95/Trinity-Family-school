"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

const VisuallyHidden = React.forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
          "clip-path-inset-half", // This will be handled by CSS
          className
        )}
        style={{
          clipPath: "inset(50%)",
        }}
        {...props}
      >
        {children}
      </span>
    )
  }
)
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden } 