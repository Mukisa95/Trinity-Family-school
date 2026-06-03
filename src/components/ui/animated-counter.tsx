"use client"

import * as React from "react"

interface AnimatedCounterProps {
  value: number
  className?: string
  suffix?: string
  prefix?: string
  decimals?: number
}

export function AnimatedCounter({ 
  value, 
  className = "", 
  suffix = "", 
  prefix = "",
  decimals = 0
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(value)

  React.useEffect(() => {
    const startValue = displayValue
    const endValue = value
    const duration = 500 // 500ms animation
    const startTime = Date.now()

    if (startValue === endValue) return

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValue + (endValue - startValue) * easeOut
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, displayValue])

  const formattedValue = `${prefix}${displayValue.toFixed(decimals)}${suffix}`

  return (
    <span className={className}>
      {formattedValue}
    </span>
  )
} 