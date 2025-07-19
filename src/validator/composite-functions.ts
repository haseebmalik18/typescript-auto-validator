import { InterfaceInfo, ValidatorConfig, TypeInfo } from "../types.js";
import { ValidatorFactory } from "./validator-factory.js";
import { TransformationEngine } from "./transformation-engine.js";

// Global validator configuration
let globalConfig: ValidatorConfig = {};

/**
 * Configure global validator settings
 */
export function configureValidator(config: ValidatorConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current global validator configuration
 */
export function getValidatorConfig(): ValidatorConfig {
  return { ...globalConfig };
}

/**
 * Validate data with automatic transformations
 */
export function validateWithTransform<T>(
  data: unknown,
  interfaceInfo: InterfaceInfo,
  config?: ValidatorConfig
): T {
  const mergedConfig = { ...globalConfig, autoTransform: true, ...config };
  const factory = new ValidatorFactory(mergedConfig);
  const validator = factory.createValidator<T>(interfaceInfo, mergedConfig);
  return validator(data);
}

/**
 * Create a transforming validator for a specific type
 */
export function createTransformingValidatorForType<T>(
  typeInfo: TypeInfo,
  config?: ValidatorConfig
): (value: unknown) => T {
  const mergedConfig = { ...globalConfig, autoTransform: true, ...config };
  const factory = new ValidatorFactory(mergedConfig);
  return factory.createTypeValidator<T>(typeInfo, mergedConfig);
}

/**
 * Register a transformer globally
 */
export function registerTransformer(
  name: string,
  transformer: any
): void {
  if (!globalConfig.transformers) {
    globalConfig.transformers = {};
  }
  globalConfig.transformers[name] = transformer;
} 