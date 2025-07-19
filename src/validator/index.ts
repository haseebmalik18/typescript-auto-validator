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

// Export transformation validators
export {
  validateStringWithTransform,
  validateNumberWithTransform,
  validateBooleanWithTransform,
  validateDateWithTransform,
  validateArrayWithTransform,
  createTransformingValidator,
} from "./transforming-validators.js";

// Export composite validation functions
export {
  configureValidator,
  getValidatorConfig,
  validateWithTransform,
  createTransformingValidatorForType,
  registerTransformer,
} from "./composite-functions.js";

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
  registerValidator,
} from "./magic-validator.js";

// Export additional transformation types
export { TransformationError } from "../types.js";
