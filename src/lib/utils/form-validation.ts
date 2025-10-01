export interface ValidationField {
  id: string;
  value: any;
  label: string;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: ValidationField[];
  firstMissingFieldId?: string;
}

export function validateForm(fields: ValidationField[]): ValidationResult {
  const missingFields = fields.filter(field => {
    if (!field.required) return false;
    
    // Check for empty values
    if (field.value === null || field.value === undefined) return true;
    if (typeof field.value === 'string' && field.value.trim() === '') return true;
    if (Array.isArray(field.value) && field.value.length === 0) return true;
    
    return false;
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    firstMissingFieldId: missingFields.length > 0 ? missingFields[0].id : undefined
  };
}

export function highlightMissingFields(missingFieldIds: string[]) {
  missingFieldIds.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      // Add error styling
      element.classList.add('border-red-500', 'border-2', 'ring-2', 'ring-red-200');
      element.classList.remove('border-gray-300', 'border-gray-200');
      
      // Add shake animation
      element.classList.add('animate-pulse');
      
      // Remove animation after 2 seconds
      setTimeout(() => {
        element.classList.remove('animate-pulse');
      }, 2000);
    }
  });
}

export function clearFieldHighlights(fieldIds: string[]) {
  fieldIds.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.classList.remove('border-red-500', 'border-2', 'ring-2', 'ring-red-200');
      element.classList.add('border-gray-300');
    }
  });
}

export function scrollToFirstMissingField(fieldId: string) {
  const element = document.getElementById(fieldId);
  if (element) {
    // Scroll to element with some offset for better visibility
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const middle = absoluteElementTop - (window.innerHeight / 2);
    
    window.scrollTo({
      top: middle,
      behavior: 'smooth'
    });
    
    // Focus the element after scrolling
    setTimeout(() => {
      element.focus();
    }, 500);
  }
}

export function createFieldValidation(
  id: string,
  value: any,
  label: string,
  required: boolean = false
): ValidationField {
  return { id, value, label, required };
} 