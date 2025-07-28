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
 * Safe expression evaluator that only allows whitelisted operations
 */
class SafeExpressionEvaluator {
  private static readonly ALLOWED_OPERATORS = [
    ">",
    "<",
    ">=",
    "<=",
    "===",
    "!==",
    "==",
    "!=",
    "&&",
    "||",
    "!",
    "+",
    "-",
    "*",
    "/",
    "%",
  ];

  private static readonly ALLOWED_PROPERTIES = [
    "length",
    "value",
    "type",
    "kind",
    "name",
    "id",
    "status",
    "active",
    "enabled",
  ];

  private static readonly ALLOWED_METHODS = [
    "includes",
    "startsWith",
    "endsWith",
    "toLowerCase",
    "toUpperCase",
    "trim",
  ];

  /**
   * Safely evaluate simple expressions with whitelisted operations only
   */
  static evaluate(expression: string, value: unknown, context?: any): boolean {
    // Input validation
    if (typeof expression !== 'string') {
      throw new TransformationError('Expression must be a string', 'expression.invalid-type');
    }
    
    if (expression.length > 500) {
      throw new TransformationError('Expression too long (max 500 characters)', 'expression.too-long');
    }
    
    if (expression.length === 0) {
      throw new TransformationError('Expression cannot be empty', 'expression.empty');
    }
    
    try {
      // Remove all whitespace for easier parsing and normalize
      const cleanExpr = expression.replace(/\s+/g, " ").trim();

      // Check for dangerous patterns
      if (this.containsDangerousPatterns(cleanExpr)) {
        throw new TransformationError(
          `Security violation: Blocked potentially dangerous expression: ${expression}`,
          'expression.security-violation'
        );
      }

      // Validate expression contains only whitelisted patterns
      if (!this.isWhitelistedExpression(cleanExpr)) {
        throw new TransformationError(
          `Expression contains non-whitelisted operations: ${expression}`,
          'expression.non-whitelisted'
        );
      }

      // Parse and evaluate safe expressions
      return this.evaluateSafeExpression(cleanExpr, value, context);
    } catch (error) {
      if (error instanceof TransformationError) {
        throw error;
      }
      throw new TransformationError(
        `Failed to evaluate expression "${expression}": ${error instanceof Error ? error.message : String(error)}`,
        'expression.evaluation-error'
      );
    }
  }

