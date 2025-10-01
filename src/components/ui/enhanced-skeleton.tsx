"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface EnhancedSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "card" | "avatar" | "button" | "image"
  width?: number | string
  height?: number | string
  lines?: number
  animation?: "pulse" | "wave" | "shimmer" | "none"
  rounded?: "none" | "sm" | "md" | "lg" | "full"
  showShimmer?: boolean
  delay?: number
}

const EnhancedSkeleton = React.forwardRef<HTMLDivElement, EnhancedSkeletonProps>(
  ({
    className,
    variant = "rectangular",
    width,
    height,
    lines = 1,
    animation = "shimmer",
    rounded = "md",
    showShimmer = true,
    delay = 0,
    style,
    ...props
  }, ref) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "text":
          return {
            width: width || "100%",
            height: height || "1rem",
          }
        case "circular":
          return {
            width: width || "3rem",
            height: height || "3rem",
            borderRadius: "50%",
          }
        case "avatar":
          return {
            width: width || "2.5rem",
            height: height || "2.5rem",
            borderRadius: "50%",
          }
        case "button":
          return {
            width: width || "6rem",
            height: height || "2.5rem",
            borderRadius: "0.375rem",
          }
        case "image":
          return {
            width: width || "100%",
            height: height || "12rem",
            borderRadius: "0.5rem",
          }
        case "card":
          return {
            width: width || "100%",
            height: height || "8rem",
            borderRadius: "0.5rem",
          }
        default:
          return {
            width: width || "100%",
            height: height || "1rem",
          }
      }
    }

    const getRoundedClass = () => {
      switch (rounded) {
        case "none": return "rounded-none"
        case "sm": return "rounded-sm"
        case "md": return "rounded-md"
        case "lg": return "rounded-lg"
        case "full": return "rounded-full"
        default: return "rounded-md"
      }
    }

    const getAnimationClass = () => {
      switch (animation) {
        case "pulse": return "animate-pulse"
        case "wave": return "animate-wave"
        case "shimmer": return "animate-shimmer"
        case "none": return ""
        default: return "animate-shimmer"
      }
    }

    const variantStyles = getVariantStyles()

    if (variant === "text" && lines > 1) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay }}
          className="space-y-2"
          ref={ref}
          {...props}
        >
          {Array.from({ length: lines }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: delay + index * 0.1, duration: 0.3 }}
              className={cn(
                "bg-muted relative overflow-hidden",
                getAnimationClass(),
                getRoundedClass(),
                // Last line is usually shorter
                index === lines - 1 && "w-3/4",
                className
              )}
              style={{
                ...variantStyles,
                width: index === lines - 1 ? "75%" : variantStyles.width,
                ...style,
              }}
            >
              {showShimmer && animation === "shimmer" && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-pass" />
              )}
            </motion.div>
          ))}
        </motion.div>
      )
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scaleY: 0.8 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ delay, duration: 0.3 }}
        className={cn(
          "bg-muted relative overflow-hidden",
          getAnimationClass(),
          getRoundedClass(),
          className
        )}
        style={{
          ...variantStyles,
          ...style,
        }}
        {...props}
      >
        {showShimmer && animation === "shimmer" && (
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-pass" />
        )}
      </motion.div>
    )
  }
)

EnhancedSkeleton.displayName = "EnhancedSkeleton"

// Pre-built skeleton patterns
export const TextSkeleton = React.forwardRef<HTMLDivElement, Omit<EnhancedSkeletonProps, "variant">>(
  (props, ref) => <EnhancedSkeleton ref={ref} variant="text" {...props} />
)

export const AvatarSkeleton = React.forwardRef<HTMLDivElement, Omit<EnhancedSkeletonProps, "variant">>(
  (props, ref) => <EnhancedSkeleton ref={ref} variant="avatar" {...props} />
)

export const ButtonSkeleton = React.forwardRef<HTMLDivElement, Omit<EnhancedSkeletonProps, "variant">>(
  (props, ref) => <EnhancedSkeleton ref={ref} variant="button" {...props} />
)

export const ImageSkeleton = React.forwardRef<HTMLDivElement, Omit<EnhancedSkeletonProps, "variant">>(
  (props, ref) => <EnhancedSkeleton ref={ref} variant="image" {...props} />
)

export const CardSkeleton = React.forwardRef<HTMLDivElement, Omit<EnhancedSkeletonProps, "variant">>(
  (props, ref) => <EnhancedSkeleton ref={ref} variant="card" {...props} />
)

// Complex skeleton patterns
export interface UserCardSkeletonProps {
  showAvatar?: boolean
  showBadge?: boolean
  delay?: number
}

