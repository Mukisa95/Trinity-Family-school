"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface AnimatedProgressProps {
  value?: number
  className?: string
  indicatorClassName?: string
}

const AnimatedProgress = React.forwardRef<
  HTMLDivElement,
  AnimatedProgressProps
>(({ 
  className = "", 
  value = 0, 
  indicatorClassName = "",
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
      {...props}
    >
      <motion.div
        className={`h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full ${indicatorClassName}`}
        initial={{ width: "0%" }}
        animate={{ width: `${value}%` }}
        transition={{
          duration: 0.8,
          ease: [0.4, 0, 0.2, 1]
        }}
      />
    </div>
  )
})

AnimatedProgress.displayName = "AnimatedProgress"

export { AnimatedProgress } 