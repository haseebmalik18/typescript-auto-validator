import { ValidationError } from "./error-handler.js";
import { ValidationConstraints } from "../types.js";

export function validateString(value: unknown, path: string, constraints?: ValidationConstraints): string {
  if (typeof value !== "string") {
    throw ValidationError.create(path, "string", typeof value, value);
  }

  if (constraints) {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      throw ValidationError.create(
        path,
        `string with minimum length ${constraints.minLength}`,
        `string with length ${value.length}`,
        value
      );
    }

    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      throw ValidationError.create(
        path,
        `string with maximum length ${constraints.maxLength}`,
        `string with length ${value.length}`,
        value
      );
    }

    if (constraints.pattern) {
      const regex = new RegExp(constraints.pattern);
      if (!regex.test(value)) {
        throw ValidationError.create(
          path,
          `string matching pattern ${constraints.pattern}`,
          `string "${value}"`,
          value
        );
      }
    }
  }

  return value;
}

export function validateNumber(value: unknown, path: string, constraints?: ValidationConstraints): number {
  if (typeof value !== "number") {
    throw ValidationError.create(path, "number", typeof value, value);
  }
  if (isNaN(value)) {
    throw ValidationError.create(path, "valid number", "NaN", value);
  }

  if (constraints) {
    if (constraints.min !== undefined && value < constraints.min) {
      throw ValidationError.create(
        path,
        `number >= ${constraints.min}`,
        `number ${value}`,
        value
      );
    }

    if (constraints.max !== undefined && value > constraints.max) {
      throw ValidationError.create(
        path,
        `number <= ${constraints.max}`,
        `number ${value}`,
        value
      );
    }
  }

  return value;
}

export function validateBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw ValidationError.create(path, "boolean", typeof value, value);
  }
  return value;
}

export function validateDate(value: unknown, path: string): Date {
  if (!(value instanceof Date)) {
    throw ValidationError.create(path, "Date", typeof value, value);
  }
  if (isNaN(value.getTime())) {
    throw ValidationError.create(path, "valid Date", "Invalid Date", value);
  }
  return value;
}

export function validateLiteral<T extends string | number | boolean>(
  value: unknown,
  expectedValue: T,
  path: string,
): T {
  if (value !== expectedValue) {
    throw ValidationError.create(
      path,
      String(expectedValue),
      String(value),
      value,
    );
  }
  return value as T;
}

export function validateNull(value: unknown, path: string): null {
  if (value !== null) {
    throw ValidationError.create(path, "null", typeof value, value);
  }
  return value;
}

export function validateUndefined(value: unknown, path: string): undefined {
  if (value !== undefined) {
    throw ValidationError.create(path, "undefined", typeof value, value);
  }
  return value;
}

export function validateAny(value: unknown, _path: string): unknown {
  // Any type accepts all values
  return value;
}

export function validateUnknown(value: unknown, _path: string): unknown {
  // Unknown type accepts all values but should be handled carefully
  return value;
}

export function validateNever(value: unknown, path: string): never {
  // Never type should never have a value
  throw ValidationError.create(path, "never (no value should reach this)", typeof value, value);
}
