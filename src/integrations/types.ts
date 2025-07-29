import { ValidatorConfig } from '../types.js';
import { ValidationError } from '../validator/error-handler.js';

/**
 * Common integration configuration options
 */
export interface IntegrationConfig extends ValidatorConfig {
  /**
   * Whether to throw detailed errors or simplified ones
   * @default false
   */
  detailedErrors?: boolean;
  
  /**
   * Custom error handler for integration-specific error handling
   */
  onError?: (error: ValidationError, context?: unknown) => void;
  
  /**
   * Whether to log validation events for debugging
   * @default false  
   */
  enableLogging?: boolean;
  
  /**
   * Custom logger function
   */
  logger?: (message: string, level: 'info' | 'warn' | 'error', data?: unknown) => void;
}

/**
 * Result of a validation operation in integrations
 */
export interface ValidationResult<T> {
  /**
   * Whether validation was successful
   */
  success: boolean;
  
  /**
   * The validated data (only present if success is true)
   */
  data?: T;
  
  /**
   * Validation error (only present if success is false)
   */
  error?: ValidationError;
  
  /**
   * Additional metadata about the validation
   */
  metadata?: {
    validationTime?: number;
    transformationsApplied?: string[];
    warnings?: string[];
  };
}

/**
 * Async validation result for operations that may be asynchronous
 */
export type AsyncValidationResult<T> = Promise<ValidationResult<T>>;

/**
 * Options for request validation in web frameworks
 */
export interface RequestValidationOptions extends IntegrationConfig {
  /**
   * Whether to validate request body
   * @default true
   */
  validateBody?: boolean;
  
  /**
   * Whether to validate query parameters
   * @default false
   */
  validateQuery?: boolean;
  
  /**
   * Whether to validate request headers
   * @default false
   */
  validateHeaders?: boolean;
  
  /**
   * Whether to validate URL parameters
   * @default false
   */
  validateParams?: boolean;
  
  /**
   * Custom status code for validation errors
   * @default 400
   */
  errorStatusCode?: number;
  
  /**
   * Whether to include error details in response
   * @default true in development, false in production
   */
  includeErrorDetails?: boolean;
}

/**
 * Options for response validation in web frameworks
 */
export interface ResponseValidationOptions extends IntegrationConfig {
  /**
   * Whether to validate the response data
   * @default true
   */
  validateResponse?: boolean;
  
  /**
   * What to do when response validation fails
   * @default 'log' - log error and continue
   */
  onResponseValidationError?: 'throw' | 'log' | 'ignore';
}

/**
 * Validation context for framework integrations
 */
export interface ValidationContext {
  /**
   * Framework-specific request object
   */
  request?: unknown;
  
  /**
   * Framework-specific response object  
   */
  response?: unknown;
  
  /**
   * Additional context data
   */
  context?: Record<string, unknown>;
  
  /**
   * Validation path for error reporting
   */
  path: string;
  
  /**
   * Timestamp when validation started
   */
  startTime: number;
}

/**
 * Hook state for React integration
 */
export interface ValidationHookState<T> {
  /**
   * The validated data
   */
  data: T | null;
  
  /**
   * Validation error if any
   */
  error: ValidationError | null;
  
  /**
   * Whether validation is currently running
   */
  isValidating: boolean;
  
  /**
   * Whether validation has been attempted
   */
  hasValidated: boolean;
  
  /**
   * Validate data manually
   */
  validate: (data: unknown) => Promise<void>;
  
  /**
   * Clear validation state
   */
  clear: () => void;
  
  /**
   * Retry last validation
   */
  retry: () => Promise<void>;
}

/**
 * Options for React hooks
 */
export interface UseValidationOptions<T> extends IntegrationConfig {
  /**
   * Whether to validate immediately on mount
   * @default false
   */
  validateOnMount?: boolean;
  
  /**
   * Whether to validate when dependencies change
   * @default true
   */
  validateOnDeps?: boolean;
  
  /**
   * Debounce delay for validation in milliseconds
   * @default 0
   */
  debounceMs?: number;
  
  /**
   * Default value to use before validation
   */
  defaultValue?: T;
  
  /**
   * Whether to clear error when new validation starts
   * @default true
   */
  clearErrorOnValidate?: boolean;
}

/**
 * Testing utilities configuration
 */
export interface TestingConfig extends IntegrationConfig {
  /**
   * Whether to use strict mode in tests
   * @default true
   */
  strict?: boolean;
  
  /**
   * Custom test timeout in milliseconds
   * @default 5000
   */
  timeout?: number;
  
  /**
   * Whether to include performance metrics in test results
   * @default false
   */
  includePerformanceMetrics?: boolean;
}

/**
 * Test assertion result
 */
export interface TestAssertionResult<T> {
  /**
   * Whether the assertion passed
   */
  passed: boolean;
  
  /**
   * The validated data (if assertion passed)
   */
  data?: T;
  
  /**
   * Error message (if assertion failed)
   */
  message?: string;
  
  /**
   * Detailed error information
   */
  error?: ValidationError;
  
  /**
   * Performance metrics
   */
  performance?: {
    validationTime: number;
    memoryUsage?: number;
  };
}