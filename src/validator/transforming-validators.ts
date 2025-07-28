import { ValidationError } from "./error-handler.js";
import { ValidationConstraints, ValidatorConfig, TypeInfo, TransformationError } from "../types.js";
import { TransformationEngine } from "./transformation-engine.js";

/**
 * Enhanced string validator with transformation support
 */
export function validateStringWithTransform(
  value: unknown,
  path: string,
  constraints?: ValidationConstraints,
  config?: ValidatorConfig,
  typeInfo?: TypeInfo,
): string {
  let processedValue = value;

  // Apply transformations if enabled
  if (config?.autoTransform || typeInfo?.transformations?.autoTransform) {
    const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);
    const targetType: TypeInfo = {
      kind: "string",
      nullable: false,
      constraints,
      transformations: typeInfo?.transformations,
    };

    const result = engine.transform(value, targetType, path, config);
    
    if (result.success) {
      processedValue = result.value;
    } else if (result.error) {
      // Handle transformation error according to strategy
      if (config?.transformationStrategy?.onError === 'throw') {
        throw result.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw result.error;
      }
    }
  }

  // Validate the (potentially transformed) value
  if (typeof processedValue !== "string") {
    throw ValidationError.create(path, "string", typeof processedValue, processedValue);
  }

  // Apply string constraints
  if (constraints) {
    if (constraints.minLength !== undefined && processedValue.length < constraints.minLength) {
      throw ValidationError.create(
        path,
        `string with minimum length ${constraints.minLength}`,
        `string with length ${processedValue.length}`,
        processedValue
      );
    }

    if (constraints.maxLength !== undefined && processedValue.length > constraints.maxLength) {
      throw ValidationError.create(
        path,
        `string with maximum length ${constraints.maxLength}`,
        `string with length ${processedValue.length}`,
        processedValue
      );
    }

    if (constraints.pattern) {
      const regex = new RegExp(constraints.pattern);
      if (!regex.test(processedValue)) {
        throw ValidationError.create(
          path,
          `string matching pattern ${constraints.pattern}`,
          `string "${processedValue}"`,
          processedValue
        );
      }
    }
  }

  return processedValue;
}

/**
 * Enhanced number validator with transformation support
 */
export function validateNumberWithTransform(
  value: unknown,
  path: string,
  constraints?: ValidationConstraints,
  config?: ValidatorConfig,
  typeInfo?: TypeInfo,
): number {
  let processedValue = value;

  // Apply transformations if enabled
  if (config?.autoTransform || typeInfo?.transformations?.autoTransform) {
    const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);
    const targetType: TypeInfo = {
      kind: "number",
      nullable: false,
      constraints,
      transformations: typeInfo?.transformations,
    };

    const result = engine.transform(value, targetType, path, config);
    
    if (result.success) {
      processedValue = result.value;
    } else if (result.error) {
      if (config?.transformationStrategy?.onError === 'throw') {
        throw result.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw result.error;
      }
    }
  }

  // Validate the (potentially transformed) value
  if (typeof processedValue !== "number") {
    throw ValidationError.create(path, "number", typeof processedValue, processedValue);
  }
  
  if (isNaN(processedValue)) {
    throw ValidationError.create(path, "valid number", "NaN", processedValue);
  }

  // Apply numeric constraints
  if (constraints) {
    if (constraints.min !== undefined && processedValue < constraints.min) {
      throw ValidationError.create(
        path,
        `number >= ${constraints.min}`,
        `number ${processedValue}`,
        processedValue
      );
    }

    if (constraints.max !== undefined && processedValue > constraints.max) {
      throw ValidationError.create(
        path,
        `number <= ${constraints.max}`,
        `number ${processedValue}`,
        processedValue
      );
    }
  }

  return processedValue;
}

/**
 * Enhanced boolean validator with transformation support
 */
export function validateBooleanWithTransform(
  value: unknown,
  path: string,
  config?: ValidatorConfig,
  typeInfo?: TypeInfo,
): boolean {
  let processedValue = value;

  // Apply transformations if enabled
  if (config?.autoTransform || typeInfo?.transformations?.autoTransform) {
    const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);
    const targetType: TypeInfo = {
      kind: "boolean",
      nullable: false,
      transformations: typeInfo?.transformations,
    };

    const result = engine.transform(value, targetType, path, config);
    
    if (result.success) {
      processedValue = result.value;
    } else if (result.error) {
      if (config?.transformationStrategy?.onError === 'throw') {
        throw result.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw result.error;
      }
    }
  }

  // Validate the (potentially transformed) value
  if (typeof processedValue !== "boolean") {
    throw ValidationError.create(path, "boolean", typeof processedValue, processedValue);
  }

  return processedValue;
}

/**
 * Enhanced date validator with transformation support
 */
