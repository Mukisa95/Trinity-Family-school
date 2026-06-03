import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Initialize with a default value (e.g., false for desktop-first, or null/undefined if handled carefully by consumers)
  // Forcing a consistent server render and initial client render before useEffect runs.
  const [isMobile, setIsMobile] = React.useState<boolean>(false) 
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true); // Component is now mounted

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Set initial state after mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  // Only return the true/false value after mounting, to ensure consistency.
  // Consumers might need to handle an initial `false` (or whatever default) state if they render differently based on this.
  return mounted ? isMobile : false; // Or a different default if that makes more sense for your SSR strategy
}
