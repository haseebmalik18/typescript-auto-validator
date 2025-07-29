import {
  TypeInfo,
  PropertyInfo,
  InterfaceInfo,
  ValidatorConfig,
  TransformerDefinition,
} from '../types.js';
import {
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateLiteral,
  validateNull,
  validateUndefined,
  validateAny,
  validateUnknown,
  validateNever,
} from './primitive-validator.js';
import {
  validateObject,
  validateProperty,
  validateObjectWithProperties,
  validateObjectWithPropertyInfo,
  validatePartialObject,
} from './object-validator.js';
import { validateArrayElements, validateTuple } from './array-validator.js';
import {
  validateUnion,
  validateLiteralUnion,
  validateDiscriminatedUnion,
} from './union-validator.js';
import { validateIntersection, validateBrandedType } from './intersection-validator.js';
import { ValidationError } from './error-handler.js';
import { TransformationEngine, getBuiltInTransformers } from './transformation-engine.js';
import { getAllAdvancedTransformers } from './advanced-transformers.js';

export type ValidatorFunction<T = unknown> = (
  value: unknown,
  path?: string,
  config?: ValidatorConfig
) => T;

export class ValidatorFactory {
  private validatorCache = new Map<string, ValidatorFunction>();
  private interfaceRegistry = new Map<string, InterfaceInfo>();
  private transformationEngine: TransformationEngine;
  private globalConfig: ValidatorConfig;

  constructor(config: ValidatorConfig = {}) {
    this.globalConfig = config;

    const allTransformers = {
      ...getBuiltInTransformers(),
      ...getAllAdvancedTransformers(),
      ...(config.transformers || {}),
    };

    this.transformationEngine = new TransformationEngine(
      allTransformers,
      config.transformationStrategy
    );
  }

  registerInterface(interfaceInfo: InterfaceInfo): void {
    this.interfaceRegistry.set(interfaceInfo.name, interfaceInfo);
  }

  registerInterfaces(interfaces: InterfaceInfo[]): void {
    for (const interfaceInfo of interfaces) {
      this.registerInterface(interfaceInfo);
    }
  }

  getInterface(name: string): InterfaceInfo | undefined {
    return this.interfaceRegistry.get(name);
  }

  /**
   * Register a custom transformer
   */
  registerTransformer(name: string, transformer: TransformerDefinition): void {
    this.transformationEngine.registerTransformer(name, transformer);
  }

  /**
   * Update global configuration
   */
  updateConfig(config: ValidatorConfig): void {
    this.globalConfig = { ...this.globalConfig, ...config };

    // Update transformation engine if transformers changed
    if (config.transformers || config.transformationStrategy) {
      const allTransformers = {
        ...getBuiltInTransformers(),
        ...getAllAdvancedTransformers(),
        ...this.globalConfig.transformers,
      };

      this.transformationEngine = new TransformationEngine(
        allTransformers,
        this.globalConfig.transformationStrategy
      );
    }
  }

  private isTypeAlias(interfaceInfo: InterfaceInfo): boolean {
    return interfaceInfo.properties.length === 1 && interfaceInfo.properties[0].name === 'value';
  }

  createValidator<T>(interfaceInfo: InterfaceInfo, config?: ValidatorConfig): ValidatorFunction<T> {
    this.registerInterface(interfaceInfo);

    const mergedConfig = { ...this.globalConfig, ...config };
    const cacheKey = `${interfaceInfo.name}-${JSON.stringify(mergedConfig)}`;

    if (this.validatorCache.has(cacheKey)) {
      return this.validatorCache.get(cacheKey) as ValidatorFunction<T>;
    }

    const validator = this.createValidatorForInterface<T>(interfaceInfo, mergedConfig);
    this.validatorCache.set(cacheKey, validator);

    return validator;
  }

  createValidatorWithRegistry<T>(
    targetInterface: InterfaceInfo,
    allInterfaces: InterfaceInfo[],
    config?: ValidatorConfig
  ): ValidatorFunction<T> {
    this.registerInterfaces(allInterfaces);
    return this.createValidator<T>(targetInterface, config);
  }

