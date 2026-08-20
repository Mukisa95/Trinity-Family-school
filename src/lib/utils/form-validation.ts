import { useCallback, useMemo, useRef, useState } from 'react';

export type FieldValidator = (
  value: unknown,
  fields: ValidationField[],
) => string | undefined;

export interface ValidationField {
  id: string;
  value: unknown;
  label: string;
  required: boolean;
  message?: string;
  active?: boolean;
  focusTargetId?: string;
  validate?: FieldValidator;
  reveal?: () => void | Promise<void>;
}

export interface FormFieldError {
  id: string;
  label: string;
  message: string;
  focusTargetId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: ValidationField[];
  errors: FormFieldError[];
  firstMissingFieldId?: string;
}

export interface UseFormValidationOptions {
  scrollBehavior?: ScrollBehavior;
  scrollBlock?: ScrollLogicalPosition;
}

const DEFAULT_REQUIRED_MESSAGE = (label: string) =>
  `Enter or select ${label.toLowerCase()}.`;

export function isEmptyFormValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function getValidationError(
  field: ValidationField,
  fields: ValidationField[],
): string | undefined {
  if (field.active === false) return undefined;
  if (field.required && isEmptyFormValue(field.value)) {
    return field.message || DEFAULT_REQUIRED_MESSAGE(field.label);
  }
  return field.validate?.(field.value, fields);
}

export function validateForm(fields: ValidationField[]): ValidationResult {
  const errors = fields.reduce<FormFieldError[]>((result, field) => {
    const message = getValidationError(field, fields);
    if (message) {
      result.push({
        id: field.id,
        label: field.label,
        message,
        focusTargetId: field.focusTargetId,
      });
    }
    return result;
  }, []);

  const invalidIds = new Set(errors.map((error) => error.id));
  const missingFields = fields.filter((field) => invalidIds.has(field.id));

  return {
    isValid: errors.length === 0,
    missingFields,
    errors,
    firstMissingFieldId: errors[0]?.id,
  };
}

export function updateFieldErrorState(
  previous: Record<string, FormFieldError>,
  field: ValidationField,
  fields: ValidationField[],
) {
  const message = getValidationError(field, fields);
  if (!message) {
    if (!previous[field.id]) return previous;
    const next = { ...previous };
    delete next[field.id];
    return next;
  }
  return {
    ...previous,
    [field.id]: {
      id: field.id,
      label: field.label,
      message,
      focusTargetId: field.focusTargetId,
    },
  };
}

function getFieldElement(field: Pick<ValidationField, 'id' | 'focusTargetId'>) {
  if (typeof document === 'undefined') return null;

  const targetId = field.focusTargetId || field.id;
  const escapedTarget =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(targetId)
      : targetId.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, '\\$1');
  const escapedField =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(field.id)
      : field.id.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, '\\$1');

  return (
    document.getElementById(targetId) ||
    document.querySelector<HTMLElement>(`[data-validation-control="${escapedTarget}"]`) ||
    document.querySelector<HTMLElement>(
      `[data-validation-field="${escapedField}"] input, ` +
        `[data-validation-field="${escapedField}"] textarea, ` +
        `[data-validation-field="${escapedField}"] button, ` +
        `[data-validation-field="${escapedField}"] [tabindex]`,
    )
  );
}

