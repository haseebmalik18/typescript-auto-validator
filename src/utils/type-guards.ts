/**
 * Type guard utilities for safer type assertions
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isFunction(value: unknown): value is (...args: any[]) => any {
  return typeof value === 'function';
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function assertIsObject(value: unknown): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(`Expected object, got ${typeof value}`);
  }
}

export function assertIsString(value: unknown): asserts value is string {
  if (!isString(value)) {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
}

export function assertIsNumber(value: unknown): asserts value is number {
  if (!isNumber(value)) {
    throw new TypeError(`Expected number, got ${typeof value}`);
  }
}

export function assertIsArray(value: unknown): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new TypeError(`Expected array, got ${typeof value}`);
  }
}