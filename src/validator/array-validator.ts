import { ValidationError } from "./error-handler.js";

export function validateArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw ValidationError.create(path, "array", typeof value, value);
  }
  return value;
}

export function validateArrayElements<T>(
  value: unknown,
  path: string,
  elementValidator: (val: unknown, elemPath: string) => T,
): T[] {
  const array = validateArray(value, path);

  return array.map((item, index) => {
    const elementPath = `${path}[${index}]`;
    return elementValidator(item, elementPath);
  });
}

export function validateTuple<T extends readonly unknown[]>(
  value: unknown,
  path: string,
  elementValidators: readonly ((val: unknown, elemPath: string) => unknown)[],
): T {
  const array = validateArray(value, path);

  if (array.length !== elementValidators.length) {
    throw ValidationError.create(
      path,
      `tuple with ${elementValidators.length} elements`,
      `array with ${array.length} elements`,
      value,
    );
  }

  const result = array.map((item, index) => {
    const elementPath = `${path}[${index}]`;
    return elementValidators[index](item, elementPath);
  }) as unknown as T;

  return result;
}
