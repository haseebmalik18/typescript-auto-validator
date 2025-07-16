import { ValidationError } from "./error-handler.js";

export function validateString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw ValidationError.create(path, "string", typeof value, value);
  }
  return value;
}

export function validateNumber(value: unknown, path: string): number {
  if (typeof value !== "number") {
    throw ValidationError.create(path, "number", typeof value, value);
  }
  if (isNaN(value)) {
    throw ValidationError.create(path, "valid number", "NaN", value);
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
