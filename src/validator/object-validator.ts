import { ValidationError } from "./error-handler.js";

export function validateObject(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw ValidationError.create(path, "object", typeof value, value);
  }
  return value as Record<string, unknown>;
}

export function validateProperty(
  obj: Record<string, unknown>,
  propertyName: string,
  path: string,
  optional: boolean = false,
): unknown {
  if (obj[propertyName] === undefined) {
    if (!optional) {
      throw ValidationError.missing(`${path}.${propertyName}`);
    }
    return undefined;
  }
  return obj[propertyName];
}

export function validateObjectWithProperties<T>(
  value: unknown,
  path: string,
  propertyValidators: Record<
    string,
    (val: unknown, propPath: string) => unknown
  >,
  allowUnknownProperties: boolean = false,
): T {
  const obj = validateObject(value, path);
  const result: Record<string, unknown> = {};

  for (const [propName, validator] of Object.entries(propertyValidators)) {
    const propPath = `${path}.${propName}`;

    if (obj[propName] !== undefined) {
      result[propName] = validator(obj[propName], propPath);
    }
  }

  if (!allowUnknownProperties) {
    const knownProps = new Set(Object.keys(propertyValidators));
    const unknownProps = Object.keys(obj).filter((key) => !knownProps.has(key));

    if (unknownProps.length > 0) {
      throw ValidationError.create(
        path,
        `object with known properties`,
        `object with unknown properties: ${unknownProps.join(", ")}`,
        value,
      );
    }
  }

  return result as T;
}
