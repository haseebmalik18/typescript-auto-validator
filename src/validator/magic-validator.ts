import { ValidatorConfig } from "../types.js";
import { ValidationError } from "./error-handler.js";

/**
 * Registry of generated validators (populated at build time)
 */
const VALIDATOR_REGISTRY = new Map<string, (data: unknown, config?: ValidatorConfig) => any>();

/**
 * Magic validate function that uses build-time generated validators
 */
export function validate<T>(data: unknown, config?: ValidatorConfig): T {
  const typeName = getTypeName<T>();
  return validateAs<T>(typeName, data, config);
}

/**
 * Validate data against a specific interface by name
 */
export function validateAs<T>(typeName: string, data: unknown, config?: ValidatorConfig): T {
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}". ` +
      `Make sure it's exported and processed by the TypeScript Runtime Validator build plugin.\n\n` +
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

/**
 * Check if data is valid without throwing errors
 */
export function isValid<T>(data: unknown, config?: ValidatorConfig): data is T {
  try {
    validate<T>(data, config);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate data and return a result object instead of throwing
 */
export function tryValidate<T>(
  data: unknown, 
  config?: ValidatorConfig
): { success: true; data: T } | { success: false; error: ValidationError } {
  try {
    const validData = validate<T>(data, config);
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

/**
 * Create a reusable validator function for a specific type
 */
export function createValidator<T>(config?: ValidatorConfig): (data: unknown) => T {
  const typeName = getTypeName<T>();
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}"`,
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

/**
 * Clear all registered validators (useful for testing)
 * 
 * @internal
 */
export function clearValidators(): void {
  VALIDATOR_REGISTRY.clear();
}

/**
 * Extract type name from TypeScript generic type parameter
 * 
 * This uses a combination of techniques to reliably extract the type name
 * from the call site. This is the "magic" that makes the API so simple.
 * 
 * @internal
 */
function getTypeName<T>(): string {
  const error = new Error();
  const stack = error.stack || '';
  
  const patterns = [
    /validate<(\w+)>/,
    /createValidator<(\w+)>/,
    /isValid<(\w+)>/,
    /tryValidate<(\w+)>/
  ];
  
  for (const pattern of patterns) {
    const match = stack.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  throw new ValidationError(
    'Could not determine the TypeScript interface name. ' +
    'Make sure you\'re using the generic syntax like validate<YourInterface>(data). ' +
    'If the interface name extraction fails, you can use validateAs("InterfaceName", data) instead.',
    'validation.type-extraction'
  );
}

/**
 * Batch validation for multiple values of the same type
 */
export function validateBatch<T>(items: unknown[], config?: ValidatorConfig): T[] {
  const typeName = getTypeName<T>();
  const validator = VALIDATOR_REGISTRY.get(typeName);
  
  if (!validator) {
    throw new ValidationError(
      `No validator found for interface "${typeName}"`,
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