  private createValidatorForInterface<T>(
    interfaceInfo: InterfaceInfo,
    config: ValidatorConfig
  ): ValidatorFunction<T> {
    if (this.isTypeAlias(interfaceInfo)) {
      const valueProperty = interfaceInfo.properties[0];
      return (
        value: unknown,
        path: string = interfaceInfo.name,
        validatorConfig?: ValidatorConfig
      ): T => {
        const mergedConfig = { ...config, ...validatorConfig };
        return this.validateTypeInfo(value, valueProperty.type, path, mergedConfig) as T;
      };
    }

    return (
      value: unknown,
      path: string = interfaceInfo.name,
      validatorConfig?: ValidatorConfig
    ): T => {
      const mergedConfig = { ...config, ...validatorConfig };

      // Apply transformations first if enabled
      let processedValue = value;
      if (mergedConfig.autoTransform) {
        // Create a synthetic TypeInfo for the interface
        const interfaceTypeInfo: TypeInfo = {
          kind: 'object',
          nullable: false,
          properties: interfaceInfo.properties,
        };

        const transformResult = this.transformationEngine.transform(
          value,
          interfaceTypeInfo,
          path,
          mergedConfig
        );

        if (transformResult.success) {
          processedValue = transformResult.value;
        } else if (transformResult.error) {
          const strategy = mergedConfig.transformationStrategy?.onError || 'throw';
          if (strategy === 'throw') {
            throw transformResult.error;
          } else if (strategy === 'skip') {
            processedValue = value;
          }
        }
      }

      const obj = validateObject(processedValue, path);
      const result: Record<string, unknown> = {};

      for (const property of interfaceInfo.properties) {
        const propPath = `${path}.${property.name}`;
        const propValue = validateProperty(obj, property.name, path, property.optional);

        if (propValue !== undefined) {
          result[property.name] = this.validateTypeInfo(
            propValue,
            property.type,
            propPath,
            mergedConfig
          );
        } else if (!property.optional) {
          throw ValidationError.missing(propPath);
        }
      }

      return result as T;
    };
  }

  createTypeValidator<T>(typeInfo: TypeInfo, config?: ValidatorConfig): ValidatorFunction<T> {
    const mergedConfig = { ...this.globalConfig, ...config };

    return (value: unknown, path: string = 'value', validatorConfig?: ValidatorConfig): T => {
      const finalConfig = { ...mergedConfig, ...validatorConfig };
      return this.validateTypeInfo(value, typeInfo, path, finalConfig) as T;
    };
  }

