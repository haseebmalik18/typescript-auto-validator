export {
  validate,
  validateAs,
  isValid,
  tryValidate,
  createValidator,
  validateBatch,
  getAvailableValidators,
  hasValidator,
} from "./validator/magic-validator.js";

export * from "./validator/index.js";

export * from "./types.js";

export * from "./performance/index.js";

export * from "./integrations/index.js";

export * from "./transformer/index.js";

export * from "./plugin/index.js";

export {
  validateLegacy as validateWithInterface,
  createValidatorLegacy as createValidatorWithInterface,
  validateWithTransform,
  ValidationError,
  ValidatorFactory,
} from "./validator/index.js";
