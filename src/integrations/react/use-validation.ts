import { useState, useCallback, useRef, useEffect } from 'react';
import { ValidationError } from '../../validator/error-handler.js';
import { ValidatorFactory } from '../../validator/index.js';
import { InterfaceInfo } from '../../types.js';
import { 
  UseValidationOptions, 
  ValidationHookState,
} from '../types.js';
import { 
  wrapValidation, 
  createValidationContext, 
  debounce,
} from '../utils.js';

/**
 * React hook for synchronous validation with TypeScript interfaces
 */
export function useValidation<T>(
  interfaceInfo: InterfaceInfo,
  options: UseValidationOptions<T> = {}
): ValidationHookState<T> {
  const [data, setData] = useState<T | null>(options.defaultValue || null);
  const [error, setError] = useState<ValidationError | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  
  // Store the last validation input for retry functionality
  const lastValidationInput = useRef<unknown>(null);
  
  // Create validator function (memoized)
  const validatorFactory = useRef(new ValidatorFactory());
  const validator = useRef(validatorFactory.current.createValidator<T>(interfaceInfo, options));
  
  // Update validator when interface or options change
  useEffect(() => {
    validator.current = validatorFactory.current.createValidator<T>(interfaceInfo, options);
  }, [interfaceInfo, options]);
  
  // Core validation function
  const performValidation = useCallback((input: unknown): void => {
    if (isValidating) return; // Prevent concurrent validations
    
    setIsValidating(true);
    lastValidationInput.current = input;
    
    if (options.clearErrorOnValidate !== false) {
      setError(null);
    }
    
    const context = createValidationContext('useValidation', undefined, undefined, {
      interfaceName: interfaceInfo.name,
      hookOptions: options,
    });
    
    const result = wrapValidation(
      () => validator.current(input),
      context,
      options
    );
    
    setIsValidating(false);
    setHasValidated(true);
    
    if (result.success && result.data !== undefined) {
      setData(result.data);
      setError(null);
    } else if (result.error) {
      setError(result.error);
      if (!options.clearErrorOnValidate) {
        setData(null);
      }
    }
  }, [interfaceInfo, options, isValidating]);
  
  // Debounced validation if debounceMs is specified
  const debouncedValidation = useRef(
    options.debounceMs && options.debounceMs > 0
      ? debounce(performValidation, options.debounceMs)
      : performValidation
  );
  
  // Update debounced function when options change
  useEffect(() => {
    debouncedValidation.current = options.debounceMs && options.debounceMs > 0
      ? debounce(performValidation, options.debounceMs)
      : performValidation;
  }, [performValidation, options.debounceMs]);
  
  // Public validation function
  const validate = useCallback(async (input: unknown): Promise<void> => {
    return Promise.resolve(debouncedValidation.current(input));
  }, []);
  
  // Retry last validation
  const retry = useCallback(async (): Promise<void> => {
    if (lastValidationInput.current !== null) {
      return validate(lastValidationInput.current);
    }
  }, [validate]);
  
  // Clear validation state
  const clear = useCallback((): void => {
    setData(options.defaultValue || null);
    setError(null);
    setIsValidating(false);
    setHasValidated(false);
    lastValidationInput.current = null;
  }, [options.defaultValue]);
  
  // Validate on mount if requested
  useEffect(() => {
    if (options.validateOnMount && options.defaultValue !== undefined) {
      validate(options.defaultValue);
    }
  }, []); // Only run on mount
  
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
 * Simpler hook for one-time validation without state management
 * 
 * @example
 * ```tsx
 * function QuickValidation() {
 *   const validateUser = useValidationFunction<User>(userInterfaceInfo);
 *   
 *   const handleClick = () => {
 *     try {
 *       const user = validateUser(someData);
 *       console.log('Valid user:', user);
 *     } catch (error) {
 *       console.error('Validation failed:', error);
 *     }
 *   };
 *   
 *   return <button onClick={handleClick}>Validate</button>;
 * }
 * ```
 */
export function useValidationFunction<T>(
  interfaceInfo: InterfaceInfo,
  options: UseValidationOptions<T> = {}
): (input: unknown) => T {
  const validatorFactory = useRef(new ValidatorFactory());
  const validator = useRef(validatorFactory.current.createValidator<T>(interfaceInfo, options));
  
  // Update validator when interface or options change
  useEffect(() => {
    validator.current = validatorFactory.current.createValidator<T>(interfaceInfo, options);
  }, [interfaceInfo, options]);
  
  return useCallback((input: unknown): T => {
    return validator.current(input);
  }, []);
}

/**
 * Hook that validates data and returns boolean result without state
 * 
 * @example
 * ```tsx
 * function ValidationCheck() {
 *   const isValid = useValidationCheck<User>(userInterfaceInfo);
 *   
 *   return (
 *     <div>
 *       User data is: {isValid(userData) ? 'valid' : 'invalid'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useValidationCheck<T>(
  interfaceInfo: InterfaceInfo,
  options: UseValidationOptions<T> = {}
): (input: unknown) => boolean {
  const validatorFactory = useRef(new ValidatorFactory());
  const validator = useRef(validatorFactory.current.createValidator<T>(interfaceInfo, options));
  
  // Update validator when interface or options change
  useEffect(() => {
    validator.current = validatorFactory.current.createValidator<T>(interfaceInfo, options);
  }, [interfaceInfo, options]);
  
  return useCallback((input: unknown): boolean => {
    try {
      validator.current(input);
      return true;
    } catch {
      return false;
    }
  }, []);
} 