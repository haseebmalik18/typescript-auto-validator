import { useEffect, useRef } from 'react';
import { InterfaceInfo } from '../../types.js';
import { useValidation } from './use-validation.js';
import { UseValidationOptions } from '../types.js';

/**
 * React hook that validates data automatically when dependencies change
 * 
 * @example
 * ```tsx
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 * 
 * function UserProfile({ userId }: { userId: number }) {
 *   const [userData, setUserData] = useState(null);
 *   
 *   const { data, error, isValidating } = useValidationEffect<User>(
 *     userInterfaceInfo,
 *     userData,
 *     [userData], // Validate when userData changes
 *     {
 *       validateOnMount: false,
 *       debounceMs: 300,
 *     }
 *   );
 *   
 *   useEffect(() => {
 *     fetchUser(userId).then(setUserData);
 *   }, [userId]);
 *   
 *   return (
 *     <div>
 *       {isValidating && <div>Validating...</div>}
 *       {error && <div className="error">{error.message}</div>}
 *       {data && <div>Valid user: {data.name}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useValidationEffect<T>(
  interfaceInfo: InterfaceInfo,
  data: unknown,
  dependencies: React.DependencyList,
  options: UseValidationOptions<T> = {}
) {
  const { validate, ...validationState } = useValidation<T>(interfaceInfo, options);
  const previousData = useRef<unknown>(null);
  
  useEffect(() => {
    // Only validate if data has actually changed
    if (data !== previousData.current) {
      previousData.current = data;
      if (data !== null && data !== undefined) {
        validate(data);
      }
    }
  }, dependencies);
  
  return validationState;
} 