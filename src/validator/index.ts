// Export all validator functions
export {
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateLiteral,
  validateNull,
  validateUndefined,
  validateAny,
  validateUnknown,
  validateNever,
} from "./primitive-validator.js";

export {
  validateObject,
  validateProperty,
  validateObjectWithProperties,
  validateObjectWithPropertyInfo,
  validatePartialObject,
} from "./object-validator.js";

export { validateArray, validateArrayElements, validateTuple } from "./array-validator.js";

export {
  validateUnion,
  validateLiteralUnion,
  validateDiscriminatedUnion,
} from "./union-validator.js";

export {
  validateIntersection,
  validateBrandedType,
} from "./intersection-validator.js";

// Export factory and utilities
export { ValidatorFactory } from "./validator-factory.js";
export { ValidationError } from "./error-handler.js";

// Export transformation functionality
export {
  TransformationEngine,
  getBuiltInTransformers,
  getDefaultTransformationStrategy,
} from "./transformation-engine.js";

export { getAdvancedTransformers } from "./advanced-transformers.js";

// Export magic validator functions (NEW!)
export {
  validate,
  validateAs,
  isValid,
  tryValidate,
  createValidator,
  validateBatch,
  getAvailableValidators,
  hasValidator,
} from "./magic-validator.js";

// Export additional transformation types
export { TransformationError } from "../types.js";

// Legacy API for backwards compatibility - use different names to avoid conflicts
import { ValidatorFactory } from "./validator-factory.js";

const globalValidatorFactory = new ValidatorFactory();

export function validateLegacy<T>(data: unknown, interfaceInfo?: any, config?: any): T {
  if (!interfaceInfo) {
    throw new Error(
      "validateLegacy() requires interface information. Use createValidator() for reusable validators.",
    );
  }

  const validator = globalValidatorFactory.createValidator<T>(interfaceInfo, config);
  return validator(data);
}

export function createValidatorLegacy<T>(interfaceInfo: any, config?: any): (data: unknown) => T {
  return globalValidatorFactory.createValidator<T>(interfaceInfo, config);
}

/**
 * Create a validator for a specific type with transformations
 */
export function createTransformingValidatorForType<T>(typeInfo: any, config?: any): (data: unknown) => T {
  return globalValidatorFactory.createTypeValidator<T>(typeInfo, config);
}

/**
 * Validate with transformation support
 */
export function validateWithTransform<T>(data: unknown, interfaceInfo: any, config?: any): T {
  const transformingConfig = { autoTransform: true, ...config };
  const validator = globalValidatorFactory.createValidator<T>(interfaceInfo, transformingConfig);
  return validator(data);
}

/**
 * Get the global validator factory instance
 */
export function getValidatorFactory(): ValidatorFactory {
  return globalValidatorFactory;
}

/**
 * Configure the global validator factory with transformation settings
 */
export function configureValidator(config: any): void {
  globalValidatorFactory.updateConfig(config);
}

/**
 * Register a custom transformer globally
 */
export function registerTransformer(name: string, transformer: any): void {
  globalValidatorFactory.registerTransformer(name, transformer);
}
