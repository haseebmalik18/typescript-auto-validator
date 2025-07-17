import { ValidationError } from "./error-handler.js";

export function validateUnion<T>(
  value: unknown,
  path: string,
  validators: ((val: unknown, unionPath: string) => unknown)[],
): T {
  const errors: ValidationError[] = [];
  let bestMatch: { result: unknown; score: number } | null = null;

  for (let i = 0; i < validators.length; i++) {
    try {
      const result = validators[i](value, path);
      return result as T;
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
        
        // Score errors to provide better error messages
        // Lower path depth = better match
        const score = error.path ? error.path.split('.').length : 100;
        if (!bestMatch || score < bestMatch.score) {
          bestMatch = { result: error, score };
        }
      } else {
        errors.push(new ValidationError(String(error), path));
      }
    }
  }

  // Enhanced error message with best match information
  const errorMessages = errors.map(
    (err, index) => `  ${index + 1}. ${err.message}`,
  );
  
  let combinedMessage = `Value does not match any union type at ${path}:`;
  combinedMessage += `\n${errorMessages.join("\n")}`;
  
  if (bestMatch && bestMatch.result instanceof ValidationError) {
    combinedMessage += `\n\nClosest match was option with error: ${bestMatch.result.message}`;
  }

  throw new ValidationError(
    combinedMessage,
    path,
    "union type",
    typeof value,
    value,
  );
}

export function validateLiteralUnion<T extends string | number | boolean>(
  value: unknown,
  path: string,
  allowedValues: readonly T[],
): T {
  if (!allowedValues.includes(value as T)) {
    const sortedValues = [...allowedValues].sort();
    throw ValidationError.create(
      path,
      `one of: ${sortedValues.map((v) => JSON.stringify(v)).join(", ")}`,
      JSON.stringify(value),
      value,
    );
  }
  return value as T;
}

/**
 * Validates discriminated unions based on a discriminant property
 * More efficient than regular union validation when a discriminant is available
 */
export function validateDiscriminatedUnion<T>(
  value: unknown,
  path: string,
  discriminantKey: string,
  typeMap: Map<string | number | boolean, (val: unknown, unionPath: string) => unknown>,
): T {
  if (typeof value !== 'object' || value === null) {
    throw ValidationError.create(
      path,
      "object with discriminant property",
      typeof value,
      value,
    );
  }

  const obj = value as Record<string, unknown>;
  const discriminantValue = obj[discriminantKey];

  if (discriminantValue === undefined) {
    throw ValidationError.create(
      `${path}.${discriminantKey}`,
      "discriminant property",
      "undefined",
      value,
    );
  }

  const validator = typeMap.get(discriminantValue as string | number | boolean);
  if (!validator) {
    const availableTypes = Array.from(typeMap.keys())
      .map(key => JSON.stringify(key))
      .join(", ");
    
    throw ValidationError.create(
      `${path}.${discriminantKey}`,
      `one of: ${availableTypes}`,
      JSON.stringify(discriminantValue),
      value,
    );
  }

  return validator(value, path) as T;
}
