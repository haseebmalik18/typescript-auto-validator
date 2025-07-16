import { ValidationError } from "./error-handler.js";

export function validateUnion<T>(
  value: unknown,
  path: string,
  validators: ((val: unknown, unionPath: string) => unknown)[],
): T {
  const errors: ValidationError[] = [];

  for (let i = 0; i < validators.length; i++) {
    try {
      return validators[i](value, path) as T;
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      } else {
        errors.push(new ValidationError(String(error), path));
      }
    }
  }

  const errorMessages = errors.map(
    (err, index) => `Option ${index + 1}: ${err.message}`,
  );
  const combinedMessage = `Value does not match any union type:\n${errorMessages.join("\n")}`;

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
    throw ValidationError.create(
      path,
      `one of: ${allowedValues.map((v) => JSON.stringify(v)).join(", ")}`,
      JSON.stringify(value),
      value,
    );
  }
  return value as T;
}
