import {
  TransformerRegistry,
  TransformerDefinition,
  TransformationResult,
  TransformationContext,
  TransformationError,
  TransformationStrategy,
  TypeInfo,
  ValidatorConfig,
} from "../types.js";

/**
 * Core transformation engine for automatic type coercion and custom transformations
 */
export class TransformationEngine {
  private transformers: TransformerRegistry;
  private defaultStrategy: TransformationStrategy;

  constructor(
    transformers: TransformerRegistry = {},
    strategy?: TransformationStrategy,
  ) {
    this.transformers = { ...getBuiltInTransformers(), ...transformers };
    this.defaultStrategy = strategy || getDefaultTransformationStrategy();
  }

  /**
   * Transform a value according to type information and configuration
   */
  transform<T = unknown>(
    value: unknown,
    typeInfo: TypeInfo,
    path: string,
    config: ValidatorConfig = {},
    depth: number = 0,
  ): TransformationResult<T> {
    const context: TransformationContext = {
      path,
      sourceValue: value,
      typeInfo,
      config,
      depth,
    };

    // Check transformation depth to prevent infinite loops
    const maxDepth = config.transformationStrategy?.maxDepth || this.defaultStrategy.maxDepth || 10;
    if (depth > maxDepth) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Maximum transformation depth exceeded at ${path}`,
          path,
          value,
          typeInfo.kind,
        ),
        appliedTransformations: [],
      };
    }

    // Skip transformation if not enabled
    if (!config.autoTransform && !typeInfo.transformations?.autoTransform) {
      return {
        success: true,
        value: value as T,
        originalValue: value,
        appliedTransformations: [],
      };
    }

    // Handle null and undefined values early - these should be handled by type validation, not transformation
    if (value === null || value === undefined) {
      return {
        success: true,
        value: value as T,
        originalValue: value,
        appliedTransformations: [],
      };
    }

    try {
      return this.applyTransformations<T>(value, typeInfo, context);
    } catch (error) {
      return this.handleTransformationError<T>(error, context);
    }
  }

  /**
   * Register a custom transformer
   */
  registerTransformer(name: string, transformer: TransformerDefinition): void {
    this.transformers[name] = transformer;
  }

  /**
   * Get available transformers for a specific source type
   */
  getTransformersForType(sourceType: string): TransformerDefinition[] {
    return Object.values(this.transformers).filter(
      (transformer) => transformer.sourceTypes.includes(sourceType) || 
                     transformer.sourceTypes.includes('*')
    );
  }

  /**
   * Apply transformations according to type information
   */
  private applyTransformations<T>(
    value: unknown,
    typeInfo: TypeInfo,
    context: TransformationContext,
  ): TransformationResult<T> {
    const appliedTransformations: string[] = [];
    let currentValue = value;

    // Apply pre-transformations if specified
    if (typeInfo.transformations?.preTransform) {
      const preResult = this.applyTransformationRules(
        currentValue,
        typeInfo.transformations.preTransform,
        context,
      );
      currentValue = preResult.value;
      appliedTransformations.push(...preResult.appliedTransformations);
    }

    // Apply automatic type coercion
    const coercionResult = this.applyAutomaticCoercion(currentValue, typeInfo, context);
    if (coercionResult.success) {
      currentValue = coercionResult.value;
      appliedTransformations.push(...coercionResult.appliedTransformations);
    } else {
      // Return the coercion failure immediately
      return {
        success: false,
        originalValue: value,
        error: coercionResult.error,
        appliedTransformations,
      };
    }

    // Apply custom transformer if specified
    if (typeInfo.transformations?.transformer) {
      const customResult = this.applyCustomTransformer(
        currentValue,
        typeInfo.transformations.transformer,
        context,
      );
      if (customResult.success) {
        currentValue = customResult.value;
        appliedTransformations.push(...customResult.appliedTransformations);
      } else {
        // Return the custom transformation failure
        return {
          success: false,
          originalValue: value,
          error: customResult.error,
          appliedTransformations,
        };
      }
    }

    // Apply post-transformations if specified
    if (typeInfo.transformations?.postTransform) {
      const postResult = this.applyTransformationRules(
        currentValue,
        typeInfo.transformations.postTransform,
        context,
      );
      currentValue = postResult.value;
      appliedTransformations.push(...postResult.appliedTransformations);
    }

    return {
      success: true,
      value: currentValue as T,
      originalValue: value,
      appliedTransformations,
    };
  }

  /**
   * Apply automatic type coercion based on target type
   */
  private applyAutomaticCoercion(
    value: unknown,
    typeInfo: TypeInfo,
    context: TransformationContext,
  ): TransformationResult {
    const sourceType = typeof value;
    const targetType = typeInfo.kind;

    // No transformation needed if types already match
    if (this.typesMatch(sourceType, targetType, value)) {
      return {
        success: true,
        value,
        originalValue: value,
        appliedTransformations: [],
      };
    }

    // Find appropriate transformer
    const transformers = this.getTransformersForType(sourceType);
    const targetTransformer = transformers.find(
      (t) => t.targetType === targetType
    );

    if (!targetTransformer) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `No transformer found for ${sourceType} -> ${targetType}`,
          context.path,
          value,
          targetType,
        ),
        appliedTransformations: [],
      };
    }

    // Check if transformation is applicable
    if (targetTransformer.canTransform && !targetTransformer.canTransform(value)) {
      return {
        success: false,
        originalValue: value,
        error: TransformationError.invalidInput(
          context.path,
          value,
          targetType,
        ),
        appliedTransformations: [],
      };
    }

    try {
      const transformedValue = targetTransformer.transform(value);
      return {
        success: true,
        value: transformedValue,
        originalValue: value,
        appliedTransformations: [`auto-coerce-${sourceType}-to-${targetType}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: TransformationError.create(
          context.path,
          value,
          targetType,
          `auto-coerce-${sourceType}-to-${targetType}`,
          error instanceof Error ? error : undefined,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply custom transformer by name
   */
  private applyCustomTransformer(
    value: unknown,
    transformerName: string,
    context: TransformationContext,
  ): TransformationResult {
    const transformer = this.transformers[transformerName];
    if (!transformer) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Custom transformer '${transformerName}' not found`,
          context.path,
          value,
          undefined,
          transformerName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      const transformedValue = transformer.transform(value);
      return {
        success: true,
        value: transformedValue,
        originalValue: value,
        appliedTransformations: [transformerName],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: TransformationError.create(
          context.path,
          value,
          transformer.targetType,
          transformerName,
          error instanceof Error ? error : undefined,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply transformation rules
   */
  private applyTransformationRules(
    value: unknown,
    rules: any[],
    context: TransformationContext,
  ): TransformationResult {
    // Implementation for transformation rules would go here
    // For now, return the value unchanged
    return {
      success: true,
      value,
      originalValue: value,
      appliedTransformations: [],
    };
  }

  /**
   * Handle transformation errors according to strategy
   */
  private handleTransformationError<T>(
    error: unknown,
    context: TransformationContext,
  ): TransformationResult<T> {
    const strategy = context.config.transformationStrategy || this.defaultStrategy;
    const transformationError = error instanceof TransformationError 
      ? error 
      : new TransformationError(String(error), context.path, context.sourceValue);

    switch (strategy.onError) {
      case 'throw':
        throw transformationError;

      case 'skip':
        return {
          success: true,
          value: context.sourceValue as T,
          originalValue: context.sourceValue,
          appliedTransformations: [],
        };

      case 'default':
        return {
          success: true,
          value: (strategy.defaultValue ?? context.sourceValue) as T,
          originalValue: context.sourceValue,
          appliedTransformations: ['default-fallback'],
        };

      case 'custom':
        if (strategy.customErrorHandler) {
          try {
            const fallbackValue = strategy.customErrorHandler(transformationError);
            return {
              success: true,
              value: fallbackValue as T,
              originalValue: context.sourceValue,
              appliedTransformations: ['custom-error-handler'],
            };
          } catch (handlerError) {
            throw transformationError;
          }
        }
        throw transformationError;

      default:
        throw transformationError;
    }
  }

  /**
   * Check if source and target types match
   */
  private typesMatch(sourceType: string, targetType: string, value: unknown): boolean {
    if (sourceType === targetType) return true;
    
    // Special cases
    if (targetType === 'date' && value instanceof Date) return true;
    if (targetType === 'array' && Array.isArray(value)) return true;
    if (targetType === 'null' && value === null) return true;
    if (targetType === 'undefined' && value === undefined) return true;
    
    return false;
  }
}

/**
 * Get built-in transformers for common type coercions
 */
export function getBuiltInTransformers(): TransformerRegistry {
  return {
    'string-to-number': {
      sourceTypes: ['string'],
      targetType: 'number',
      canTransform: (value) => typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '',
      transform: (value) => {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        return num;
      },
      metadata: {
        description: 'Converts string to number',
        examples: [
          { input: '123', output: 123 },
          { input: '45.67', output: 45.67 },
        ],
      },
    },

    'string-to-boolean': {
      sourceTypes: ['string'],
      targetType: 'boolean',
      canTransform: (value) => typeof value === 'string',
      transform: (value) => {
        const str = (value as string).toLowerCase().trim();
        if (['true', '1', 'yes', 'on'].includes(str)) return true;
        if (['false', '0', 'no', 'off', ''].includes(str)) return false;
        throw new Error(`Cannot convert "${value}" to boolean`);
      },
      metadata: {
        description: 'Converts string to boolean',
        examples: [
          { input: 'true', output: true },
          { input: 'false', output: false },
          { input: '1', output: true },
          { input: '0', output: false },
        ],
      },
    },

    'string-to-date': {
      sourceTypes: ['string'],
      targetType: 'date',
      canTransform: (value) => typeof value === 'string' && !isNaN(Date.parse(value)),
      transform: (value) => {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          throw new Error(`Cannot convert "${value}" to Date`);
        }
        return date;
      },
      metadata: {
        description: 'Converts string to Date',
        examples: [
          { input: '2023-01-01', output: new Date('2023-01-01') },
          { input: '2023-01-01T12:00:00Z', output: new Date('2023-01-01T12:00:00Z') },
        ],
      },
    },

    'number-to-string': {
      sourceTypes: ['number'],
      targetType: 'string',
      canTransform: (value) => typeof value === 'number',
      transform: (value) => String(value),
      metadata: {
        description: 'Converts number to string',
        examples: [
          { input: 123, output: '123' },
          { input: 45.67, output: '45.67' },
        ],
      },
    },

    'boolean-to-string': {
      sourceTypes: ['boolean'],
      targetType: 'string',
      canTransform: (value) => typeof value === 'boolean',
      transform: (value) => String(value),
      metadata: {
        description: 'Converts boolean to string',
        examples: [
          { input: true, output: 'true' },
          { input: false, output: 'false' },
        ],
      },
    },

    'number-to-boolean': {
      sourceTypes: ['number'],
      targetType: 'boolean',
      canTransform: (value) => typeof value === 'number',
      transform: (value) => Boolean(value),
      metadata: {
        description: 'Converts number to boolean (0 = false, non-zero = true)',
        examples: [
          { input: 0, output: false },
          { input: 1, output: true },
          { input: -1, output: true },
        ],
      },
    },

    'date-to-string': {
      sourceTypes: ['object'],
      targetType: 'string',
      canTransform: (value) => value instanceof Date,
      transform: (value) => (value as Date).toISOString(),
      metadata: {
        description: 'Converts Date to ISO string',
        examples: [
          { input: new Date('2023-01-01'), output: '2023-01-01T00:00:00.000Z' },
        ],
      },
    },

    'array-to-string': {
      sourceTypes: ['object'],
      targetType: 'string',
      canTransform: (value) => Array.isArray(value),
      transform: (value) => JSON.stringify(value),
      metadata: {
        description: 'Converts array to JSON string',
        examples: [
          { input: [1, 2, 3], output: '[1,2,3]' },
        ],
      },
    },

    'object-to-string': {
      sourceTypes: ['object'],
      targetType: 'string',
      canTransform: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
      transform: (value) => JSON.stringify(value),
      metadata: {
        description: 'Converts object to JSON string',
        examples: [
          { input: { a: 1 }, output: '{"a":1}' },
        ],
      },
    },
  };
}

/**
 * Get default transformation strategy
 */
export function getDefaultTransformationStrategy(): TransformationStrategy {
  return {
    onError: 'throw',
    allowChaining: false,
    maxDepth: 10,
  };
} 