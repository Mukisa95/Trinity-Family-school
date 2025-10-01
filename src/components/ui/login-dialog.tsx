"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const LoginDialog = DialogPrimitive.Root

const LoginDialogTrigger = DialogPrimitive.Trigger

const LoginDialogPortal = DialogPrimitive.Portal

const LoginDialogClose = DialogPrimitive.Close

const LoginDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
LoginDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const LoginDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // AGGRESSIVE DEBUGGING
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const dialogElement = document.querySelector('.login-dialog-content');
      if (dialogElement) {
        const styles = window.getComputedStyle(dialogElement);
        console.log('🚨 DIALOG DEBUG:', {
          classes: dialogElement.className,
          position: styles.position,
          left: styles.left,
          top: styles.top,
          transform: styles.transform,
          width: styles.width,
          maxWidth: styles.maxWidth,
          margin: styles.margin,
          rect: dialogElement.getBoundingClientRect()
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LoginDialogPortal>
      <LoginDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // DEBUGGING CLASS
          "login-dialog-content",
          // Centered positioning
          "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          // Size and spacing
          "max-w-md",
          // Glassmorphism effect
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl",
          // Border and shadow
          "border border-white/20 dark:border-gray-700/50 shadow-2xl",
          // Rounded corners
          "rounded-2xl",
          // Animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          // Duration
          "duration-300",
          className
        )}
        {...props}
        style={{
          // FORCE INLINE STYLES
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          margin: '0',
          zIndex: 9999,
          ...props.style
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative p-8"
        >
          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          
          {children}
        </motion.div>
      </DialogPrimitive.Content>
    </LoginDialogPortal>
  )
})
LoginDialogContent.displayName = DialogPrimitive.Content.displayName

const LoginDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center mb-6",
      className
    )}
    {...props}
  />
)
LoginDialogHeader.displayName = "LoginDialogHeader"

const LoginDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-2xl font-bold leading-none tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent",
      className
    )}
    {...props}
  />
))
LoginDialogTitle.displayName = DialogPrimitive.Title.displayName

const LoginDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
LoginDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  LoginDialog,
  LoginDialogPortal,
  LoginDialogOverlay,
  LoginDialogClose,
  LoginDialogTrigger,
  LoginDialogContent,
  LoginDialogHeader,
  LoginDialogTitle,
  LoginDialogDescription,
} 