async function waitForReveal() {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      resolve();
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function focusValidationField(
  field: ValidationField,
  options: UseFormValidationOptions = {},
) {
  await field.reveal?.();
  await waitForReveal();
  const element = getFieldElement(field);
  if (!element) return false;

  element.scrollIntoView({
    behavior: options.scrollBehavior || 'smooth',
    block: options.scrollBlock || 'center',
    inline: 'nearest',
  });
  element.focus({ preventScroll: true });
  return true;
}

export function useFormValidation(
  fields: ValidationField[],
  options: UseFormValidationOptions = {},
) {
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const [fieldErrors, setFieldErrors] = useState<Record<string, FormFieldError>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [submissionError, setSubmissionError] = useState<string>();

  const validateField = useCallback((fieldId: string) => {
    const currentFields = fieldsRef.current;
    const field = currentFields.find((candidate) => candidate.id === fieldId);
    if (!field) return true;

    setTouchedFields((previous) => new Set(previous).add(fieldId));
    const message = getValidationError(field, currentFields);
    setFieldErrors((previous) => updateFieldErrorState(previous, field, currentFields));
    return !message;
  }, []);

  const focusField = useCallback(
    async (fieldId: string) => {
      const field = fieldsRef.current.find((candidate) => candidate.id === fieldId);
      return field ? focusValidationField(field, options) : false;
    },
    [options.scrollBehavior, options.scrollBlock],
  );

  const validateAll = useCallback(
    (config: { focus?: boolean } = { focus: true }) => {
      const result = validateForm(fieldsRef.current);
      setFieldErrors(Object.fromEntries(result.errors.map((error) => [error.id, error])));
      setTouchedFields(new Set(result.errors.map((error) => error.id)));
      setSubmissionError(undefined);
      if (!result.isValid && config.focus !== false && result.firstMissingFieldId) {
        void focusField(result.firstMissingFieldId);
      }
      return result;
    },
    [focusField],
  );

  const clearFieldError = useCallback((fieldId: string) => {
    setFieldErrors((previous) => {
      if (!previous[fieldId]) return previous;
      const next = { ...previous };
      delete next[fieldId];
      return next;
    });
  }, []);

  const handleFieldChange = useCallback(
    (fieldId: string) => {
      if (fieldErrors[fieldId]) queueMicrotask(() => validateField(fieldId));
    },
    [fieldErrors, validateField],
  );

  const resetValidation = useCallback(() => {
    setFieldErrors({});
    setTouchedFields(new Set());
    setSubmissionError(undefined);
  }, []);

  const errors = useMemo(
    () =>
      fields
        .map((field) => fieldErrors[field.id])
        .filter((error): error is FormFieldError => Boolean(error)),
    [fieldErrors, fields],
  );

  const getFieldError = useCallback(
    (fieldId: string) => fieldErrors[fieldId],
    [fieldErrors],
  );

  const getFieldProps = useCallback(
    (fieldId: string) => {
      const error = fieldErrors[fieldId];
      return {
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? `${fieldId}-error` : undefined,
        'data-validation-control': fieldId,
        onBlur: () => validateField(fieldId),
      } as const;
    },
    [fieldErrors, validateField],
  );

  return {
    errors,
    fieldErrors,
    touchedFields,
    submissionError,
    setSubmissionError,
    validateField,
    validateAll,
    clearFieldError,
    handleFieldChange,
    focusField,
    getFieldError,
    getFieldProps,
    resetValidation,
    isValid: errors.length === 0 && !submissionError,
  };
}

// Compatibility helpers for forms that are migrated incrementally.
export function highlightMissingFields(missingFieldIds: string[]) {
  missingFieldIds.forEach((fieldId) => {
    const element = getFieldElement({ id: fieldId });
    element?.setAttribute('aria-invalid', 'true');
    element?.setAttribute('aria-describedby', `${fieldId}-error`);
  });
}

export function clearFieldHighlights(fieldIds: string[]) {
  fieldIds.forEach((fieldId) => {
    const element = getFieldElement({ id: fieldId });
    element?.removeAttribute('aria-invalid');
    element?.removeAttribute('aria-describedby');
  });
}

export function scrollToFirstMissingField(fieldId: string) {
  void focusValidationField({
    id: fieldId,
    value: undefined,
    label: fieldId,
    required: true,
  });
}

export function createFieldValidation(
  id: string,
  value: unknown,
  label: string,
  required = false,
  options: Partial<Omit<ValidationField, 'id' | 'value' | 'label' | 'required'>> = {},
): ValidationField {
  return { id, value, label, required, ...options };
}
