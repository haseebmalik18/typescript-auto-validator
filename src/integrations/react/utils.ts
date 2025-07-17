import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { UseValidationOptions } from '../types.js';
import { useValidation } from './use-validation.js';

/**
 * Validates React component props against an interface
 * 
 * @example
 * ```tsx
 * interface UserCardProps {
 *   user: {
 *     id: number;
 *     name: string;
 *     email: string;
 *   };
 *   onEdit?: () => void;
 * }
 * 
 * function UserCard(props: UserCardProps) {
 *   const validatedProps = validateProps<UserCardProps>(userCardPropsInterfaceInfo, props);
 *   
 *   return (
 *     <div>
 *       <h3>{validatedProps.user.name}</h3>
 *       <p>{validatedProps.user.email}</p>
 *       {validatedProps.onEdit && (
 *         <button onClick={validatedProps.onEdit}>Edit</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function validateProps<T>(
  interfaceInfo: InterfaceInfo,
  props: unknown,
  options: UseValidationOptions<T> = {}
): T {
  try {
    const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, options);
    return validator(props);
  } catch (error) {
    if (error instanceof ValidationError) {
      // In development, throw detailed validation errors
      // In production, you might want to handle this differently
      if (process.env.NODE_ENV === 'development') {
        console.error('Props validation failed:', error.message);
        console.error('Invalid props:', props);
        throw error;
      } else {
        // In production, log the error but return the props as-is to prevent crashes
        console.error('Props validation failed (silently handled in production):', error.message);
        return props as T;
      }
    }
    throw error;
  }
}

/**
 * Factory function to create custom validation hooks
 * 
 * @example
 * ```tsx
 * const useUserValidation = createValidatedHook<User>(userInterfaceInfo, {
 *   enableLogging: true,
 *   autoTransform: true,
 * });
 * 
 * function UserForm() {
 *   const { data, error, validate } = useUserValidation();
 *   // ... rest of component
 * }
 * ```
 */
export function createValidatedHook<T>(
  interfaceInfo: InterfaceInfo,
  defaultOptions: UseValidationOptions<T> = {}
) {
  return function(options: UseValidationOptions<T> = {}) {
    const mergedOptions = { ...defaultOptions, ...options };
    return useValidation<T>(interfaceInfo, mergedOptions);
  };
} 