import { ValidationError } from "./error-handler.js";

/**
 * Validates intersection types (A & B)
 * For intersection types, the value must satisfy ALL types
 */
export function validateIntersection<T>(
  value: unknown,
  path: string,
  validators: ((val: unknown, intersectionPath: string) => unknown)[],
): T {
  const results: unknown[] = [];
  const errors: ValidationError[] = [];

  // All validators must pass for intersection type
  for (let i = 0; i < validators.length; i++) {
    try {
      const result = validators[i](value, path);
      results.push(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        errors.push(new ValidationError(String(error), path));
      }
    }
  }

  if (errors.length > 0) {
    const errorMessages = errors.map(
      (err, index) => `Type ${index + 1}: ${err.message}`,
    );
    const combinedMessage = `Value does not satisfy all intersection types:\n${errorMessages.join("\n")}`;

    throw new ValidationError(
      combinedMessage,
      path,
      "intersection type",
      typeof value,
      value,
    );
  }

  // For intersection types, we merge the results if they are objects
  if (results.length > 0 && results.every(r => typeof r === 'object' && r !== null && !Array.isArray(r))) {
    return Object.assign({}, ...results) as T;
  }

  // Otherwise, return the first result (they should all be equivalent)
  return results[0] as T;
}

/**
 * Validates branded/tagged types (common intersection pattern)
 * Example: string & { __brand: "Email" }
 */
export function validateBrandedType<T, TBrand extends string>(
  value: unknown,
  path: string,
  baseValidator: (val: unknown, basePath: string) => T,
  brandValidator: (val: T, brandPath: string) => boolean,
  brandName: TBrand,
): T & { __brand: TBrand } {
  // First validate the base type
  const baseResult = baseValidator(value, path);

  // Then validate the brand constraint
  if (!brandValidator(baseResult, path)) {
    throw ValidationError.create(
      path,
      `${typeof baseResult} satisfying ${brandName}`,
      `${typeof baseResult} not satisfying ${brandName}`,
      value,
    );
  }

  // Return the value with the brand (conceptually)
  return baseResult as T & { __brand: TBrand };
} 