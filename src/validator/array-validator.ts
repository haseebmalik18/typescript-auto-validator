import { ValidationError } from "./error-handler.js";
import { ValidationConstraints } from "../types.js";

export function validateArray(value: unknown, path: string, constraints?: ValidationConstraints): unknown[] {
  if (!Array.isArray(value)) {
    throw ValidationError.create(path, "array", typeof value, value);
  }

  // Apply array constraints
  if (constraints) {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      throw ValidationError.create(
        path,
        `array with minimum length ${constraints.minLength}`,
        `array with length ${value.length}`,
        value
      );
    }

    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      throw ValidationError.create(
        path,
        `array with maximum length ${constraints.maxLength}`,
        `array with length ${value.length}`,
        value
      );
    }
  }

  return value;
}

export function validateArrayElements<T>(
  value: unknown,
  path: string,
  elementValidator: (val: unknown, elemPath: string) => T,
  constraints?: ValidationConstraints,
): T[] {
  const array = validateArray(value, path, constraints);

  return array.map((item, index) => {
    const elementPath = `${path}[${index}]`;
    return elementValidator(item, elementPath);
  });
}

export function validateTuple<T extends readonly unknown[]>(
  value: unknown,
  path: string,
  elementValidators: readonly ((val: unknown, elemPath: string) => unknown)[],
  allowExtraElements: boolean = false,
): T {
  const array = validateArray(value, path);

  if (!allowExtraElements && array.length !== elementValidators.length) {
    throw ValidationError.create(
      path,
      `tuple with exactly ${elementValidators.length} elements`,
      `array with ${array.length} elements`,
      value,
    );
  }

  if (array.length < elementValidators.length) {
    throw ValidationError.create(
      path,
      `tuple with at least ${elementValidators.length} elements`,
      `array with ${array.length} elements`,
      value,
    );
  }

  const result = array.map((item, index) => {
    const elementPath = `${path}[${index}]`;
    if (index < elementValidators.length) {
      return elementValidators[index](item, elementPath);
    } else if (allowExtraElements) {
      // For rest elements, use the last validator
      const lastValidator = elementValidators[elementValidators.length - 1];
      return lastValidator(item, elementPath);
    }
    return item;
  }) as unknown as T;

  return result;
}