export function validateDateWithTransform(
  value: unknown,
  path: string,
  config?: ValidatorConfig,
  typeInfo?: TypeInfo,
): Date {
  let processedValue = value;

  // Apply transformations if enabled
  if (config?.autoTransform || typeInfo?.transformations?.autoTransform) {
    const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);
    const targetType: TypeInfo = {
      kind: "date",
      nullable: false,
      transformations: typeInfo?.transformations,
    };

    const result = engine.transform(value, targetType, path, config);
    
    if (result.success) {
      processedValue = result.value;
    } else if (result.error) {
      if (config?.transformationStrategy?.onError === 'throw') {
        throw result.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw result.error;
      }
    }
  }

  // Validate the (potentially transformed) value
  if (!(processedValue instanceof Date)) {
    throw ValidationError.create(path, "Date", typeof processedValue, processedValue);
  }
  
  if (isNaN(processedValue.getTime())) {
    throw ValidationError.create(path, "valid Date", "Invalid Date", processedValue);
  }

  return processedValue;
}

/**
 * Enhanced array validator with transformation support
 */
export function validateArrayWithTransform<T>(
  value: unknown,
  path: string,
  elementValidator: (val: unknown, elemPath: string, config?: ValidatorConfig) => T,
  constraints?: ValidationConstraints,
  config?: ValidatorConfig,
  typeInfo?: TypeInfo,
): T[] {
  let processedValue = value;

  // Apply transformations if enabled
  if (config?.autoTransform || typeInfo?.transformations?.autoTransform) {
    const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);
    const targetType: TypeInfo = {
      kind: "array",
      nullable: false,
      constraints,
      transformations: typeInfo?.transformations,
      elementType: typeInfo?.elementType,
    };

    const result = engine.transform(value, targetType, path, config);
    
    if (result.success) {
      processedValue = result.value;
    } else if (result.error) {
      if (config?.transformationStrategy?.onError === 'throw') {
        throw result.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw result.error;
      }
    }
  }

  // Validate the (potentially transformed) value
  if (!Array.isArray(processedValue)) {
    throw ValidationError.create(path, "array", typeof processedValue, processedValue);
  }

  // Apply array constraints
  if (constraints) {
    if (constraints.minLength !== undefined && processedValue.length < constraints.minLength) {
      throw ValidationError.create(
        path,
        `array with minimum length ${constraints.minLength}`,
        `array with length ${processedValue.length}`,
        processedValue
      );
    }

    if (constraints.maxLength !== undefined && processedValue.length > constraints.maxLength) {
      throw ValidationError.create(
        path,
        `array with maximum length ${constraints.maxLength}`,
        `array with length ${processedValue.length}`,
        processedValue
      );
    }
  }

  // Validate elements
  return processedValue.map((item, index) => {
    const elementPath = `${path}[${index}]`;
    return elementValidator(item, elementPath, config);
  });
}

/**
 * Create a transforming validator factory
 */
export function createTransformingValidator<T>(
  targetType: TypeInfo,
  config?: ValidatorConfig,
): (value: unknown, path?: string) => T {
  const engine = new TransformationEngine(config?.transformers, config?.transformationStrategy);

  return (value: unknown, path: string = "value"): T => {
    // First apply transformations
    const transformResult = engine.transform(value, targetType, path, config);
    
    let processedValue: unknown;
    if (transformResult.success) {
      processedValue = transformResult.value;
    } else if (transformResult.error) {
      if (config?.transformationStrategy?.onError === 'throw') {
        throw transformResult.error;
      } else if (config?.transformationStrategy?.onError === 'skip') {
        processedValue = value;
      } else {
        throw transformResult.error;
      }
    } else {
      processedValue = value;
    }

    // Then validate the transformed value
    return validateTransformedValue<T>(processedValue, targetType, path, config);
  };
}

/**
 * Validate a value that has already been transformed
 */
function validateTransformedValue<T>(
  value: unknown,
  typeInfo: TypeInfo,
  path: string,
  _config?: ValidatorConfig,
): T {
  // Basic type validation - this would integrate with existing validators
  switch (typeInfo.kind) {
    case "string":
      if (typeof value !== "string") {
        throw ValidationError.create(path, "string", typeof value, value);
      }
      return value as T;

    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        throw ValidationError.create(path, "number", typeof value, value);
      }
      return value as T;

    case "boolean":
      if (typeof value !== "boolean") {
        throw ValidationError.create(path, "boolean", typeof value, value);
      }
      return value as T;

    case "date":
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        throw ValidationError.create(path, "Date", typeof value, value);
      }
      return value as T;

    case "array":
      if (!Array.isArray(value)) {
        throw ValidationError.create(path, "array", typeof value, value);
      }
      return value as T;

    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw ValidationError.create(path, "object", typeof value, value);
      }
      return value as T;

    default:
      return value as T;
  }
} 