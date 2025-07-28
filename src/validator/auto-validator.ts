import { ValidatorConfig } from "../types.js";
import { ValidationError } from "./error-handler.js";

const VALIDATOR_REGISTRY = new Map<string, (data: unknown, config?: ValidatorConfig) => any>();

// Enhanced validation functions that require explicit type names
export function validate<T>(typeName: string, data: unknown, config?: ValidatorConfig): T {
  return validateAs<T>(typeName, data, config);
}

export function validateAs<T>(typeName: string, data: unknown, config?: ValidatorConfig): T {
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}". ` +
      `Make sure it's exported and processed by the ts-auto-validator build plugin.\n\n` +
      `Available validators: ${getAvailableValidators().join(', ') || 'none'}`,
      'validation.setup'
    );
  }
  
  try {
    return validator(data, config);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(
        `Validation failed for ${typeName}: ${error.message}`,
        error.path,
        error.expected,
        error.received,
        error.value
      );
    }
    
    throw new ValidationError(
      `Unexpected error validating ${typeName}: ${error instanceof Error ? error.message : String(error)}`,
      'validation.unexpected'
    );
  }
}

export function isValid<T>(typeName: string, data: unknown, config?: ValidatorConfig): data is T {
  try {
    validate<T>(typeName, data, config);
    return true;
  } catch {
    return false;
  }
}

export function tryValidate<T>(
  typeName: string,
  data: unknown, 
  config?: ValidatorConfig
): { success: true; data: T } | { success: false; error: ValidationError } {
  try {
    const validData = validate<T>(typeName, data, config);
    return { success: true, data: validData };
  } catch (error) {
    const validationError = error instanceof ValidationError 
      ? error 
      : new ValidationError(
          `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
          'validation.unexpected'
        );
    
    return { success: false, error: validationError };
  }
}

export function createValidator<T>(typeName: string, config?: ValidatorConfig): (data: unknown) => T {
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}". ` +
      `Available validators: ${getAvailableValidators().join(', ') || 'none'}`,
      'validation.setup'
    );
  }
  
  return (data: unknown) => validator(data, config);
}

export function registerValidator(typeName: string, validatorFn: (data: unknown, config?: ValidatorConfig) => any): void {
  VALIDATOR_REGISTRY.set(typeName, validatorFn);
}

export function getAvailableValidators(): string[] {
  return Array.from(VALIDATOR_REGISTRY.keys()).sort();
}

export function hasValidator(typeName: string): boolean {
  return VALIDATOR_REGISTRY.has(typeName);
}

export function clearValidators(): void {
  VALIDATOR_REGISTRY.clear();
}

// Type-safe validator creation with explicit interface names
export function createTypedValidator<T>(): {
  validate: (data: unknown, config?: ValidatorConfig) => T;
  isValid: (data: unknown, config?: ValidatorConfig) => data is T;
  tryValidate: (data: unknown, config?: ValidatorConfig) => { success: true; data: T } | { success: false; error: ValidationError };
} {
  const registeredTypeName: string | null = null;
  
  return {
    validate: (data: unknown, config?: ValidatorConfig): T => {
      if (!registeredTypeName) {
        throw new ValidationError(
          'Validator not properly registered. Use registerValidator() first or use validate() with explicit type name.',
          'validation.setup'
        );
      }
      return validateAs<T>(registeredTypeName, data, config);
    },
    
    isValid: (data: unknown, config?: ValidatorConfig): data is T => {
      if (!registeredTypeName) return false;
      return isValid<T>(registeredTypeName, data, config);
    },
    
    tryValidate: (data: unknown, config?: ValidatorConfig) => {
      if (!registeredTypeName) {
        return {
          success: false,
          error: new ValidationError(
            'Validator not properly registered. Use registerValidator() first.',
            'validation.setup'
          )
        };
      }
      return tryValidate<T>(registeredTypeName, data, config);
    }
  };
}

export function validateBatch<T>(typeName: string, items: unknown[], config?: ValidatorConfig): T[] {
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}". ` +
      `Available validators: ${getAvailableValidators().join(', ') || 'none'}`,
      'validation.setup'
    );
  }
  
  return items.map((item, index) => {
    try {
      return validator(item, config);
    } catch (error) {
      if (error instanceof ValidationError) {
        const batchPath = `[${index}]${error.path ? '.' + error.path : ''}`;
        throw new ValidationError(
          error.message,
          batchPath,
          error.expected,
          error.received,
          error.value
        );
      }
      throw error;
    }
  });
}