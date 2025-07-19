import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { InterfaceInfo } from "../../types.js";
import { ValidatorFactory } from "../../validator/validator-factory.js";
import { ValidationError } from "../../validator/error-handler.js";
import { wrapValidation, createValidationContext } from "../utils.js";
import { IntegrationConfig } from "../types.js";

/**
 * Configuration for form validation hooks
 */
export interface FormValidationConfig extends IntegrationConfig {
  /** Validate on change */
  validateOnChange?: boolean;
  /** Validate on blur */
  validateOnBlur?: boolean;
  /** Validate on submit */
  validateOnSubmit?: boolean;
  /** Debounce delay for validation (ms) */
  debounceMs?: number;
  /** Skip validation for empty values */
  skipEmpty?: boolean;
  /** Show all errors or just the first one */
  showAllErrors?: boolean;
  /** Custom error formatter */
  formatError?: (error: ValidationError) => string;
  /** Transform value before validation */
  transformValue?: (value: any) => any;
  /** Track validation performance */
  trackPerformance?: boolean;
}

/**
 * Form field validation state
 */
export interface FieldValidationState<T = any> {
  /** Current field value */
  value: T | null;
  /** Validation error if any */
  error: string | null;
  /** All validation errors */
  errors: string[];
  /** Whether field has been touched */
  touched: boolean;
  /** Whether field is currently being validated */
  validating: boolean;
  /** Whether field is valid */
  valid: boolean;
  /** Field validation metadata */
  metadata: {
    validationTime: number;
    validationCount: number;
    lastValidated: Date | null;
  };
}

/**
 * Form validation state
 */
export interface FormValidationState<T = Record<string, any>> {
  /** Current form values */
  values: Partial<T>;
  /** Form validation errors */
  errors: Record<string, string>;
  /** All form errors */
  allErrors: Record<string, string[]>;
  /** Touched fields */
  touched: Record<string, boolean>;
  /** Fields currently being validated */
  validating: Record<string, boolean>;
  /** Whether form is valid */
  valid: boolean;
  /** Whether any field is currently validating */
  isValidating: boolean;
  /** Form submission state */
  submitting: boolean;
  /** Form has been submitted */
  submitted: boolean;
}

/**
 * Form validation actions
 */
export interface FormValidationActions<T = Record<string, any>> {
  /** Set field value */
  setValue: (field: keyof T, value: any) => void;
  /** Set multiple values */
  setValues: (values: Partial<T>) => void;
  /** Set field error */
  setError: (field: keyof T, error: string | null) => void;
  /** Set field touched */
  setTouched: (field: keyof T, touched?: boolean) => void;
  /** Set multiple fields touched */
  setTouchedFields: (fields: (keyof T)[] | Record<string, boolean>) => void;
  /** Clear field error */
  clearError: (field: keyof T) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Validate single field */
  validateField: (field: keyof T) => Promise<boolean>;
  /** Validate entire form */
  validateForm: () => Promise<boolean>;
  /** Reset form */
  reset: (values?: Partial<T>) => void;
  /** Submit form */
  submit: (onSubmit: (values: T) => void | Promise<void>) => Promise<void>;
}

/**
 * React Hook Form integration types
 */
export interface ReactHookFormResolver<T = any> {
  (
    values: any,
    context: any,
    options: any,
  ): Promise<{
    values: T;
    errors: Record<string, { type: string; message: string }>;
  }>;
}

/**
 * Debounce utility
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Hook for validating a single form field
 */