  private static containsDangerousPatterns(expression: string): boolean {
    const dangerousPatterns = [
      // Code execution
      /require\s*\(/,
      /import\s*\(/,
      /eval\s*\(/,
      /Function\s*\(/,
      /new\s+Function/i,
      /constructor/,
      /prototype/,
      /__proto__/,
      
      // System access
      /process\./,
      /global\./,
      /window\./,
      /document\./,
      /console\./,
      /fs\./,
      /child_process/,
      /os\./,
      /path\./,
      
      // Network access
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /WebSocket/,
      /EventSource/,
      
      // Function manipulation
      /\.call\s*\(/,
      /\.apply\s*\(/,
      /\.bind\s*\(/,
      
      // Timing functions
      /setTimeout/,
      /setInterval/,
      /setImmediate/,
      
      // Template literals and dynamic code
      /`.*\$\{/,
      /with\s*\(/,
      /delete\s+/,
      
      // Error handling that could expose internals
      /throw\s+/,
      /try\s*\{/,
      /catch\s*\(/,
      
      // Object manipulation
      /new\s+/,
      /Object\./,
      /Reflect\./,
      /Proxy\s*\(/,
      /try\s*{/,
      /catch\s*\(/,
      /while\s*\(/,
      /for\s*\(/,
      /function\s*\(/,
      /=>/,
      /\.\./,
      /\[.*\]/,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(expression));
  }

  /**
   * Check if expression contains only whitelisted operations
   */
  private static isWhitelistedExpression(expression: string): boolean {
    // Remove all allowed tokens and see if anything suspicious remains
    let sanitized = expression;
    
    // Remove allowed operators
    this.ALLOWED_OPERATORS.forEach(op => {
      const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escapedOp, 'g'), ' ');
    });
    
    // Remove allowed properties
    this.ALLOWED_PROPERTIES.forEach(prop => {
      sanitized = sanitized.replace(new RegExp(`\\b${prop}\\b`, 'g'), ' ');
    });
    
    // Remove allowed methods (with parentheses)
    this.ALLOWED_METHODS.forEach(method => {
      sanitized = sanitized.replace(new RegExp(`\\b${method}\\s*\\(`, 'g'), ' ');
    });
    
    // Remove numbers, strings, and value/context references
    sanitized = sanitized.replace(/\b\d+(\.\d+)?\b/g, ' '); // numbers
    sanitized = sanitized.replace(/'[^']*'/g, ' '); // single quotes
    sanitized = sanitized.replace(/"[^"]*"/g, ' '); // double quotes
    sanitized = sanitized.replace(/\bvalue\b/g, ' '); // value reference
    sanitized = sanitized.replace(/\bcontext\b/g, ' '); // context reference
    sanitized = sanitized.replace(/\btypeof\b/g, ' '); // typeof operator
    
    // Remove whitespace and check if anything remains
    sanitized = sanitized.replace(/\s+/g, '').replace(/[()[\].,]/g, '');
    
    return sanitized.length === 0;
  }

  private static evaluateSafeExpression(
    expression: string,
    value: unknown,
    _context?: any,
  ): boolean {
    // Handle simple type checks
    if (expression.startsWith("typeof ")) {
      return this.evaluateTypeofExpression(expression, value);
    }

    // Handle simple property access and comparisons
    if (expression.includes(".length")) {
      return this.evaluateLengthExpression(expression, value);
    }

    // Handle simple value comparisons
    if (this.isSimpleComparison(expression)) {
      return this.evaluateSimpleComparison(expression, value);
    }

    // Handle method calls on value
    if (expression.includes(".")) {
      return this.evaluatePropertyAccess(expression, value);
    }

    // Default to false for any unrecognized patterns
    throw new TransformationError(
      `Unrecognized expression pattern: ${expression}`,
      'expression.unrecognized-pattern'
    );
  }

  private static evaluateTypeofExpression(
    expression: string,
    value: unknown,
  ): boolean {
    const match = expression.match(
      /typeof\s+value\s*([><=!]+)\s*['"](\w+)['"]/,
    );
    if (!match) return false;

    const [, operator, expectedType] = match;
    const actualType = typeof value;

    switch (operator) {
      case "===":
      case "==":
        return actualType === expectedType;
      case "!==":
      case "!=":
        return actualType !== expectedType;
      default:
        return false;
    }
  }

  private static evaluateLengthExpression(
    expression: string,
    value: unknown,
  ): boolean {
    if (typeof value !== "string" && !Array.isArray(value)) return false;

    const length = (value as string | unknown[]).length;
    const match = expression.match(/value\.length\s*([><=!]+)\s*(\d+)/);
    if (!match) return false;

    const [, operator, threshold] = match;
    const thresholdNum = parseInt(threshold, 10);

    switch (operator) {
      case ">":
        return length > thresholdNum;
      case "<":
        return length < thresholdNum;
      case ">=":
        return length >= thresholdNum;
      case "<=":
        return length <= thresholdNum;
      case "===":
      case "==":
        return length === thresholdNum;
      case "!==":
      case "!=":
        return length !== thresholdNum;
      default:
        return false;
    }
  }

  private static isSimpleComparison(expression: string): boolean {
    return /^value\s*([><=!]+)\s*(.+)$/.test(expression);
  }

  private static evaluateSimpleComparison(
    expression: string,
    value: unknown,
  ): boolean {
    const match = expression.match(/^value\s*([><=!]+)\s*(.+)$/);
    if (!match) return false;

    const [, operator, rightSide] = match;
    let rightValue: unknown;

    // Parse right side value
    if (rightSide.startsWith('"') && rightSide.endsWith('"')) {
      rightValue = rightSide.slice(1, -1);
    } else if (rightSide.startsWith("'") && rightSide.endsWith("'")) {
      rightValue = rightSide.slice(1, -1);
    } else if (!isNaN(Number(rightSide))) {
      rightValue = Number(rightSide);
    } else if (rightSide === "true") {
      rightValue = true;
    } else if (rightSide === "false") {
      rightValue = false;
    } else if (rightSide === "null") {
      rightValue = null;
    } else {
      return false; // Unsupported right side
    }

    switch (operator) {
      case ">":
        return Number(value) > Number(rightValue);
      case "<":
        return Number(value) < Number(rightValue);
      case ">=":
        return Number(value) >= Number(rightValue);
      case "<=":
        return Number(value) <= Number(rightValue);
      case "===":
      case "==":
        return value === rightValue;
      case "!==":
      case "!=":
        return value !== rightValue;
      default:
        return false;
    }
  }

  private static evaluatePropertyAccess(
    expression: string,
    value: unknown,
  ): boolean {
    // Only allow safe property access on strings
    if (typeof value !== "string") return false;

    // Handle string method calls
    const methodMatch = expression.match(
      /^value\.(\w+)\(\)\s*([><=!]+)\s*(.+)$/,
    );
    if (methodMatch) {
      const [, method, operator, rightSide] = methodMatch;

      if (!this.ALLOWED_METHODS.includes(method)) return false;

      let result: unknown;
      try {
        switch (method) {
          case "toLowerCase":
            result = value.toLowerCase();
            break;
          case "toUpperCase":
            result = value.toUpperCase();
            break;
          case "trim":
            result = value.trim();
            break;
          default:
            return false;
        }

        return this.evaluateSimpleComparison(
          `value ${operator} ${rightSide}`,
          result,
        );
      } catch {
        return false;
      }
    }

    // Handle string method calls with parameters
    const methodWithParamMatch = expression.match(
      /^value\.(\w+)\(['"]([^'"]*)['"]\)$/,
    );
    if (methodWithParamMatch) {
      const [, method, param] = methodWithParamMatch;

      if (!this.ALLOWED_METHODS.includes(method)) return false;

      try {
        switch (method) {
          case "includes":
            return value.includes(param);
          case "startsWith":
            return value.startsWith(param);
          case "endsWith":
            return value.endsWith(param);
          default:
            return false;
        }
      } catch {
        return false;
      }
    }

    return false;
  }
}

/**
 * Predefined safe transformation functions to replace custom functions
 */
class SafeTransformationFunctions {
  private static functions = new Map<
    string,
    (value: unknown, params?: Record<string, unknown>) => unknown
  >([
    [
      "reverse",
      (value) => {
        if (typeof value === "string")
          return value.split("").reverse().join("");
        if (Array.isArray(value)) return [...value].reverse();
        throw new Error("Reverse function only works with strings and arrays");
      },
    ],

    [
      "repeat",
      (value, params) => {
        if (typeof value !== "string")
          throw new Error("Repeat function only works with strings");
        const times = (params?.times as number) || 1;
        if (times < 0 || times > 100)
          throw new Error("Repeat times must be between 0 and 100");
        return value.repeat(times);
      },
    ],

    [
      "truncate",
      (value, params) => {
        if (typeof value !== "string")
          throw new Error("Truncate function only works with strings");
        const maxLength = (params?.maxLength as number) || 100;
        if (maxLength < 0 || maxLength > 10000)
          throw new Error("Max length must be between 0 and 10000");
        return value.length > maxLength
          ? value.substring(0, maxLength) + "..."
          : value;
      },
    ],

    [
      "capitalize",
      (value) => {
        if (typeof value !== "string")
          throw new Error("Capitalize function only works with strings");
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      },
    ],

    [
      "padStart",
      (value, params) => {
        if (typeof value !== "string")
          throw new Error("PadStart function only works with strings");
        const length = (params?.length as number) || 0;
        const padString = (params?.padString as string) || " ";
        if (length < 0 || length > 1000)
          throw new Error("Pad length must be between 0 and 1000");
        return value.padStart(length, padString);
      },
    ],

    [
      "padEnd",
      (value, params) => {
        if (typeof value !== "string")
          throw new Error("PadEnd function only works with strings");
        const length = (params?.length as number) || 0;
        const padString = (params?.padString as string) || " ";
        if (length < 0 || length > 1000)
          throw new Error("Pad length must be between 0 and 1000");
        return value.padEnd(length, padString);
      },
    ],

    [
      "slice",
      (value, params) => {
        if (typeof value !== "string" && !Array.isArray(value)) {
          throw new Error("Slice function only works with strings and arrays");
        }
        const start = (params?.start as number) || 0;
        const end = params?.end as number;
        return value.slice(start, end);
      },
    ],

    [
      "replace",
      (value, params) => {
        if (typeof value !== "string")
          throw new Error("Replace function only works with strings");
        const search = params?.search as string;
        const replacement = (params?.replacement as string) || "";
        if (!search)
          throw new Error("Search parameter is required for replace function");
        // Only allow simple string replacement, no regex
        return value.split(search).join(replacement);
      },
    ],

    [
      "abs",
      (value) => {
        if (typeof value !== "number")
          throw new Error("Abs function only works with numbers");
        return Math.abs(value);
      },
    ],

    [
      "round",
      (value, params) => {
        if (typeof value !== "number")
          throw new Error("Round function only works with numbers");
        const decimals = (params?.decimals as number) || 0;
        if (decimals < 0 || decimals > 10)
          throw new Error("Decimals must be between 0 and 10");
        return (
          Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
        );
      },
    ],

    [
      "clamp",
      (value, params) => {
        if (typeof value !== "number")
          throw new Error("Clamp function only works with numbers");
        const min = (params?.min as number) ?? -Infinity;
        const max = (params?.max as number) ?? Infinity;
        return Math.min(Math.max(value, min), max);
      },
    ],

    [
      "throwError",
      (value) => {
        throw new Error("Custom error");
      },
    ],
  ]);

  static get(
    name: string,
  ):
    | ((value: unknown, params?: Record<string, unknown>) => unknown)
    | undefined {
    return this.functions.get(name);
  }

  static has(name: string): boolean {
    return this.functions.has(name);
  }

  static getAvailableFunctions(): string[] {
    return Array.from(this.functions.keys());
  }
}

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
    const maxDepth =
      config.transformationStrategy?.maxDepth ||
      this.defaultStrategy.maxDepth ||
      10;
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
      (transformer) =>
        transformer.sourceTypes.includes(sourceType) ||
        transformer.sourceTypes.includes("*"),
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
    const coercionResult = this.applyAutomaticCoercion(
      currentValue,
      typeInfo,
      context,
    );
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
      (t) => t.targetType === targetType,
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
    if (
      targetTransformer.canTransform &&
      !targetTransformer.canTransform(value)
    ) {
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
        const ruleResult = this.applyTransformationRule(
          currentValue,
          rule,
          context,
        );

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
        const transformationError =
          error instanceof TransformationError
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

      if (!sourceTypes.includes(valueType) && !sourceTypes.includes("*")) {
        return false;
      }
    }

    // Check value pattern condition
    if (condition.valuePattern && typeof value === "string") {
      try {
        const regex = new RegExp(condition.valuePattern);
        if (!regex.test(value)) {
          return false;
        }
      } catch (error) {
        // Invalid regex pattern, fail validation
        throw new TransformationError(
          `Invalid regex pattern in transformation rule: ${condition.valuePattern}`,
          'condition.invalid-regex'
        );
      }
    }

    // Check custom condition using safe evaluator
    if (condition.customCondition) {
      try {
        return SafeExpressionEvaluator.evaluate(
          condition.customCondition,
          value,
          context,
        );
      } catch (error) {
        // Invalid custom condition, fail validation
        throw new TransformationError(
          `Failed to evaluate custom condition: ${condition.customCondition}. ${error instanceof Error ? error.message : String(error)}`,
          'condition.evaluation-error'
        );
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
      case "coerce":
        return this.applyCoercionRule(value, rule, context, ruleName);

      case "parse":
        return this.applyParseRule(value, rule, context, ruleName);

      case "format":
        return this.applyFormatRule(value, rule, context, ruleName);

      case "sanitize":
        return this.applySanitizeRule(value, rule, context, ruleName);

      case "custom":
        return this.applySafeCustomRule(value, rule, context, ruleName);

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
          "Coercion rule requires targetType",
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
        case "string":
          coercedValue = String(value);
          break;

        case "number":
          if (typeof value === "string" && value.trim() === "") {
            throw new Error("Empty string cannot be coerced to number");
          }
          coercedValue = Number(value);
          if (isNaN(coercedValue as number)) {
            throw new Error(`Cannot coerce ${typeof value} to number`);
          }
          break;

        case "boolean":
          if (typeof value === "string") {
            const str = value.toLowerCase().trim();
            if (["true", "1", "yes", "on"].includes(str)) {
              coercedValue = true;
            } else if (["false", "0", "no", "off", ""].includes(str)) {
              coercedValue = false;
            } else {
              throw new Error(`Cannot coerce "${value}" to boolean`);
            }
          } else {
            coercedValue = Boolean(value);
          }
          break;

        case "date":
          if (typeof value === "string" || typeof value === "number") {
            coercedValue = new Date(value);
            if (isNaN((coercedValue as Date).getTime())) {
              throw new Error(`Cannot coerce "${value}" to Date`);
            }
          } else {
            throw new Error(`Cannot coerce ${typeof value} to Date`);
          }
          break;

        case "array":
          if (Array.isArray(value)) {
            coercedValue = value;
          } else if (typeof value === "string") {
            try {
              coercedValue = JSON.parse(value);
              if (!Array.isArray(coercedValue)) {
                throw new Error("Parsed value is not an array");
              }
            } catch {
              // Try splitting by comma
              coercedValue = value.split(",").map((item) => item.trim());
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
    if (typeof value !== "string") {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          "Parse rule can only be applied to strings",
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
        case "json":
          parsedValue = JSON.parse(value);
          break;

        case "csv":
          // Simple CSV parsing
          const delimiter = params.delimiter || ",";
          const hasHeaders = params.hasHeaders || false;
          const lines = value.split("\n").filter((line) => line.trim());

          if (hasHeaders && lines.length > 0) {
            const headers = lines[0].split(delimiter).map((h) => h.trim());
            parsedValue = lines.slice(1).map((line) => {
              const values = line.split(delimiter).map((v) => v.trim());
              return headers.reduce(
                (obj, header, index) => {
                  obj[header] = values[index] || "";
                  return obj;
                },
                {} as Record<string, string>,
              );
            });
          } else {
            parsedValue = lines.map((line) =>
              line.split(delimiter).map((v) => v.trim()),
            );
          }
          break;

        case "url":
          parsedValue = new URL(value);
          break;

        case "email":
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error("Invalid email format");
          }
          const [localPart, domain] = value.split("@");
          parsedValue = { localPart, domain, full: value };
          break;

        case "phone":
          // Simple phone number parsing
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          const cleanPhone = value.replace(/[\s\-\(\)]/g, "");
          if (!phoneRegex.test(cleanPhone)) {
            throw new Error("Invalid phone number format");
          }
          parsedValue = {
            raw: value,
            cleaned: cleanPhone,
            international: cleanPhone.startsWith("+")
              ? cleanPhone
              : `+${cleanPhone}`,
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
        case "currency":
          let currencyValue: number;
          if (typeof value === "number") {
            currencyValue = value;
          } else if (typeof value === "string" && !isNaN(Number(value))) {
            currencyValue = Number(value);
          } else {
            throw new Error(
              "Currency formatting requires a number or numeric string",
            );
          }
          const currency = params.currency || "USD";
          const locale = params.locale || "en-US";
          formattedValue = new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
          }).format(currencyValue);
          break;

        case "percentage":
          let percentageValue: number;
          if (typeof value === "number") {
            percentageValue = value;
          } else if (typeof value === "string" && !isNaN(Number(value))) {
            percentageValue = Number(value);
          } else {
            throw new Error(
              "Percentage formatting requires a number or numeric string",
            );
          }
          const decimals = params.decimals || 2;
          formattedValue = `${(percentageValue * 100).toFixed(decimals)}%`;
          break;

        case "date-string":
          if (!(value instanceof Date)) {
            throw new Error("Date formatting requires a Date object");
          }
          const format = params.format || "ISO";
          switch (format) {
            case "ISO":
              formattedValue = value.toISOString();
              break;
            case "locale":
              formattedValue = value.toLocaleDateString(params.locale);
              break;
            case "custom":
              // Simple custom formatting (YYYY-MM-DD)
              const year = value.getFullYear();
              const month = String(value.getMonth() + 1).padStart(2, "0");
              const day = String(value.getDate()).padStart(2, "0");
              formattedValue = `${year}-${month}-${day}`;
              break;
            default:
              formattedValue = value.toString();
          }
          break;

        case "title-case":
          if (typeof value !== "string") {
            throw new Error("Title case formatting requires a string");
          }
          formattedValue = value
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase());
          break;

        case "kebab-case":
          if (typeof value !== "string") {
            throw new Error("Kebab case formatting requires a string");
          }
          formattedValue = value
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-]/g, "");
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
    if (typeof value !== "string") {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          "Sanitize rule can only be applied to strings",
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
        case "html":
          // Basic HTML sanitization (remove script tags and dangerous attributes)
          sanitizedValue = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/on\w+="[^"]*"/gi, "")
            .replace(/javascript:/gi, "");
          break;

        case "alphanumeric":
          const includeSpaces = params.includeSpaces || false;
          const pattern = includeSpaces ? /[^a-zA-Z0-9\s]/g : /[^a-zA-Z0-9]/g;
          sanitizedValue = value.replace(pattern, "");
          break;

        case "email":
          // Remove invalid email characters
          sanitizedValue = value
            .toLowerCase()
            .replace(/[^a-zA-Z0-9@.\-_]/g, "");
          break;

        case "phone":
          // Keep only numbers, +, -, (, ), and spaces
          sanitizedValue = value.replace(/[^0-9\+\-\(\)\s]/g, "");
          break;

        case "trim":
          sanitizedValue = value.trim();
          if (params.trimInternal) {
            sanitizedValue = sanitizedValue.replace(/\s+/g, " ");
          }
          break;

        case "lowercase":
          sanitizedValue = value.toLowerCase();
          break;

        case "uppercase":
          sanitizedValue = value.toUpperCase();
          break;

        default:
          throw new Error(
            `Unsupported sanitize target type: ${rule.targetType}`,
          );
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
   * Apply safe custom rule using predefined safe functions
   * SECURITY: Replaces dangerous new Function() with safe, predefined functions
   */
  private applySafeCustomRule(
    value: unknown,
    rule: any,
    context: TransformationContext,
    ruleName: string,
  ): TransformationResult {
    // Check if customFunction is provided (legacy support)
    if (rule.customFunction) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          "Custom function execution is disabled for security reasons. Use predefined safe functions instead.",
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    const functionName = rule.functionName;
    if (!functionName) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          "Custom rule requires functionName (customFunction is disabled for security)",
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    const safeFunction = SafeTransformationFunctions.get(functionName);
    if (!safeFunction) {
      const availableFunctions =
        SafeTransformationFunctions.getAvailableFunctions();
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Unknown safe function '${functionName}'. Available functions: ${availableFunctions.join(", ")}`,
          context.path,
          value,
          rule.targetType,
          ruleName,
        ),
        appliedTransformations: [],
      };
    }

    try {
      const transformedValue = safeFunction(value, rule.params || {});

      return {
        success: true,
        value: transformedValue,
        originalValue: value,
        appliedTransformations: [`${ruleName}-${functionName}`],
      };
    } catch (error) {
      return {
        success: false,
        originalValue: value,
        error: new TransformationError(
          `Safe custom function failed: ${error instanceof Error ? error.message : String(error)}`,
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
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date";
    if (value instanceof RegExp) return "regexp";
    return typeof value;
  }

  /**
   * Handle transformation errors according to strategy
   */
  private handleTransformationError<T>(
    error: unknown,
    context: TransformationContext,
  ): TransformationResult<T> {
    const strategy =
      context.config.transformationStrategy || this.defaultStrategy;
    const transformationError =
      error instanceof TransformationError
        ? error
        : new TransformationError(
            String(error),
            context.path,
            context.sourceValue,
          );

    switch (strategy.onError) {
      case "throw":
        throw transformationError;

      case "skip":
        return {
          success: true,
          value: context.sourceValue as T,
          originalValue: context.sourceValue,
          appliedTransformations: [],
        };

      case "default":
        return {
          success: true,
          value: (strategy.defaultValue ?? context.sourceValue) as T,
          originalValue: context.sourceValue,
          appliedTransformations: ["default-fallback"],
        };

      case "custom":
        if (strategy.customErrorHandler) {
          try {
            const fallbackValue =
              strategy.customErrorHandler(transformationError);
            return {
              success: true,
              value: fallbackValue as T,
              originalValue: context.sourceValue,
              appliedTransformations: ["custom-error-handler"],
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
  private typesMatch(
    sourceType: string,
    targetType: string,
    value: unknown,
  ): boolean {
    if (sourceType === targetType) return true;

    // Special cases
    if (targetType === "date" && value instanceof Date) return true;
    if (targetType === "array" && Array.isArray(value)) return true;
    if (targetType === "null" && value === null) return true;
    if (targetType === "undefined" && value === undefined) return true;

    return false;
  }
}

/**
 * Get built-in transformers for common type coercions
 */
export function getBuiltInTransformers(): TransformerRegistry {
  return {
    "string-to-number": {
      sourceTypes: ["string"],
      targetType: "number",
      canTransform: (value) =>
        typeof value === "string" &&
        !isNaN(Number(value)) &&
        value.trim() !== "",
      transform: (value) => {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        return num;
      },
      metadata: {
        description: "Converts string to number",
        examples: [
          { input: "123", output: 123 },
          { input: "45.67", output: 45.67 },
        ],
      },
    },

    "string-to-boolean": {
      sourceTypes: ["string"],
      targetType: "boolean",
      canTransform: (value) => typeof value === "string",
      transform: (value) => {
        const str = (value as string).toLowerCase().trim();
        if (["true", "1", "yes", "on"].includes(str)) return true;
        if (["false", "0", "no", "off", ""].includes(str)) return false;
        throw new Error(`Cannot convert "${value}" to boolean`);
      },
      metadata: {
        description: "Converts string to boolean",
        examples: [
          { input: "true", output: true },
          { input: "false", output: false },
          { input: "1", output: true },
          { input: "0", output: false },
        ],
      },
    },

    "string-to-date": {
      sourceTypes: ["string"],
      targetType: "date",
      canTransform: (value) =>
        typeof value === "string" && !isNaN(Date.parse(value)),
      transform: (value) => {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          throw new Error(`Cannot convert "${value}" to Date`);
        }
        return date;
      },
      metadata: {
        description: "Converts string to Date",
        examples: [
          { input: "2023-01-01", output: new Date("2023-01-01") },
          {
            input: "2023-01-01T12:00:00Z",
            output: new Date("2023-01-01T12:00:00Z"),
          },
        ],
      },
    },

    "number-to-string": {
      sourceTypes: ["number"],
      targetType: "string",
      canTransform: (value) => typeof value === "number",
      transform: (value) => String(value),
      metadata: {
        description: "Converts number to string",
        examples: [
          { input: 123, output: "123" },
          { input: 45.67, output: "45.67" },
        ],
      },
    },

    "boolean-to-string": {
      sourceTypes: ["boolean"],
      targetType: "string",
      canTransform: (value) => typeof value === "boolean",
      transform: (value) => String(value),
      metadata: {
        description: "Converts boolean to string",
        examples: [
          { input: true, output: "true" },
          { input: false, output: "false" },
        ],
      },
    },

    "number-to-boolean": {
      sourceTypes: ["number"],
      targetType: "boolean",
      canTransform: (value) => typeof value === "number",
      transform: (value) => Boolean(value),
      metadata: {
        description: "Converts number to boolean (0 = false, non-zero = true)",
        examples: [
          { input: 0, output: false },
          { input: 1, output: true },
          { input: -1, output: true },
        ],
      },
    },

    "date-to-string": {
      sourceTypes: ["object"],
      targetType: "string",
      canTransform: (value) => value instanceof Date,
      transform: (value) => (value as Date).toISOString(),
      metadata: {
        description: "Converts Date to ISO string",
        examples: [
          { input: new Date("2023-01-01"), output: "2023-01-01T00:00:00.000Z" },
        ],
      },
    },

    "array-to-string": {
      sourceTypes: ["object"],
      targetType: "string",
      canTransform: (value) => Array.isArray(value),
      transform: (value) => JSON.stringify(value),
      metadata: {
        description: "Converts array to JSON string",
        examples: [{ input: [1, 2, 3], output: "[1,2,3]" }],
      },
    },

    "object-to-string": {
      sourceTypes: ["object"],
      targetType: "string",
      canTransform: (value) =>
        typeof value === "object" && value !== null && !Array.isArray(value),
      transform: (value) => JSON.stringify(value),
      metadata: {
        description: "Converts object to JSON string",
        examples: [{ input: { a: 1 }, output: '{"a":1}' }],
      },
    },
  };
}

/**
 * Get default transformation strategy
 */
export function getDefaultTransformationStrategy(): TransformationStrategy {
  return {
    onError: "throw",
    allowChaining: false,
    maxDepth: 10,
  };
}
