"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Loader2, 
  Check, 
  X, 
  AlertCircle,
  ExternalLink,
  Download,
  ChevronRight
} from "lucide-react"

import { cn } from "@/lib/utils"

const enhancedButtonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:scale-[1.02] active:scale-[0.98]",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]",
        warning: "bg-yellow-600 text-white hover:bg-yellow-700 hover:scale-[1.02] active:scale-[0.98]",
        gradient: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:scale-[1.02] active:scale-[0.98]",
        glass: "bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
      animation: {
        none: "",
        bounce: "hover:animate-bounce",
        pulse: "hover:animate-pulse",
        wiggle: "hover:animate-wiggle",
        glow: "hover:shadow-lg hover:shadow-primary/25",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "none",
    },
  }
)

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  success?: boolean
  successText?: string
  error?: boolean
  errorText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  ripple?: boolean
  haptic?: boolean
  confirmAction?: boolean
  confirmText?: string
  tooltip?: string
  badge?: string | number
  fullWidth?: boolean
  iconPosition?: "left" | "right"
}

interface RippleProps {
  x: number
  y: number
  size: number
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({
    className,
    variant,
    size,
    animation,
    asChild = false,
    loading = false,
    loadingText,
    success = false,
    successText,
    error = false,
    errorText,
    leftIcon,
    rightIcon,
    ripple = true,
    haptic = false,
    confirmAction = false,
    confirmText,
    tooltip,
    badge,
    fullWidth = false,
    iconPosition = "left",
    children,
    onClick,
    disabled,
    ...props
  }, ref) => {
    const [ripples, setRipples] = React.useState<RippleProps[]>([])
    const [showConfirm, setShowConfirm] = React.useState(false)
    const [isPressed, setIsPressed] = React.useState(false)
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    // Combine refs
    React.useImperativeHandle(ref, () => buttonRef.current!, [])

    // Determine current state
    const isLoading = loading
    const isSuccess = success && !loading
    const isError = error && !loading && !success
    const isDisabled = disabled || loading

    // Handle click with ripple effect
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return

      // Haptic feedback (if supported)
      if (haptic && 'vibrate' in navigator) {
        navigator.vibrate(50)
      }

      // Confirm action
      if (confirmAction && !showConfirm) {
        setShowConfirm(true)
        return
      }

      // Ripple effect
      if (ripple && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = event.clientX - rect.left - size / 2
        const y = event.clientY - rect.top - size / 2
        
        const newRipple = { x, y, size }
        setRipples(prev => [...prev, newRipple])
        
        // Remove ripple after animation
        setTimeout(() => {
          setRipples(prev => prev.slice(1))
        }, 600)
      }

      onClick?.(event)
      setShowConfirm(false)
    }

    // Handle mouse events for press effect
    const handleMouseDown = () => setIsPressed(true)
    const handleMouseUp = () => setIsPressed(false)
    const handleMouseLeave = () => {
      setIsPressed(false)
      setShowConfirm(false)
    }

    // Auto-hide confirm after 3 seconds
    React.useEffect(() => {
      if (showConfirm) {
        const timer = setTimeout(() => setShowConfirm(false), 3000)
        return () => clearTimeout(timer)
      }
    }, [showConfirm])

    // Render content based on state
    const renderContent = () => {
      const iconClass = "h-4 w-4"
      const iconClassLarge = size === "lg" || size === "xl" ? "h-5 w-5" : iconClass
      
      if (isLoading) {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-2"
          >
            <Loader2 className={cn(iconClassLarge, "animate-spin")} />
            {loadingText && <span>{loadingText}</span>}
          </motion.div>
        )
      }

      if (isSuccess) {
        return (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center space-x-2"
          >
            <Check className={iconClassLarge} />
            {successText && <span>{successText}</span>}
          </motion.div>
        )
      }

      if (isError) {
        return (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center space-x-2"
          >
            <AlertCircle className={iconClassLarge} />
            {errorText && <span>{errorText}</span>}
          </motion.div>
        )
      }

      if (showConfirm) {
        return (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center space-x-2"
          >
            <X className={iconClassLarge} />
            <span>{confirmText || "Click again to confirm"}</span>
          </motion.div>
        )
      }

      // Normal content
      const leftContent = iconPosition === "left" && leftIcon && (
        <span className={cn(iconClassLarge, children ? "mr-2" : "")}>{leftIcon}</span>
      )
      
      const rightContent = iconPosition === "right" && rightIcon && (
        <span className={cn(iconClassLarge, children ? "ml-2" : "")}>{rightIcon}</span>
      )

      return (
        <div className="flex items-center">
          {leftContent}
          {children}
          {rightContent}
        </div>
      )
    }

    const Comp = asChild ? Slot : "button"

    return (
      <div className={cn("relative inline-flex", fullWidth && "w-full")}>
        <Comp
          ref={buttonRef}
          className={cn(
            enhancedButtonVariants({ variant, size, animation, className }),
            fullWidth && "w-full",
            isPressed && "scale-95",
            showConfirm && "bg-red-600 hover:bg-red-700 text-white"
          )}
          disabled={isDisabled}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          title={tooltip}
          {...props}
        >
          {/* Ripple Effect */}
          <AnimatePresence>
            {ripples.map((ripple, index) => (
              <motion.span
                key={index}
                className="absolute bg-white/30 rounded-full pointer-events-none"
                initial={{
                  width: 0,
                  height: 0,
                  x: ripple.x,
                  y: ripple.y,
                  opacity: 0.6,
                }}
                animate={{
                  width: ripple.size,
                  height: ripple.size,
                  opacity: 0,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
          </AnimatePresence>

          {/* Content */}
          <div className="relative z-10 flex items-center justify-center">
            {renderContent()}
          </div>

          {/* Loading overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/10 rounded-md"
              />
            )}
          </AnimatePresence>

          {/* Success overlay */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 bg-green-500/20 rounded-md"
              />
            )}
          </AnimatePresence>

          {/* Error overlay */}
          <AnimatePresence>
            {isError && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 bg-red-500/20 rounded-md"
              />
            )}
          </AnimatePresence>
        </Comp>

        {/* Badge */}
        <AnimatePresence>
          {badge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1 z-20"
            >
              {badge}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tooltip */}
        {tooltip && !showConfirm && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-black"></div>
          </div>
        )}
      </div>
    )
  }
)

EnhancedButton.displayName = "EnhancedButton"

// Pre-configured button variants for common use cases
export const PrimaryButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} variant="default" {...props} />
)

export const SecondaryButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} variant="outline" {...props} />
)

export const SuccessButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} variant="success" {...props} />
)

export const DangerButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} variant="destructive" confirmAction {...props} />
)

export const LoadingButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} loading {...props} />
)

export const IconButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} size="icon" variant="ghost" {...props} />
)

export const GradientButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (props, ref) => <EnhancedButton ref={ref} variant="gradient" animation="glow" {...props} />
)

export { EnhancedButton, enhancedButtonVariants }

// Custom CSS for wiggle animation (add to your global CSS)
export const additionalCSS = `
@keyframes wiggle {
  0%, 7% { transform: rotateZ(0deg); }
  15% { transform: rotateZ(-15deg); }
  20% { transform: rotateZ(10deg); }
  25% { transform: rotateZ(-10deg); }
  30% { transform: rotateZ(6deg); }
  35% { transform: rotateZ(-4deg); }
  40%, 100% { transform: rotateZ(0deg); }
}

.animate-wiggle {
  animation: wiggle 0.5s ease-in-out;
}
` 