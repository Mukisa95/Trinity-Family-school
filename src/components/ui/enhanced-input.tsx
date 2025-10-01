"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Check, 
  X, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Search,
  Loader2,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
  error?: string
  success?: boolean
  loading?: boolean
  showPasswordToggle?: boolean
  enableRealTimeValidation?: boolean
  validationRules?: {
    required?: boolean
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: string) => string | null
  }
  suggestions?: string[]
  onValidationChange?: (isValid: boolean, error?: string) => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: "default" | "search" | "floating"
}

const EnhancedInput = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({
    className,
    label,
    description,
    error,
    success,
    loading,
    showPasswordToggle,
    enableRealTimeValidation = false,
    validationRules,
    suggestions = [],
    onValidationChange,
    leftIcon,
    rightIcon,
    variant = "default",
    type = "text",
    value,
    onChange,
    onFocus,
    onBlur,
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "")
    const [showPassword, setShowPassword] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)
    const [internalError, setInternalError] = React.useState<string | null>(null)
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([])
    const [validationState, setValidationState] = React.useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
    
    const inputRef = React.useRef<HTMLInputElement>(null)
    const suggestionsRef = React.useRef<HTMLDivElement>(null)
    const validationTimeoutRef = React.useRef<NodeJS.Timeout>()

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!, [])

    // Validation logic
    const validateInput = React.useCallback((inputValue: string) => {
      if (!validationRules) return null

      if (validationRules.required && !inputValue.trim()) {
        return "This field is required"
      }

      if (validationRules.minLength && inputValue.length < validationRules.minLength) {
        return `Must be at least ${validationRules.minLength} characters`
      }

      if (validationRules.maxLength && inputValue.length > validationRules.maxLength) {
        return `Must be no more than ${validationRules.maxLength} characters`
      }

      if (validationRules.pattern && !validationRules.pattern.test(inputValue)) {
        return "Invalid format"
      }

      if (validationRules.custom) {
        return validationRules.custom(inputValue)
      }

      return null
    }, [validationRules])

    // Handle value changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange?.(e)

      // Filter suggestions
      if (suggestions.length > 0) {
        const filtered = suggestions.filter(suggestion =>
          suggestion.toLowerCase().includes(newValue.toLowerCase())
        )
        setFilteredSuggestions(filtered)
        setShowSuggestions(newValue.length > 0 && filtered.length > 0)
      }

      // Real-time validation
      if (enableRealTimeValidation && validationRules) {
        setValidationState('validating')
        
        // Debounce validation
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current)
        }
        
        validationTimeoutRef.current = setTimeout(() => {
          const validationError = validateInput(newValue)
          setInternalError(validationError)
          const isValid = !validationError
          setValidationState(isValid ? 'valid' : 'invalid')
          onValidationChange?.(isValid, validationError || undefined)
        }, 300)
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.(e)
      
      if (suggestions.length > 0 && internalValue) {
        setShowSuggestions(true)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(e)
      
      // Delay hiding suggestions to allow for clicks
      setTimeout(() => setShowSuggestions(false), 150)
    }

    const handleSuggestionClick = (suggestion: string) => {
      setInternalValue(suggestion)
      setShowSuggestions(false)
      
      // Create synthetic event for onChange
      const syntheticEvent = {
        target: { value: suggestion },
        currentTarget: { value: suggestion }
      } as React.ChangeEvent<HTMLInputElement>
      
      onChange?.(syntheticEvent)
    }

    // Determine input type
    const inputType = type === "password" && showPassword ? "text" : type

    // Determine state
    const hasError = error || internalError
    const isValid = success || (enableRealTimeValidation && validationState === 'valid')
    const isValidating = loading || validationState === 'validating'

    // State colors
    const getStateColor = () => {
      if (hasError) return "border-red-300 focus:border-red-500 focus:ring-red-200"
      if (isValid) return "border-green-300 focus:border-green-500 focus:ring-green-200"
      if (isFocused) return "border-blue-500 focus:border-blue-600 focus:ring-blue-200"
      return "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
    }

    // Icon components
    const PasswordToggleIcon = () => (
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    )

    const ValidationIcon = () => {
      if (isValidating) {
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      }
      if (hasError) {
        return <AlertCircle className="h-4 w-4 text-red-500" />
      }
      if (isValid) {
        return <Check className="h-4 w-4 text-green-500" />
      }
      return null
    }

    // Floating label variant
    const isFloatingActive = variant === "floating" && (isFocused || internalValue)

    return (
      <div className="relative w-full">
        {/* Standard Label */}
        {label && variant !== "floating" && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2"
          >
            <Label 
              htmlFor={props.id}
              className={cn(
                "text-sm font-medium transition-colors",
                hasError ? "text-red-700" : "text-gray-700 dark:text-gray-300"
              )}
            >
              {label}
              {validationRules?.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
          </motion.div>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          {/* Search Icon for search variant */}
          {variant === "search" && !leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="h-4 w-4" />
            </div>
          )}

          {/* Floating Label */}
          {variant === "floating" && label && (
            <motion.label
              htmlFor={props.id}
              className={cn(
                "absolute left-3 transition-all duration-200 ease-out pointer-events-none",
                isFloatingActive
                  ? "top-2 text-xs font-medium text-blue-600 dark:text-blue-400"
                  : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
              )}
              animate={{
                y: isFloatingActive ? "-0.75rem" : "0",
                scale: isFloatingActive ? 0.85 : 1,
                color: isFloatingActive ? 
                  (hasError ? "#dc2626" : "#2563eb") : 
                  "#6b7280"
              }}
            >
              {label}
              {validationRules?.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </motion.label>
          )}

          {/* Input Field */}
          <Input
            ref={inputRef}
            type={inputType}
            value={internalValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              "transition-all duration-200",
              getStateColor(),
              leftIcon || variant === "search" ? "pl-10" : "",
              (rightIcon || showPasswordToggle || enableRealTimeValidation) ? "pr-10" : "",
              variant === "floating" ? "pt-6 pb-2" : "",
              "focus:ring-2 focus:ring-opacity-20",
              className
            )}
            {...props}
          />

          {/* Right Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
            {enableRealTimeValidation && <ValidationIcon />}
            {rightIcon && <div className="text-gray-400">{rightIcon}</div>}
            {showPasswordToggle && type === "password" && <PasswordToggleIcon />}
          </div>

          {/* Focus Ring Animation */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="absolute inset-0 rounded-md border-2 border-blue-400 pointer-events-none"
                style={{
                  background: "transparent",
                  zIndex: -1
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              {filteredSuggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-md last:rounded-b-md"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description */}
        {description && !hasError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 flex items-center text-xs text-gray-500"
          >
            <Info className="h-3 w-3 mr-1" />
            {description}
          </motion.div>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {hasError && (
            <motion.div
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              className="mt-1 flex items-center text-xs text-red-600"
            >
              <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
              <span>{error || internalError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message */}
        <AnimatePresence>
          {isValid && !hasError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-1 flex items-center text-xs text-green-600"
            >
              <Check className="h-3 w-3 mr-1" />
              <span>Looks good!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

EnhancedInput.displayName = "EnhancedInput"

export { EnhancedInput } 