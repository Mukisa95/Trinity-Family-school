"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Eye,
  EyeOff,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  CreditCard,
  Lock,
  Search,
  Filter,
  X,
  Plus,
  Save,
  ArrowRight,
  ArrowLeft
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EnhancedInput } from "@/components/ui/enhanced-input"
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface FormField {
  id: string
  type: "text" | "email" | "password" | "tel" | "search" | "number" | "date" | "textarea"
  label: string
  placeholder?: string
  required?: boolean
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: string) => string | null
  }
  description?: string
  suggestions?: string[]
  icon?: React.ReactNode
  variant?: "default" | "search" | "floating"
  width?: "full" | "half" | "third" | "quarter"
  group?: string
}

export interface FormStep {
  id: string
  title: string
  description?: string
  icon?: React.ReactNode
  fields: FormField[]
}

export interface ModernFormProps {
  steps?: FormStep[]
  fields?: FormField[]
  onSubmit: (data: Record<string, any>) => Promise<void> | void
  onStepChange?: (stepIndex: number) => void
  submitText?: string
  loading?: boolean
  multiStep?: boolean
  showProgress?: boolean
  autoSave?: boolean
  className?: string
  title?: string
  description?: string
  resetOnSubmit?: boolean
}

const ModernForm = React.forwardRef<HTMLFormElement, ModernFormProps>(
  ({
    steps = [],
    fields = [],
    onSubmit,
    onStepChange,
    submitText = "Submit",
    loading = false,
    multiStep = false,
    showProgress = true,
    autoSave = false,
    className,
    title,
    description,
    resetOnSubmit = false,
    ...props
  }, ref) => {
    const [currentStep, setCurrentStep] = React.useState(0)
    const [formData, setFormData] = React.useState<Record<string, any>>({})
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [isValid, setIsValid] = React.useState<Record<string, boolean>>({})
    const [touchedFields, setTouchedFields] = React.useState<Set<string>>(new Set())
    const [success, setSuccess] = React.useState(false)

    const formRef = React.useRef<HTMLFormElement>(null)
    React.useImperativeHandle(ref, () => formRef.current!, [])

    // Use steps if provided, otherwise create single step from fields
    const effectiveSteps = multiStep && steps.length > 0 
      ? steps 
      : [{ id: 'single', title: title || 'Form', fields }]

    const currentStepData = effectiveSteps[currentStep]
    const totalSteps = effectiveSteps.length
    const progress = ((currentStep + 1) / totalSteps) * 100

    // Group fields by their group property
    const groupFields = (fields: FormField[]) => {
      const groups: Record<string, FormField[]> = {}
      const ungrouped: FormField[] = []

      fields.forEach(field => {
        if (field.group) {
          if (!groups[field.group]) groups[field.group] = []
          groups[field.group].push(field)
        } else {
          ungrouped.push(field)
        }
      })

      return { groups, ungrouped }
    }

    // Handle field value changes
    const handleFieldChange = (fieldId: string, value: any) => {
      setFormData(prev => ({ ...prev, [fieldId]: value }))
      setTouchedFields(prev => new Set(prev).add(fieldId))
      
      // Clear error when user starts typing
      if (errors[fieldId]) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[fieldId]
          return newErrors
        })
      }
    }

    // Handle field validation
    const handleFieldValidation = (fieldId: string, isValid: boolean, error?: string) => {
      setIsValid(prev => ({ ...prev, [fieldId]: isValid }))
      if (error) {
        setErrors(prev => ({ ...prev, [fieldId]: error }))
      }
    }

    // Validate current step
    const validateCurrentStep = () => {
      const stepFields = currentStepData.fields
      const stepErrors: Record<string, string> = {}
      
      stepFields.forEach(field => {
        const value = formData[field.id]
        
        if (field.required && (!value || value.toString().trim() === '')) {
          stepErrors[field.id] = `${field.label} is required`
        } else if (value && field.validation) {
          if (field.validation.minLength && value.length < field.validation.minLength) {
            stepErrors[field.id] = `${field.label} must be at least ${field.validation.minLength} characters`
          }
          if (field.validation.maxLength && value.length > field.validation.maxLength) {
            stepErrors[field.id] = `${field.label} must be no more than ${field.validation.maxLength} characters`
          }
          if (field.validation.pattern && !field.validation.pattern.test(value)) {
            stepErrors[field.id] = `${field.label} format is invalid`
          }
          if (field.validation.custom) {
            const customError = field.validation.custom(value)
            if (customError) {
              stepErrors[field.id] = customError
            }
          }
        }
      })

      setErrors(stepErrors)
      return Object.keys(stepErrors).length === 0
    }

    // Handle next step
    const handleNext = () => {
      if (validateCurrentStep()) {
        if (currentStep < totalSteps - 1) {
          setCurrentStep(prev => prev + 1)
          onStepChange?.(currentStep + 1)
        }
      }
    }

    // Handle previous step
    const handlePrevious = () => {
      if (currentStep > 0) {
        setCurrentStep(prev => prev - 1)
        onStepChange?.(currentStep - 1)
      }
    }

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      
      if (!validateCurrentStep()) return

      setIsSubmitting(true)
      
      try {
        await onSubmit(formData)
        setSuccess(true)
        
        if (resetOnSubmit) {
          setFormData({})
          setCurrentStep(0)
          setTouchedFields(new Set())
          setErrors({})
        }
      } catch (error) {
        console.error('Form submission error:', error)
      } finally {
        setIsSubmitting(false)
      }
    }

    // Get field icon based on type
    const getFieldIcon = (field: FormField) => {
      if (field.icon) return field.icon
      
      switch (field.type) {
        case 'email': return <Mail className="h-4 w-4" />
        case 'password': return <Lock className="h-4 w-4" />
        case 'tel': return <Phone className="h-4 w-4" />
        case 'search': return <Search className="h-4 w-4" />
        case 'date': return <Calendar className="h-4 w-4" />
        default: return field.type === 'text' ? <User className="h-4 w-4" /> : undefined
      }
    }

    // Get field width class
    const getFieldWidthClass = (width?: string) => {
      switch (width) {
        case 'half': return 'md:col-span-6'
        case 'third': return 'md:col-span-4'
        case 'quarter': return 'md:col-span-3'
        default: return 'md:col-span-12'
      }
    }

    // Render a form field
    const renderField = (field: FormField, delay: number = 0) => (
      <motion.div
        key={field.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        className={cn("col-span-12", getFieldWidthClass(field.width))}
      >
        <EnhancedInput
          id={field.id}
          type={field.type}
          label={field.label}
          placeholder={field.placeholder}
          value={formData[field.id] || ''}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          onValidationChange={(isValid, error) => handleFieldValidation(field.id, isValid, error)}
          error={errors[field.id]}
          description={field.description}
          validationRules={{
            required: field.required,
            ...field.validation
          }}
          suggestions={field.suggestions}
          leftIcon={getFieldIcon(field)}
          variant={field.variant}
          enableRealTimeValidation={touchedFields.has(field.id)}
          showPasswordToggle={field.type === 'password'}
          className="form-field-enhanced"
        />
      </motion.div>
    )

    // Render field group
    const renderFieldGroup = (groupName: string, groupFields: FormField[], startDelay: number = 0) => (
      <motion.div
        key={groupName}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: startDelay, duration: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center space-x-2">
          <div className="h-px bg-border flex-1" />
          <Badge variant="outline" className="text-xs font-medium">
            {groupName}
          </Badge>
          <div className="h-px bg-border flex-1" />
        </div>
        <div className="grid grid-cols-12 gap-4">
          {groupFields.map((field, index) => 
            renderField(field, startDelay + 0.1 + index * 0.05)
          )}
        </div>
      </motion.div>
    )

    if (success) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="h-8 w-8 text-green-600" />
          </motion.div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">Success!</h3>
          <p className="text-gray-600">Your form has been submitted successfully.</p>
        </motion.div>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("w-full max-w-4xl mx-auto", className)}
      >
        {/* Header */}
        {(title || description) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            {title && (
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </motion.div>
        )}

        {/* Progress Indicator */}
        {multiStep && showProgress && totalSteps > 1 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Step {currentStep + 1} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}

        {/* Step Indicators */}
        {multiStep && totalSteps > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center mb-8"
          >
            {effectiveSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <motion.div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200",
                    index === currentStep
                      ? "bg-blue-500 border-blue-500 text-white"
                      : index < currentStep
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-gray-200 border-gray-300 text-gray-500"
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {index < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </motion.div>
                {index < totalSteps - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-2 transition-colors duration-200",
                      index < currentStep ? "bg-green-500" : "bg-gray-300"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </motion.div>
        )}

        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {currentStepData.icon}
              <span>{currentStepData.title}</span>
            </CardTitle>
            {currentStepData.description && (
              <p className="text-gray-600 dark:text-gray-400">
                {currentStepData.description}
              </p>
            )}
          </CardHeader>

          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" {...props}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {(() => {
                    const { groups, ungrouped } = groupFields(currentStepData.fields)
                    let delay = 0

                    return (
                      <>
                        {/* Ungrouped fields */}
                        {ungrouped.length > 0 && (
                          <div className="grid grid-cols-12 gap-4">
                            {ungrouped.map((field, index) => {
                              const fieldDelay = delay + index * 0.05
                              return renderField(field, fieldDelay)
                            })}
                          </div>
                        )}
                        
                        {/* Grouped fields */}
                        {Object.entries(groups).map(([groupName, groupFields], groupIndex) => {
                          const groupDelay = delay + ungrouped.length * 0.05 + groupIndex * 0.1
                          return renderFieldGroup(groupName, groupFields, groupDelay)
                        })}
                      </>
                    )
                  })()}
                </motion.div>
              </AnimatePresence>

              {/* Form Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between pt-6 border-t"
              >
                <div>
                  {multiStep && currentStep > 0 && (
                    <EnhancedButton
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                      leftIcon={<ArrowLeft className="h-4 w-4" />}
                    >
                      Previous
                    </EnhancedButton>
                  )}
                </div>

                <div className="flex space-x-3">
                  {autoSave && (
                    <span className="text-xs text-gray-500 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                      Auto-saved
                    </span>
                  )}

                  {multiStep && currentStep < totalSteps - 1 ? (
                    <EnhancedButton
                      type="button"
                      onClick={handleNext}
                      rightIcon={<ArrowRight className="h-4 w-4" />}
                      disabled={Object.keys(errors).length > 0}
                    >
                      Continue
                    </EnhancedButton>
                  ) : (
                    <EnhancedButton
                      type="submit"
                      loading={isSubmitting || loading}
                      loadingText="Submitting..."
                      leftIcon={<Save className="h-4 w-4" />}
                      disabled={Object.keys(errors).length > 0}
                      variant="gradient"
                      animation="glow"
                    >
                      {submitText}
                    </EnhancedButton>
                  )}
                </div>
              </motion.div>
            </form>
          </CardContent>
        </Card>

        {/* Auto-save indicator */}
        <AnimatePresence>
          {autoSave && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="text-center text-xs text-gray-500 mt-4"
            >
              Your progress is automatically saved
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

ModernForm.displayName = "ModernForm"

export { ModernForm, type FormField, type FormStep } 