export const UserCardSkeleton: React.FC<UserCardSkeletonProps> = ({
  showAvatar = true,
  showBadge = true,
  delay = 0
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="flex items-center space-x-3 p-4 border rounded-lg"
  >
    {showAvatar && <AvatarSkeleton delay={delay + 0.1} />}
    <div className="flex-1 space-y-2">
      <TextSkeleton width="60%" delay={delay + 0.2} />
      <TextSkeleton width="40%" height="0.875rem" delay={delay + 0.3} />
    </div>
    {showBadge && (
      <EnhancedSkeleton
        variant="rectangular"
        width="4rem"
        height="1.5rem"
        rounded="full"
        delay={delay + 0.4}
      />
    )}
  </motion.div>
)

export interface ListSkeletonProps {
  items?: number
  showAvatar?: boolean
  showActions?: boolean
  staggerDelay?: number
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  showAvatar = true,
  showActions = true,
  staggerDelay = 0.1
}) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * staggerDelay }}
        className="flex items-center justify-between p-3 border rounded-lg"
      >
        <div className="flex items-center space-x-3">
          {showAvatar && <AvatarSkeleton delay={index * staggerDelay + 0.1} />}
          <div className="space-y-2">
            <TextSkeleton width="8rem" delay={index * staggerDelay + 0.2} />
            <TextSkeleton width="12rem" height="0.875rem" delay={index * staggerDelay + 0.3} />
          </div>
        </div>
        {showActions && (
          <div className="flex space-x-2">
            <ButtonSkeleton width="4rem" delay={index * staggerDelay + 0.4} />
            <ButtonSkeleton width="4rem" delay={index * staggerDelay + 0.5} />
          </div>
        )}
      </motion.div>
    ))}
  </div>
)

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  staggerDelay?: number
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  staggerDelay = 0.05
}) => (
  <div className="space-y-4">
    {showHeader && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 p-4 border-b"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <TextSkeleton
            key={colIndex}
            width="80%"
            height="1.25rem"
            delay={colIndex * 0.05}
          />
        ))}
      </motion.div>
    )}
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <motion.div
          key={rowIndex}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: rowIndex * staggerDelay }}
          className="grid gap-4 p-4 hover:bg-muted/50 transition-colors"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TextSkeleton
              key={colIndex}
              width={colIndex === 0 ? "90%" : "70%"}
              delay={rowIndex * staggerDelay + colIndex * 0.02}
            />
          ))}
        </motion.div>
      ))}
    </div>
  </div>
)

export interface FormSkeletonProps {
  fields?: number
  showSubmit?: boolean
  twoColumn?: boolean
  staggerDelay?: number
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 6,
  showSubmit = true,
  twoColumn = false,
  staggerDelay = 0.1
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="space-y-6"
  >
    <div className={cn(
      "grid gap-4",
      twoColumn ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
    )}>
      {Array.from({ length: fields }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * staggerDelay }}
          className="space-y-2"
        >
          <TextSkeleton width="30%" height="0.875rem" delay={index * staggerDelay + 0.05} />
          <EnhancedSkeleton
            variant="rectangular"
            height="2.5rem"
            rounded="md"
            delay={index * staggerDelay + 0.1}
          />
        </motion.div>
      ))}
    </div>
    {showSubmit && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: fields * staggerDelay + 0.2 }}
        className="flex justify-end space-x-3"
      >
        <ButtonSkeleton width="5rem" delay={fields * staggerDelay + 0.3} />
        <ButtonSkeleton width="6rem" delay={fields * staggerDelay + 0.4} />
      </motion.div>
    )}
  </motion.div>
)

export interface DashboardSkeletonProps {
  showStats?: boolean
  showChart?: boolean
  showTable?: boolean
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  showStats = true,
  showChart = true,
  showTable = true
}) => (
  <div className="space-y-6">
    {showStats && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="p-6 border rounded-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <TextSkeleton width="60%" delay={index * 0.1 + 0.1} />
              <EnhancedSkeleton
                variant="circular"
                width="2rem"
                height="2rem"
                delay={index * 0.1 + 0.2}
              />
            </div>
            <TextSkeleton width="40%" height="2rem" delay={index * 0.1 + 0.3} />
            <TextSkeleton width="30%" height="0.75rem" delay={index * 0.1 + 0.4} />
          </motion.div>
        ))}
      </motion.div>
    )}

    {showChart && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 border rounded-lg space-y-4"
      >
        <div className="flex items-center justify-between">
          <TextSkeleton width="30%" height="1.5rem" delay={0.6} />
          <div className="flex space-x-2">
            <ButtonSkeleton width="4rem" delay={0.7} />
            <ButtonSkeleton width="4rem" delay={0.8} />
          </div>
        </div>
        <CardSkeleton height="20rem" delay={0.9} />
      </motion.div>
    )}

    {showTable && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="border rounded-lg"
      >
        <div className="p-4 border-b">
          <TextSkeleton width="40%" height="1.5rem" delay={1.1} />
        </div>
        <TableSkeleton rows={5} columns={4} showHeader={false} staggerDelay={0.05} />
      </motion.div>
    )}
  </div>
)

export { EnhancedSkeleton } 