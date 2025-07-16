export { ValidationError } from "./error-handler.js";
export { ValidatorFactory } from "./validator-factory.js";
export type { ValidatorFunction } from "./validator-factory.js";
import { ValidatorFactory } from "./validator-factory.js";

export {
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateLiteral,
} from "./primitive-validator.js";

export {
  validateObject,
  validateProperty,
  validateObjectWithProperties,
} from "./object-validator.js";

export {
  validateArray,
  validateArrayElements,
  validateTuple,
} from "./array-validator.js";

export { validateUnion, validateLiteralUnion } from "./union-validator.js";

const globalValidatorFactory = new ValidatorFactory();

export function validate<T>(data: unknown, interfaceInfo?: any): T {
  if (!interfaceInfo) {
    throw new Error(
      "validate() requires interface information. Use createValidator() for reusable validators.",
    );
  }

  const validator = globalValidatorFactory.createValidator<T>(interfaceInfo);
  return validator(data);
}

export function createValidator<T>(interfaceInfo: any): (data: unknown) => T {
  return globalValidatorFactory.createValidator<T>(interfaceInfo);
}

export function validateType<T>(data: unknown, typeInfo: any): T {
  const validator = globalValidatorFactory.createTypeValidator<T>(typeInfo);
  return validator(data);
}

export function getValidatorFactory(): ValidatorFactory {
  return globalValidatorFactory;
}
