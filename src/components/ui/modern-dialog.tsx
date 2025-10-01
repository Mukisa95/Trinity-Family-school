"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { VisuallyHidden } from "./visually-hidden"

interface ModernDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ModernDialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
} | null>(null)

const ModernDialog: React.FC<ModernDialogProps> = ({ children, open = false, onOpenChange = () => {} }) => {
  return (
    <ModernDialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </ModernDialogContext.Provider>
  )
}

const ModernDialogTrigger: React.FC<{ children: React.ReactNode; asChild?: boolean }> = ({ children, asChild = false }) => {
  const context = React.useContext(ModernDialogContext)
  
  if (!context) {
    return <>{children}</>
  }

  const { onOpenChange } = context

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: () => onOpenChange(true)
    })
  }

  return (
    <button onClick={() => onOpenChange(true)}>
      {children}
    </button>
  )
}

const ModernDialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

const ModernDialogClose: React.FC<{ children?: React.ReactNode; className?: string; onClick?: () => void }> = ({ 
  children, 
  className,
  onClick 
}) => {
  return (
    <button 
      type="button" 
      className={className} 
      onClick={onClick}
    >
      {children}
    </button>
  )
}

interface ModernDialogContentProps {
  children: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "responsive"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ModernDialogContent: React.FC<ModernDialogContentProps> = ({ 
  children, 
  className, 
  size = "responsive",
  open: propOpen,
  onOpenChange: propOnOpenChange 
}) => {
  const context = React.useContext(ModernDialogContext)
  
  // Use context values if available, otherwise fall back to props
  const open = propOpen ?? context?.open ?? false
  const onOpenChange = propOnOpenChange ?? context?.onOpenChange ?? (() => {})
  
  // Check if children contain DialogTitle and DialogDescription by searching content
  const childrenString = React.Children.toArray(children).map(child => 
    React.isValidElement(child) ? child.type?.toString() : ''
  ).join('')
  
  const hasDialogTitle = childrenString.includes('ModernDialogTitle') || 
    React.Children.toArray(children).some(child => 
      React.isValidElement(child) && child.type === ModernDialogTitle
    )
  
  const hasDialogDescription = childrenString.includes('ModernDialogDescription') || 
    React.Children.toArray(children).some(child => 
      React.isValidElement(child) && child.type === ModernDialogDescription
    )
  const sizeClasses = {
    sm: "w-full max-w-sm",
    md: "w-full max-w-md", 
    lg: "w-full max-w-lg",
    xl: "w-full max-w-xl",
    "2xl": "w-full max-w-2xl",
    full: "w-[95vw] max-w-[95vw]",
    responsive: "w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:w-[70vw] max-w-[90rem]"
  }

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && onOpenChange) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
        onClick={() => onOpenChange?.(false)}
      />
      
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasDialogTitle ? undefined : "dialog-title"}
        aria-describedby={hasDialogDescription ? undefined : "dialog-description"}
        className={cn(
          // Centered positioning with viewport constraints
          "relative z-[99999]",
          // Responsive sizing with viewport constraints
          sizeClasses[size],
          // Height constraints based on viewport
          "max-h-[95vh] min-h-[300px]",
          // Mobile responsiveness
          "mx-2 sm:mx-4 md:mx-6 lg:mx-8",
          // Styling
          "bg-white dark:bg-gray-900 backdrop-blur-xl",
          // Border and shadow
          "border border-gray-200 dark:border-gray-700 shadow-2xl",
          // Rounded corners - responsive
          "rounded-lg sm:rounded-xl md:rounded-2xl",
          // Flex layout for proper content handling
          "flex flex-col",
          // Overflow handling
          "overflow-hidden",
          className
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange?.(false)}
          className="absolute right-2 top-2 sm:right-4 sm:top-4 rounded-full p-1.5 sm:p-2 opacity-70 transition-all hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg"
        >
          <X className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        {/* Content */}
        <div className="flex flex-col h-full overflow-hidden">
          {/* Hidden accessibility elements if not provided */}
          {!hasDialogTitle && (
            <VisuallyHidden>
              <h2 id="dialog-title">Dialog</h2>
            </VisuallyHidden>
          )}
          {!hasDialogDescription && (
            <VisuallyHidden>
              <p id="dialog-description">Dialog content</p>
            </VisuallyHidden>
          )}
          
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pt-8 sm:pt-10 md:pt-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

const ModernDialogHeader: React.FC<{ 
  className?: string 
  children: React.ReactNode 
}> = ({ className, children }) => (
  <div
    className={cn(
      "flex flex-col space-y-1 sm:space-y-2 text-center mb-3 sm:mb-4 md:mb-6",
      className
    )}
  >
    {children}
  </div>
)

const ModernDialogTitle: React.FC<{ 
  className?: string 
  children: React.ReactNode 
  id?: string
}> = ({ className, children, id = "dialog-title" }) => (
  <h2
    id={id}
    className={cn(
      "text-lg sm:text-xl md:text-2xl font-bold leading-none tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent",
      className
    )}
  >
    {children}
  </h2>
)

const ModernDialogDescription: React.FC<{ 
  className?: string 
  children: React.ReactNode 
  id?: string
}> = ({ className, children, id = "dialog-description" }) => (
  <p id={id} className={cn("text-xs sm:text-sm text-gray-600 dark:text-gray-400", className)}>
    {children}
  </p>
)

const ModernDialogFooter: React.FC<{ 
  className?: string 
  children: React.ReactNode 
}> = ({ className, children }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0 mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 md:pt-6 border-t border-gray-200 dark:border-gray-700",
      className
    )}
  >
    {children}
  </div>
)

export {
  ModernDialog,
  ModernDialogPortal,
  ModernDialogClose,
  ModernDialogTrigger,
  ModernDialogContent,
  ModernDialogHeader,
  ModernDialogTitle,
  ModernDialogDescription,
  ModernDialogFooter,
} 