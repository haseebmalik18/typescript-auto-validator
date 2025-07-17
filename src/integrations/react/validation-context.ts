import React, { createContext, useContext, useCallback } from 'react';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { IntegrationConfig } from '../types.js';

/**
 * Context for sharing validation configuration across components
 */
interface ValidationContextType {
  /**
   * Global validation configuration
   */
  config: IntegrationConfig;
  
  /**
   * Create a validator with the global config
   */
  createValidatorWithContext: <T>(interfaceInfo: InterfaceInfo, overrides?: Partial<IntegrationConfig>) => (data: unknown) => T;
  
  /**
   * Update global validation configuration
   */
  updateConfig: (newConfig: Partial<IntegrationConfig>) => void;
}

const ValidationContext = createContext<ValidationContextType | null>(null);

/**
 * Props for ValidationProvider
 */
interface ValidationProviderProps {
  children: React.ReactNode;
  config?: IntegrationConfig;
}

/**
 * Provider component that supplies validation configuration to child components
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ValidationProvider
 *       config={{
 *         enableLogging: true,
 *         autoTransform: true,
 *         detailedErrors: process.env.NODE_ENV === 'development',
 *       }}
 *     >
 *       <UserProfile />
 *       <UserForm />
 *     </ValidationProvider>
 *   );
 * }
 * ```
 */
export function ValidationProvider({ children, config = {} }: ValidationProviderProps) {
  const [currentConfig, setCurrentConfig] = React.useState<IntegrationConfig>(config);
  
  const createValidatorWithContext = useCallback(<T>(
    interfaceInfo: InterfaceInfo, 
    overrides: Partial<IntegrationConfig> = {}
  ) => {
    const mergedConfig = { ...currentConfig, ...overrides };
    return new ValidatorFactory().createValidator<T>(interfaceInfo, mergedConfig);
  }, [currentConfig]);
  
  const updateConfig = useCallback((newConfig: Partial<IntegrationConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
  }, []);
  
  const contextValue: ValidationContextType = {
    config: currentConfig,
    createValidatorWithContext,
    updateConfig,
  };
  
  return React.createElement(
    ValidationContext.Provider,
    { value: contextValue },
    children
  );
}

/**
 * Hook to access validation context
 * 
 * @example
 * ```tsx
 * function UserForm() {
 *   const { createValidatorWithContext, config } = useValidationContext();
 *   
 *   const validator = createValidatorWithContext<User>(userInterfaceInfo);
 *   
 *   const handleSubmit = (data: unknown) => {
 *     try {
 *       const user = validator(data);
 *       console.log('Valid user:', user);
 *     } catch (error) {
 *       console.error('Validation failed:', error);
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useValidationContext(): ValidationContextType {
  const context = useContext(ValidationContext);
  
  if (!context) {
    throw new Error('useValidationContext must be used within a ValidationProvider');
  }
  
  return context;
} 