import React from 'react';
import { InterfaceInfo } from '../../types.js';
import { validateProps } from './utils.js';
import { UseValidationOptions } from '../types.js';

/**
 * Props for the ValidatedComponent wrapper
 */
interface ValidatedComponentProps<T> {
  /**
   * Interface info for validation
   */
  interfaceInfo: InterfaceInfo;
  
  /**
   * Validation options
   */
  validationOptions?: UseValidationOptions<T>;
  
  /**
   * Component to render after validation
   */
  component: React.ComponentType<T>;
  
  /**
   * Props to validate and pass to the component
   */
  props: unknown;
  
  /**
   * Component to render while validation is in progress
   */
  loadingComponent?: React.ComponentType;
  
  /**
   * Component to render when validation fails
   */
  errorComponent?: React.ComponentType<{ error: Error }>;
}

/**
 * A wrapper component that validates props before rendering the target component
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
 * function App() {
 *   const userData = { id: 1, name: 'John', email: 'john@example.com' };
 *   
 *   return (
 *     <ValidatedComponent
 *       interfaceInfo={userCardPropsInterfaceInfo}
 *       component={UserCard}
 *       props={{ user: userData }}
 *       errorComponent={({ error }) => <div>Error: {error.message}</div>}
 *     />
 *   );
 * }
 * ```
 */
export function ValidatedComponent<T>({
  interfaceInfo,
  validationOptions = {},
  component: Component,
  props,
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
}: ValidatedComponentProps<T>): React.ReactElement | null {
  try {
    const validatedProps = validateProps<T>(interfaceInfo, props, validationOptions);
    return React.createElement(Component as any, validatedProps as any);
  } catch (error) {
    if (ErrorComponent && error instanceof Error) {
      return React.createElement(ErrorComponent, { error });
    }
    
    // Default error display in development
    if (process.env.NODE_ENV === 'development') {
      return React.createElement('div', {
        style: { 
          color: 'red', 
          border: '1px solid red', 
          padding: '8px', 
          margin: '8px' 
        }
      }, `Validation Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // In production, return null to avoid crashes
    return null;
  }
} 