import React from 'react';
import { InterfaceInfo } from '../../types.js';
import { validateProps } from './utils.js';
import { UseValidationOptions } from '../types.js';

/**
 * Higher-order component that adds validation to React components
 * 
 * @example
 * ```tsx
 * interface UserCardProps {
 *   user: {
 *     id: number;
 *     name: string;
 *     email: string;
 *   };
 * }
 * 
 * function UserCard({ user }: UserCardProps) {
 *   return (
 *     <div>
 *       <h3>{user.name}</h3>
 *       <p>{user.email}</p>
 *     </div>
 *   );
 * }
 * 
 * const ValidatedUserCard = withValidation<UserCardProps>(
 *   userCardPropsInterfaceInfo,
 *   {
 *     enableLogging: true,
 *     autoTransform: true,
 *   }
 * )(UserCard);
 * 
 * // Usage
 * function App() {
 *   const userData = { id: 1, name: 'John', email: 'john@example.com' };
 *   
 *   return <ValidatedUserCard user={userData} />;
 * }
 * ```
 */
export function withValidation<T>(
  interfaceInfo: InterfaceInfo,
  validationOptions: UseValidationOptions<T> = {}
) {
  return function<P extends T>(Component: React.ComponentType<P>) {
    const WrappedComponent = (props: unknown) => {
      try {
        const validatedProps = validateProps<T>(interfaceInfo, props, validationOptions);
        return React.createElement(Component as any, validatedProps as any);
      } catch (error) {
        // In development, show validation errors
        if (process.env.NODE_ENV === 'development') {
          return React.createElement('div', {
            style: { 
              color: 'red', 
              border: '1px solid red', 
              padding: '8px', 
              margin: '8px' 
            }
          }, `Validation Error in ${Component.displayName || Component.name || 'Component'}: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // In production, return null to avoid crashes
        return null;
      }
    };
    
    // Set display name for debugging
    WrappedComponent.displayName = `withValidation(${Component.displayName || Component.name || 'Component'})`;
    
    return WrappedComponent;
  };
} 