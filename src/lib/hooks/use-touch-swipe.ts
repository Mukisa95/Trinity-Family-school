"use client"

import { useRef, type TouchEvent } from "react"

/** Track gestures without rerendering the application on every touchmove. */
export function useTouchSwipe({ direction, onSwipe, enabled = true, startMaxX }: {
  direction: "left" | "right"
  onSwipe: () => void
  enabled?: boolean
  startMaxX?: number
}) {
  const gesture = useRef<{ x: number; y: number; axis: "horizontal" | null } | null>(null)
  const onTouchCancel = () => { gesture.current = null }
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    gesture.current = enabled && event.touches.length === 1 &&
      (startMaxX === undefined || touch.clientX < startMaxX)
      ? { x: touch.clientX, y: touch.clientY, axis: null }
      : null
  }
  const onTouchMove = (event: TouchEvent) => {
    const start = gesture.current
    if (!start) return
    if (event.touches.length !== 1) return onTouchCancel()
    const touch = event.touches[0]
    const dx = Math.abs(touch.clientX - start.x), dy = Math.abs(touch.clientY - start.y)
    if (!start.axis && Math.max(dx, dy) > 10) {
      // Once a vertical scroll starts, it must never open or close a sidebar.
      if (dy >= dx) return onTouchCancel()
      start.axis = "horizontal"
    }
  }
  const onTouchEnd = (event: TouchEvent) => {
    const start = gesture.current
    onTouchCancel()
    if (!enabled || !start || start.axis !== "horizontal" || event.touches.length !== 0) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) &&
      (direction === "right" ? dx > 0 : dx < 0)) onSwipe()
  }
  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
}
