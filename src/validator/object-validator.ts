import { ValidationError } from "./error-handler.js";
import { PropertyInfo } from "../types.js";

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
  strictNullChecks: boolean = true,
): T {
  const obj = validateObject(value, path);
  const result: Record<string, unknown> = {};

  // Validate known properties
  for (const [propName, validator] of Object.entries(propertyValidators)) {
    const propPath = `${path}.${propName}`;

    if (obj[propName] !== undefined) {
      result[propName] = validator(obj[propName], propPath);
    } else if (strictNullChecks && Object.prototype.hasOwnProperty.call(obj, propName) && obj[propName] === null) {
      // Handle explicit null values when strict null checks are enabled
      result[propName] = validator(obj[propName], propPath);
    }
  }

  // Handle unknown properties
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
  } else {
    // Include unknown properties if allowed
    const knownProps = new Set(Object.keys(propertyValidators));
    for (const [key, val] of Object.entries(obj)) {
      if (!knownProps.has(key)) {
        result[key] = val;
      }
    }
  }

  return result as T;
}

/**
 * Validates an object with detailed property information including readonly checks
 */
export function validateObjectWithPropertyInfo<T>(
  value: unknown,
  path: string,
  properties: PropertyInfo[],
  propertyValidators: Record<string, (val: unknown, propPath: string) => unknown>,
  allowUnknownProperties: boolean = false,
): T {
  const obj = validateObject(value, path);
  const result: Record<string, unknown> = {};

  // Validate each property with its metadata
  for (const property of properties) {
    const propPath = `${path}.${property.name}`;
    const validator = propertyValidators[property.name];

    if (!validator) {
      throw new Error(`No validator found for property ${property.name}`);
    }

    const propValue = validateProperty(
      obj,
      property.name,
      path,
      property.optional,
    );

    if (propValue !== undefined) {
      result[property.name] = validator(propValue, propPath);
    } else if (!property.optional) {
      throw ValidationError.missing(propPath);
    }
  }

  // Handle unknown properties
  if (!allowUnknownProperties) {
    const knownProps = new Set(properties.map(p => p.name));
    const unknownProps = Object.keys(obj).filter((key) => !knownProps.has(key));

    if (unknownProps.length > 0) {
      throw ValidationError.create(
        path,
        `object with known properties: ${properties.map(p => p.name).join(", ")}`,
        `object with unknown properties: ${unknownProps.join(", ")}`,
        value,
      );
    }
  }

  return result as T;
}

/**
 * Validates partial objects (all properties optional)
 */
export function validatePartialObject<T>(
  value: unknown,
  path: string,
  propertyValidators: Record<
    string,
    (val: unknown, propPath: string) => unknown
  >,
  allowUnknownProperties: boolean = false,
): Partial<T> {
  const obj = validateObject(value, path);
  const result: Record<string, unknown> = {};

  // All properties are optional in partial validation
  for (const [propName, validator] of Object.entries(propertyValidators)) {
    const propPath = `${path}.${propName}`;

    if (obj[propName] !== undefined) {
      result[propName] = validator(obj[propName], propPath);
    }
  }

  // Handle unknown properties
  if (!allowUnknownProperties) {
    const knownProps = new Set(Object.keys(propertyValidators));
    const unknownProps = Object.keys(obj).filter((key) => !knownProps.has(key));

    if (unknownProps.length > 0) {
      throw ValidationError.create(
        path,
        `partial object with known properties`,
        `object with unknown properties: ${unknownProps.join(", ")}`,
        value,
      );
    }
  }

  return result as Partial<T>;
}