  private validateTypeInfo(
    value: unknown,
    typeInfo: TypeInfo,
    path: string,
    config: ValidatorConfig
  ): unknown {
    // Apply transformations if enabled
    let processedValue = value;
    let skipValidation = false;

    if (config.autoTransform || typeInfo.transformations?.autoTransform) {
      const transformResult = this.transformationEngine.transform(value, typeInfo, path, config);

      if (transformResult.success) {
        processedValue = transformResult.value;
      } else if (transformResult.error) {
        const strategy = config.transformationStrategy?.onError || 'throw';
        if (strategy === 'throw') {
          throw transformResult.error;
        } else if (strategy === 'skip') {
          processedValue = value;
          skipValidation = true; // Skip validation when skipping transformation
        } else if (strategy === 'default') {
          processedValue = config.transformationStrategy?.defaultValue ?? value;
        }
      }
    }

    // If we're skipping validation, return the value as-is
    if (skipValidation) {
      return processedValue;
    }

    // Handle nullable types
    if (typeInfo.nullable && processedValue === null) {
      return null;
    }

    // Handle optional types (undefined is allowed)
    if (typeInfo.optional && processedValue === undefined) {
      return undefined;
    }

    switch (typeInfo.kind) {
      case 'string':
        return validateString(processedValue, path, typeInfo.constraints);

      case 'number':
        return validateNumber(processedValue, path, typeInfo.constraints);

      case 'boolean':
        return validateBoolean(processedValue, path);

      case 'date':
        return validateDate(processedValue, path);

      case 'null':
        return validateNull(processedValue, path);

      case 'undefined':
        return validateUndefined(processedValue, path);

      case 'any':
        return validateAny(processedValue, path);

      case 'unknown':
        return validateUnknown(processedValue, path);

      case 'never':
        return validateNever(processedValue, path);

      case 'literal':
        return validateLiteral(processedValue, typeInfo.value as string | number | boolean, path);

      case 'array':
        if (!typeInfo.elementType) {
          throw new Error(`Array type missing elementType at ${path}`);
        }
        return validateArrayElements(
          processedValue,
          path,
          (item, itemPath) =>
            this.validateTypeInfo(item, typeInfo.elementType as TypeInfo, itemPath, config),
          typeInfo.constraints
        );

      case 'tuple':
        if (!typeInfo.elementTypes) {
          throw new Error(`Tuple type missing elementTypes at ${path}`);
        }
        const tupleValidators = typeInfo.elementTypes.map(
          elementType => (item: unknown, itemPath: string) =>
            this.validateTypeInfo(item, elementType, itemPath, config)
        );
        return validateTuple(processedValue, path, tupleValidators);

      case 'object':
        if (!typeInfo.properties) {
          return validateObject(processedValue, path);
        }

        const propertyValidators: Record<string, (val: unknown, propPath: string) => unknown> = {};

        for (const prop of typeInfo.properties) {
          if (prop.optional) {
            propertyValidators[prop.name] = (val: unknown, propPath: string) => {
              if (val === undefined) return undefined;
              return this.validateTypeInfo(val, prop.type, propPath, config);
            };
          } else {
            propertyValidators[prop.name] = (val: unknown, propPath: string) => {
              return this.validateTypeInfo(val, prop.type, propPath, config);
            };
          }
        }

        return validateObjectWithProperties(processedValue, path, propertyValidators);

      case 'union':
        if (!typeInfo.types) {
          throw new Error(`Union type missing types at ${path}`);
        }

        // Optimize for literal unions
        const allLiterals = typeInfo.types.every(t => t.kind === 'literal');
        if (allLiterals) {
          const literalValues = typeInfo.types.map(t => t.value) as (string | number | boolean)[];
          return validateLiteralUnion(processedValue, path, literalValues);
        }

        const validators = typeInfo.types.map(
          unionType => (val: unknown, unionPath: string) =>
            this.validateTypeInfo(val, unionType, unionPath, config)
        );

        return validateUnion(processedValue, path, validators);

      case 'intersection':
        if (!typeInfo.types) {
          throw new Error(`Intersection type missing types at ${path}`);
        }

        const intersectionValidators = typeInfo.types.map(
          intersectionType => (val: unknown, intersectionPath: string) =>
            this.validateTypeInfo(val, intersectionType, intersectionPath, config)
        );

        return validateIntersection(processedValue, path, intersectionValidators);

      case 'reference':
        if (!typeInfo.name) {
          throw new Error(`Reference type missing name at ${path}`);
        }

        const referencedInterface = this.interfaceRegistry.get(typeInfo.name);
        if (!referencedInterface) {
          throw new Error(
            `Reference type '${typeInfo.name}' not found in registry at ${path}. ` +
              `Available types: [${Array.from(this.interfaceRegistry.keys()).join(', ')}]`
          );
        }

        if (this.isTypeAlias(referencedInterface)) {
          const valueProperty = referencedInterface.properties[0];
          return this.validateTypeInfo(processedValue, valueProperty.type, path, config);
        }

        const refValidator = this.createValidator(referencedInterface, config);
        return refValidator(processedValue, path, config);

      default:
        throw new Error(`Unknown type kind '${(typeInfo as TypeInfo).kind}' at ${path}`);
    }
  }

  clearCache(): void {
    this.validatorCache.clear();
  }

  clearRegistry(): void {
    this.interfaceRegistry.clear();
  }

  clear(): void {
    this.clearCache();
    this.clearRegistry();
  }
}
