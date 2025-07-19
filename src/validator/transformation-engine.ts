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
    const appliedTransformations: string[] = [];
    let currentValue = value;
    const originalValue = value;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      
      // Check if rule condition is met
      if (!this.shouldApplyRule(currentValue, rule, context)) {
        continue;
      }

      try {
        const ruleResult = this.applyTransformationRule(currentValue, rule, context);
        
        if (ruleResult.success) {
          currentValue = ruleResult.value;
          appliedTransformations.push(...ruleResult.appliedTransformations);
        } else {
          // Handle rule failure based on transformation options
          const options = context.typeInfo.transformations?.options;
          if (options?.failFast) {
            return {
              success: false,
              originalValue,
              error: ruleResult.error,
              appliedTransformations,
            };
          }
          // Continue with next rule if not failing fast
        }
      } catch (error) {
        const transformationError = error instanceof TransformationError
          ? error
          : new TransformationError(
              `Rule ${rule.type} failed: ${String(error)}`,
              context.path,
              currentValue,
              rule.targetType,
              `rule-${rule.type}-${i}`,
            );

        const options = context.typeInfo.transformations?.options;
        if (options?.failFast) {
          return {
            success: false,
            originalValue,
            error: transformationError,
            appliedTransformations,
          };
        }
      }
    }

    return {
      success: true,
      value: currentValue,
      originalValue,
      appliedTransformations,
    };
  }

  /**
   * Check if a transformation rule should be applied
   */
  private shouldApplyRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
  ): boolean {
    if (!rule.condition) {
      return true;
    }

    const condition = rule.condition;

    // Check source type condition
    if (condition.sourceType) {
      const valueType = this.getValueType(value);
      const sourceTypes = Array.isArray(condition.sourceType) 
        ? condition.sourceType 
        : [condition.sourceType];
      
      if (!sourceTypes.includes(valueType) && !sourceTypes.includes('*')) {
        return false;
      }
    }

    // Check value pattern condition
    if (condition.valuePattern && typeof value === 'string') {
      try {
        const regex = new RegExp(condition.valuePattern);
        if (!regex.test(value)) {
          return false;
        }
      } catch (error) {
        // Invalid regex pattern, skip this condition
        return false;
      }
    }

    // Check custom condition
    if (condition.customCondition) {
      try {
        // Safely evaluate custom condition (in a real implementation, 
        // you might want to use a proper expression evaluator)
        const conditionFunction = new Function('value', 'context', `return ${condition.customCondition}`);
        return Boolean(conditionFunction(value, context));
      } catch (error) {
        // Invalid custom condition, fail safe
        return false;
      }
    }

    return true;
  }

  /**
   * Apply a single transformation rule
   */
  private applyTransformationRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
  ): TransformationResult {
    const ruleName = `rule-${rule.type}`;

    switch (rule.type) {
      case 'coerce':
        return this.applyCoercionRule(value, rule, context, ruleName);
      
      case 'parse':
        return this.applyParseRule(value, rule, context, ruleName);
      
      case 'format':
        return this.applyFormatRule(value, rule, context, ruleName);
      
      case 'sanitize':
        return this.applySanitizeRule(value, rule, context, ruleName);
      
      case 'custom':
        return this.applyCustomRule(value, rule, context, ruleName);
      
      default:
        return {
          success: false,
          originalValue: value,
          error: new TransformationError(
            `Unknown rule type: ${rule.type}`,
            context.path,
            value,
            rule.targetType,
            ruleName,
          ),
          appliedTransformations: [],
        };
    }
  }

  /**
   * Apply coercion rule (type conversion)
   */
  private applyCoercionRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    const targetType = rule.targetType;
    if (!targetType) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          'Coercion rule requires targetType',
          context.path,
          value,
          undefined,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      let coercedValue: unknown;

      switch (targetType) {
        case 'string':
          coercedValue = String(value);
          break;
        
        case 'number':
          if (typeof value === 'string' && value.trim() === '') {
            throw new Error('Empty string cannot be coerced to number');
          }
          coercedValue = Number(value);
          if (isNaN(coercedValue as number)) {
            throw new Error(`Cannot coerce ${typeof value} to number`);
          }
          break;
        
        case 'boolean':
          if (typeof value === 'string') {
            const str = value.toLowerCase().trim();
            if (['true', '1', 'yes', 'on'].includes(str)) {
              coercedValue = true;
            } else if (['false', '0', 'no', 'off', ''].includes(str)) {
              coercedValue = false;
            } else {
              throw new Error(`Cannot coerce "${value}" to boolean`);
            }
          } else {
            coercedValue = Boolean(value);
          }
          break;
        
        case 'date':
          if (typeof value === 'string' || typeof value === 'number') {
            coercedValue = new Date(value);
            if (isNaN((coercedValue as Date).getTime())) {
              throw new Error(`Cannot coerce "${value}" to Date`);
            }
          } else {
            throw new Error(`Cannot coerce ${typeof value} to Date`);
          }
          break;
        
        case 'array':
          if (Array.isArray(value)) {
            coercedValue = value;
          } else if (typeof value === 'string') {
            try {
              coercedValue = JSON.parse(value);
              if (!Array.isArray(coercedValue)) {
                throw new Error('Parsed value is not an array');
              }
            } catch {
              // Try splitting by comma
              coercedValue = value.split(',').map(item => item.trim());
            }
          } else {
            coercedValue = [value];
          }
          break;
        
        default:
          throw new Error(`Unsupported coercion target type: ${targetType}`);
      }

      return {
        success: true,
        value: coercedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-to-${targetType}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Coercion failed: ${error instanceof Error ? error.message : String(error)}`,
          context.path,
          value,
          targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply parse rule (structured parsing)
   */
  private applyParseRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    if (typeof value !== 'string') {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          'Parse rule can only be applied to strings',
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      let parsedValue: unknown;
      const params = rule.params || {};

      switch (rule.targetType) {
        case 'json':
          parsedValue = JSON.parse(value);
          break;
        
        case 'csv':
          // Simple CSV parsing
          const delimiter = params.delimiter || ',';
          const hasHeaders = params.hasHeaders || false;
          const lines = value.split('\n').filter(line => line.trim());
          
          if (hasHeaders && lines.length > 0) {
            const headers = lines[0].split(delimiter).map(h => h.trim());
            parsedValue = lines.slice(1).map(line => {
              const values = line.split(delimiter).map(v => v.trim());
              return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || '';
                return obj;
              }, {} as Record<string, string>);
            });
          } else {
            parsedValue = lines.map(line => line.split(delimiter).map(v => v.trim()));
          }
          break;
        
        case 'url':
          parsedValue = new URL(value);
          break;
        
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error('Invalid email format');
          }
          const [localPart, domain] = value.split('@');
          parsedValue = { localPart, domain, full: value };
          break;
        
        case 'phone':
          // Simple phone number parsing
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
          if (!phoneRegex.test(cleanPhone)) {
            throw new Error('Invalid phone number format');
          }
          parsedValue = {
            raw: value,
            cleaned: cleanPhone,
            international: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`,
          };
          break;
        
        default:
          throw new Error(`Unsupported parse target type: ${rule.targetType}`);
      }

      return {
        success: true,
        value: parsedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-${rule.targetType}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Parse failed: ${error instanceof Error ? error.message : String(error)}`,
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply format rule (output formatting)
   */
  private applyFormatRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    try {
      let formattedValue: unknown;
      const params = rule.params || {};

      switch (rule.targetType) {
        case 'currency':
          let currencyValue: number;
          if (typeof value === 'number') {
            currencyValue = value;
          } else if (typeof value === 'string' && !isNaN(Number(value))) {
            currencyValue = Number(value);
          } else {
            throw new Error('Currency formatting requires a number or numeric string');
          }
          const currency = params.currency || 'USD';
          const locale = params.locale || 'en-US';
          formattedValue = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
          }).format(currencyValue);
          break;
        
        case 'percentage':
          let percentageValue: number;
          if (typeof value === 'number') {
            percentageValue = value;
          } else if (typeof value === 'string' && !isNaN(Number(value))) {
            percentageValue = Number(value);
          } else {
            throw new Error('Percentage formatting requires a number or numeric string');
          }
          const decimals = params.decimals || 2;
          formattedValue = `${(percentageValue * 100).toFixed(decimals)}%`;
          break;
        
        case 'date-string':
          if (!(value instanceof Date)) {
            throw new Error('Date formatting requires a Date object');
          }
          const format = params.format || 'ISO';
          switch (format) {
            case 'ISO':
              formattedValue = value.toISOString();
              break;
            case 'locale':
              formattedValue = value.toLocaleDateString(params.locale);
              break;
            case 'custom':
              // Simple custom formatting (YYYY-MM-DD)
              const year = value.getFullYear();
              const month = String(value.getMonth() + 1).padStart(2, '0');
              const day = String(value.getDate()).padStart(2, '0');
              formattedValue = `${year}-${month}-${day}`;
              break;
            default:
              formattedValue = value.toString();
          }
          break;
        
        case 'title-case':
          if (typeof value !== 'string') {
            throw new Error('Title case formatting requires a string');
          }
          formattedValue = value.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
          break;
        
        case 'kebab-case':
          if (typeof value !== 'string') {
            throw new Error('Kebab case formatting requires a string');
          }
          formattedValue = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
          break;
        
        default:
          throw new Error(`Unsupported format target type: ${rule.targetType}`);
      }

      return {
        success: true,
        value: formattedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-${rule.targetType}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Format failed: ${error instanceof Error ? error.message : String(error)}`,
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply sanitize rule (data cleaning)
   */
  private applySanitizeRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    if (typeof value !== 'string') {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          'Sanitize rule can only be applied to strings',
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      let sanitizedValue = value;
      const params = rule.params || {};

      switch (rule.targetType) {
        case 'html':
          // Basic HTML sanitization (remove script tags and dangerous attributes)
          sanitizedValue = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/javascript:/gi, '');
          break;
        
        case 'alphanumeric':
          const includeSpaces = params.includeSpaces || false;
          const pattern = includeSpaces ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z0-9]/g;
          sanitizedValue = value.replace(pattern, '');
          break;
        
        case 'email':
          // Remove invalid email characters
          sanitizedValue = value.toLowerCase().replace(/[^a-zA-Z0-9@.\-_]/g, '');
          break;
        
        case 'phone':
          // Keep only numbers, +, -, (, ), and spaces
          sanitizedValue = value.replace(/[^0-9\+\-\(\)\s]/g, '');
          break;
        
        case 'trim':
          sanitizedValue = value.trim();
          if (params.trimInternal) {
            sanitizedValue = sanitizedValue.replace(/\s+/g, ' ');
          }
          break;
        
        case 'lowercase':
          sanitizedValue = value.toLowerCase();
          break;
        
        case 'uppercase':
          sanitizedValue = value.toUpperCase();
          break;
        
        default:
          throw new Error(`Unsupported sanitize target type: ${rule.targetType}`);
      }

      return {
        success: true,
        value: sanitizedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-${rule.targetType}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Sanitize failed: ${error instanceof Error ? error.message : String(error)}`,
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Apply custom rule (user-defined function)
   */
  private applyCustomRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    const customFunction = rule.customFunction;
    if (!customFunction) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          'Custom rule requires customFunction',
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      // In a real implementation, you might want to use a safer method
      // than eval, such as a proper expression evaluator or plugin system
      const transformFunction = new Function('value', 'params', 'context', `return (${customFunction})(value, params, context)`);
      const transformedValue = transformFunction(value, rule.params || {}, context);

      return {
        success: true,
        value: transformedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-${customFunction.substring(0, 20)}...`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Custom rule failed: ${error instanceof Error ? error.message : String(error)}`,
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }
  }

  /**
   * Get the type of a value for transformation rules
   */
  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    return typeof value;
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