export function useFieldValidation<T = any>(
  schema: InterfaceInfo,
  initialValue: T | null = null,
  config: FormValidationConfig = {},
): [FieldValidationState<T>, (value: T) => void, () => Promise<boolean>] {
  const validatorRef =
    useRef<ReturnType<ValidatorFactory["createValidator"]>>();
  const [state, setState] = useState<FieldValidationState<T>>({
    value: initialValue,
    error: null,
    errors: [],
    touched: false,
    validating: false,
    valid: true,
    metadata: {
      validationTime: 0,
      validationCount: 0,
      lastValidated: null,
    },
  });

  const mergedConfig = useMemo(
    () => ({
      validateOnChange: true,
      validateOnBlur: true,
      validateOnSubmit: true,
      debounceMs: 300,
      skipEmpty: false,
      showAllErrors: false,
      trackPerformance: true,
      enableLogging: false,
      ...config,
    }),
    [config],
  );

  // Initialize validator
  useEffect(() => {
    const validatorFactory = new ValidatorFactory(mergedConfig);
    validatorRef.current = validatorFactory.createValidator(schema);
  }, [schema, mergedConfig]);

  // Validation function
  const validateValue = useCallback(
    async (value: T): Promise<boolean> => {
      if (!validatorRef.current) return false;

      const startTime = Date.now();
      setState((prev) => ({ ...prev, validating: true }));

      try {
        // Skip validation for empty values if configured
        if (
          mergedConfig.skipEmpty &&
          (value === null || value === undefined || value === "")
        ) {
          setState((prev) => ({
            ...prev,
            validating: false,
            error: null,
            errors: [],
            valid: true,
            metadata: {
              ...prev.metadata,
              validationTime: Date.now() - startTime,
              validationCount: prev.metadata.validationCount + 1,
              lastValidated: new Date(),
            },
          }));
          return true;
        }

        // Transform value if transformer is provided
        const valueToValidate = mergedConfig.transformValue
          ? mergedConfig.transformValue(value)
          : value;

        const validationContext = createValidationContext("react.field");
        const result = wrapValidation(
          () => validatorRef.current!(valueToValidate),
          validationContext,
          mergedConfig,
        );

        const endTime = Date.now();

        if (result.success) {
          setState((prev) => ({
            ...prev,
            validating: false,
            error: null,
            errors: [],
            valid: true,
            metadata: {
              ...prev.metadata,
              validationTime: endTime - startTime,
              validationCount: prev.metadata.validationCount + 1,
              lastValidated: new Date(),
            },
          }));
          return true;
        } else {
          const errorMessage = mergedConfig.formatError
            ? mergedConfig.formatError(result.error!)
            : result.error!.message;

          setState((prev) => ({
            ...prev,
            validating: false,
            error: errorMessage,
            errors: [errorMessage], // Could be extended to collect multiple errors
            valid: false,
            metadata: {
              ...prev.metadata,
              validationTime: endTime - startTime,
              validationCount: prev.metadata.validationCount + 1,
              lastValidated: new Date(),
            },
          }));
          return false;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Validation failed";
        setState((prev) => ({
          ...prev,
          validating: false,
          error: errorMessage,
          errors: [errorMessage],
          valid: false,
          metadata: {
            ...prev.metadata,
            validationTime: Date.now() - startTime,
            validationCount: prev.metadata.validationCount + 1,
            lastValidated: new Date(),
          },
        }));
        return false;
      }
    },
    [mergedConfig],
  );

  // Debounced validation
  const debouncedValidate = useMemo(
    () => debounce(validateValue, mergedConfig.debounceMs || 300),
    [validateValue, mergedConfig.debounceMs],
  );

  // Set value function
  const setValue = useCallback(
    (newValue: T) => {
      setState((prev) => ({
        ...prev,
        value: newValue,
        touched: true,
      }));

      if (mergedConfig.validateOnChange) {
        debouncedValidate(newValue);
      }
    },
    [mergedConfig.validateOnChange, debouncedValidate],
  );

  // Immediate validation function
  const validate = useCallback(() => {
    return validateValue(state.value!);
  }, [validateValue, state.value]);

  return [state, setValue, validate];
}

/**
 * Hook for validating entire forms
 */
export function useFormValidation<T extends Record<string, any>>(
  schema: InterfaceInfo,
  initialValues: Partial<T> = {},
  config: FormValidationConfig = {},
): [FormValidationState<T>, FormValidationActions<T>] {
  const validatorRef =
    useRef<ReturnType<ValidatorFactory["createValidator"]>>();
  const [state, setState] = useState<FormValidationState<T>>({
    values: initialValues,
    errors: {},
    allErrors: {},
    touched: {},
    validating: {},
    valid: true,
    isValidating: false,
    submitting: false,
    submitted: false,
  });

  const mergedConfig = useMemo(
    () => ({
      validateOnChange: true,
      validateOnBlur: true,
      validateOnSubmit: true,
      debounceMs: 300,
      skipEmpty: false,
      showAllErrors: false,
      trackPerformance: true,
      enableLogging: false,
      ...config,
    }),
    [config],
  );

  // Initialize validator
  useEffect(() => {
    const validatorFactory = new ValidatorFactory(mergedConfig);
    validatorRef.current = validatorFactory.createValidator(schema);
  }, [schema, mergedConfig]);

  // Actions
  const actions: FormValidationActions<T> = useMemo(
    () => ({
      setValue: (field: keyof T, value: any) => {
        setState((prev) => ({
          ...prev,
          values: { ...prev.values, [field]: value },
          touched: { ...prev.touched, [field]: true },
        }));

        if (mergedConfig.validateOnChange) {
          // Debounced field validation would go here
        }
      },

      setValues: (values) => {
        setState((prev) => ({
          ...prev,
          values: { ...prev.values, ...values },
        }));
      },

      setError: (field, error) => {
        setState((prev) => ({
          ...prev,
          errors: { ...prev.errors, [field]: error || "" },
          allErrors: {
            ...prev.allErrors,
            [field]: error ? [error] : [],
          },
        }));
      },

      setTouched: (field, touched = true) => {
        setState((prev) => ({
          ...prev,
          touched: { ...prev.touched, [field]: touched },
        }));
      },

      setTouchedFields: (fields) => {
        const touchedUpdate = Array.isArray(fields)
          ? fields.reduce((acc, field) => ({ ...acc, [field]: true }), {})
          : fields;

        setState((prev) => ({
          ...prev,
          touched: { ...prev.touched, ...touchedUpdate },
        }));
      },

      clearError: (field) => {
        setState((prev) => {
          const { [field as string]: _, ...restErrors } = prev.errors;
          const { [field as string]: __, ...restAllErrors } = prev.allErrors;
          return {
            ...prev,
            errors: restErrors,
            allErrors: restAllErrors,
          };
        });
      },

      clearErrors: () => {
        setState((prev) => ({
          ...prev,
          errors: {},
          allErrors: {},
        }));
      },

      validateField: async (field: keyof T): Promise<boolean> => {
        if (!validatorRef.current) return false;

        setState((prev) => ({
          ...prev,
          validating: { ...prev.validating, [field]: true },
          isValidating: true,
        }));

        try {
          const value = state.values[field];
          const result = wrapValidation(
            () => validatorRef.current!(value),
            createValidationContext("form-field"),
            mergedConfig,
          );

          const isValid = result.success;
          const error = isValid
            ? null
            : result.error?.message || "Validation failed";

          setState((prev) => ({
            ...prev,
            validating: { ...prev.validating, [field]: false },
            isValidating: Object.values({
              ...prev.validating,
              [field]: false,
            }).some(Boolean),
            errors: { ...prev.errors, [field]: error || "" },
            allErrors: {
              ...prev.allErrors,
              [field]: result.success
                ? []
                : [result.error?.message || "Validation failed"],
            },
          }));

          return isValid;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Validation failed";

          setState((prev) => ({
            ...prev,
            validating: { ...prev.validating, [field]: false },
            isValidating: Object.values({
              ...prev.validating,
              [field]: false,
            }).some(Boolean),
            errors: { ...prev.errors, [field]: errorMessage },
            allErrors: { ...prev.allErrors, [field]: [errorMessage] },
          }));

          return false;
        }
      },

      validateForm: async () => {
        if (!validatorRef.current) return false;

        setState((prev) => ({ ...prev, isValidating: true }));

        try {
          const validationContext = createValidationContext("react.form");
          const result = wrapValidation(
            () => validatorRef.current!(state.values),
            validationContext,
            mergedConfig,
          );

          if (result.success) {
            setState((prev) => ({
              ...prev,
              isValidating: false,
              errors: {},
              allErrors: {},
              valid: true,
            }));
            return true;
          } else {
            const error = result.error!;
            const errorMessage = mergedConfig.formatError
              ? mergedConfig.formatError(error)
              : error.message;

            // Extract field-specific error if possible
            const field = error.path || "form";

            setState((prev) => ({
              ...prev,
              isValidating: false,
              errors: { ...prev.errors, [field]: errorMessage },
              allErrors: { ...prev.allErrors, [field]: [errorMessage] },
              valid: false,
            }));
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Form validation failed";
          setState((prev) => ({
            ...prev,
            isValidating: false,
            errors: { form: errorMessage },
            allErrors: { form: [errorMessage] },
            valid: false,
          }));
          return false;
        }
      },

      reset: (values = {}) => {
        setState({
          values: { ...initialValues, ...values },
          errors: {},
          allErrors: {},
          touched: {},
          validating: {},
          valid: true,
          isValidating: false,
          submitting: false,
          submitted: false,
        });
      },

      submit: async (onSubmit) => {
        setState((prev) => ({ ...prev, submitting: true, submitted: true }));

        try {
          const isValid = await actions.validateForm();

          if (isValid) {
            await onSubmit(state.values as T);
          }
        } finally {
          setState((prev) => ({ ...prev, submitting: false }));
        }
      },
    }),
    [state, mergedConfig, validatorRef],
  );

  return [state, actions];
}

/**
 * Creates a React Hook Form resolver using our validation system
 */
export function createReactHookFormResolver<T extends Record<string, any>>(
  interfaces: Record<keyof T, any>,
): ReactHookFormResolver<T> {
  return async (values: T) => {
    try {
      const errors: Record<string, { type: string; message: string }> = {};
      let hasErrors = false;

      // Validate each field
      for (const [field, fieldInterface] of Object.entries(interfaces)) {
        if (fieldInterface && values[field] !== undefined) {
          const validatorFactory = new ValidatorFactory({
            strict: true,
          });
          const validator = validatorFactory.createValidator(fieldInterface);

          const result = wrapValidation(
            () => validator(values[field]),
            createValidationContext("react-hook-form"),
            {},
          );

          if (!result.success && result.error) {
            errors[field] = {
              type: "validation",
              message: result.error.message,
            };
            hasErrors = true;
          }
        }
      }

      return {
        values: hasErrors ? ({} as T) : values,
        errors,
      };
    } catch (error) {
      return {
        values: {} as T,
        errors: {
          root: {
            type: "validation",
            message:
              error instanceof Error ? error.message : "Validation failed",
          },
        },
      };
    }
  };
}

/**
 * Convenience hook for simple form validation
 */
export function useSimpleValidation<T>(
  schema: InterfaceInfo,
  value: T,
  config: FormValidationConfig = {},
): {
  error: string | null;
  valid: boolean;
  validating: boolean;
  validate: () => Promise<boolean>;
} {
  const [fieldState, , validateField] = useFieldValidation(
    schema,
    value,
    config,
  );

  return {
    error: fieldState.error,
    valid: fieldState.valid,
    validating: fieldState.validating,
    validate: validateField,
  };
}
