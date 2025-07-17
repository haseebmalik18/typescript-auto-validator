import { useState, useCallback, useRef, useEffect } from 'react';
import { ValidationError } from '../../validator/error-handler.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { InterfaceInfo } from '../../types.js';
import { 
  UseValidationOptions, 
  ValidationHookState,
} from '../types.js';
import { 
  wrapAsyncValidation, 
  createValidationContext, 
  debounce,
} from '../utils.js';

/**
 * React hook for asynchronous validation with TypeScript interfaces
 */
export function useAsyncValidation<T>(
  interfaceInfo: InterfaceInfo,
  options: UseValidationOptions<T> & {
    customValidators?: Record<string, (value: any) => Promise<any>>;
    validateSequentially?: boolean; // Validate properties one by one vs in parallel
  } = {}
): ValidationHookState<T> {
  const [data, setData] = useState<T | null>(options.defaultValue || null);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  
  // Store the last validation input for retry functionality
  const lastValidationInput = useRef<unknown>(null);
  
  // Create validator function (memoized)
  const validator = useRef(new ValidatorFactory().createValidator<T>(interfaceInfo, options));
  
  // Update validator when interface or options change
  useEffect(() => {
    validator.current = new ValidatorFactory().createValidator<T>(interfaceInfo, options);
  }, [interfaceInfo, options]);
  
  // Debounced validation function
  const debouncedValidate = useRef(
    debounce(async (input: unknown) => {
      if (options.clearErrorOnValidate !== false) {
        setError(null);
      }
      
      setIsValidating(true);
      setHasValidated(true);
      
      try {
        const context = createValidationContext('react.async-validation');
        
        // First run synchronous validation
        const syncResult = validator.current(input);
        
        // If we have custom async validators, run them
        if (options.customValidators && typeof syncResult === 'object' && syncResult !== null) {
          await runCustomValidators(syncResult as Record<string, unknown>, options.customValidators);
        }
        
        setData(syncResult);
        setError(null);
      } catch (validationError) {
        const error = validationError instanceof ValidationError 
          ? validationError 
          : new ValidationError(String(validationError), 'react.async-validation');
        
        setError(error);
        setData(null);
      } finally {
        setIsValidating(false);
      }
    }, options.debounceMs || 0)
  );
  
  const validate = useCallback(async (input: unknown): Promise<void> => {
    lastValidationInput.current = input;
    await debouncedValidate.current(input);
  }, [debouncedValidate]);
  
  const clear = useCallback(() => {
    setData(null);
    setError(null);
    setIsValidating(false);
    setHasValidated(false);
    lastValidationInput.current = null;
  }, []);
  
  const retry = useCallback(async (): Promise<void> => {
    if (lastValidationInput.current !== null) {
      await validate(lastValidationInput.current);
    }
  }, [validate]);
  
  return {
    data,
    error,
    isValidating,
    hasValidated,
    validate,
    clear,
    retry,
  };
}

/**
 * Helper function to run custom async validators
 */
async function runCustomValidators(
  data: Record<string, unknown>,
  customValidators: Record<string, (value: any) => Promise<any>>
): Promise<void> {
  const promises = Object.entries(customValidators).map(async ([key, validator]) => {
    if (key in data) {
      try {
        const result = await validator(data[key]);
        data[key] = result; // Update with validated/transformed value
      } catch (error) {
        throw new ValidationError(`Custom validation failed for ${key}: ${String(error)}`, key);
      }
    }
  });
  
  await Promise.all(promises);
} 