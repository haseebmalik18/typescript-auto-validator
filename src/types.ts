export interface TypeInfo {
  kind:
    | "string"
    | "number"
    | "boolean"
    | "array"
    | "object"
    | "union"
    | "intersection"
    | "literal"
    | "date"
    | "reference"
    | "tuple"
    | "null"
    | "undefined"
    | "unknown"
    | "any"
    | "never";
  nullable: boolean;
  optional?: boolean;
  elementType?: TypeInfo;
  elementTypes?: TypeInfo[];
  types?: TypeInfo[];
  properties?: PropertyInfo[];
  value?: string | number | boolean | null;
  literalType?: "string" | "number" | "boolean";
  name?: string;
  // Enhanced metadata
  description?: string;
  constraints?: ValidationConstraints;
  transformations?: TypeTransformations;
}

export interface ValidationConstraints {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string[];
}

export interface TypeTransformations {
  autoTransform?: boolean;
  transformer?: string;
  preTransform?: TransformationRule[];
  postTransform?: TransformationRule[];
  options?: TransformationOptions;
}

export interface TransformationRule {
  type: 'coerce' | 'parse' | 'format' | 'sanitize' | 'custom';
  targetType?: string;
  customFunction?: string; // Deprecated for security - use functionName instead
  functionName?: string; // Name of predefined safe function
  params?: Record<string, unknown>;
  condition?: TransformationCondition;
}

export interface TransformationCondition {
  sourceType?: string | string[];
  valuePattern?: string;
  customCondition?: string;
}

export interface TransformationOptions {
  failFast?: boolean;
  allowPartial?: boolean;
  preserveOriginal?: boolean;
  errorMessages?: Record<string, string>;
}

export interface PropertyInfo {
  name: string;
  type: TypeInfo;
  optional: boolean;
  readonly: boolean;
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  filePath: string;
  exported: boolean;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidatorConfig {
  strict?: boolean;
  allowUnknownProperties?: boolean;
  transformDates?: boolean;
  // Enhanced transformation configuration
  autoTransform?: boolean;
  transformers?: TransformerRegistry;
  transformationStrategy?: TransformationStrategy;
  onTransformationError?: (error: TransformationError, context: TransformationContext) => void;
}

export interface TransformerRegistry {
  [key: string]: TransformerDefinition;
}

export interface TransformerDefinition {
  /** Transformer function that converts value */
  transform: (value: unknown, options?: unknown) => unknown;
  /** Validator function to check if transformation is applicable */
  canTransform?: (value: unknown) => boolean;
  /** Type guard to check if value can be transformed */
  sourceTypes: string[];
  /** Target type after transformation */
  targetType: string;
  /** Transformer metadata */
  metadata?: TransformerMetadata;
}

export interface TransformerMetadata {
  description?: string;
  examples?: Array<{ input: unknown; output: unknown }>;
  version?: string;
  author?: string;
}

export interface TransformationStrategy {
  /** How to handle transformation failures */
  onError: 'throw' | 'skip' | 'default' | 'custom';
  /** Default value to use when transformation fails and strategy is 'default' */
  defaultValue?: unknown;
  /** Custom error handler when strategy is 'custom' */
  customErrorHandler?: (error: TransformationError) => unknown;
  /** Whether to attempt multiple transformers for the same type */
  allowChaining?: boolean;
  /** Maximum transformation depth to prevent infinite loops */
  maxDepth?: number;
}

export interface TransformationContext {
  /** Path where transformation is being applied */
  path: string;
  /** Source value being transformed */
  sourceValue: unknown;
  /** Type information */
  typeInfo: TypeInfo;
  /** Validator configuration */
  config: ValidatorConfig;
  /** Transformation depth (for preventing infinite loops) */
  depth: number;
}

export interface TransformationResult<T = unknown> {
  /** Whether transformation was successful */
  success: boolean;
  /** Transformed value (if successful) */
  value?: T;
  /** Original value */
  originalValue: unknown;
  /** Transformation error (if failed) */
  error?: TransformationError;
  /** Applied transformations */
  appliedTransformations: string[];
  /** Transformation metadata */
  metadata?: Record<string, unknown>;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public path?: string,
    public expected?: string,
    public received?: string,
    public value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class TransformationError extends Error {
  constructor(
    message: string,
    public path?: string,
    public sourceValue?: unknown,
    public targetType?: string,
    public transformerName?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "TransformationError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TransformationError);
    }
  }

  static create(
    path: string,
    sourceValue: unknown,
    targetType: string,
    transformerName: string,
    cause?: Error,
  ): TransformationError {
    const message = `Transformation failed at ${path}: cannot transform ${typeof sourceValue} to ${targetType} using ${transformerName}`;
    return new TransformationError(message, path, sourceValue, targetType, transformerName, cause);
  }

  static invalidInput(
    path: string,
    sourceValue: unknown,
    transformerName: string,
  ): TransformationError {
    const message = `Invalid input for transformation at ${path}: ${transformerName} cannot process ${typeof sourceValue}`;
    return new TransformationError(message, path, sourceValue, undefined, transformerName);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      path: this.path,
      sourceValue: this.sourceValue,
      targetType: this.targetType,
      transformerName: this.transformerName,
      cause: this.cause?.message,
    };
  }
}
