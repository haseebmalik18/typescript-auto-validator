import { ValidationError } from '../validator/error-handler.js';
import { IntegrationConfig, ValidationContext, ValidationResult } from './types.js';

/**
 * Creates a standardized validation context
 */
export function createValidationContext(
  path: string,
  request?: unknown,
  response?: unknown,
  additionalContext?: Record<string, unknown>
): ValidationContext {
  return {
    path,
    request,
    response,
    context: additionalContext || {},
    startTime: Date.now(),
  };
}

/**
 * Wraps a validation function with error handling and logging
 */
export function wrapValidation<T>(
  validationFn: () => T,
  context: ValidationContext,
  config: IntegrationConfig = {}
): ValidationResult<T> {
  const startTime = performance.now();

  try {
    if (config.enableLogging) {
      log(config, 'info', `Starting validation at ${context.path}`, { context });
    }

    const data = validationFn();
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    if (config.enableLogging) {
      log(config, 'info', `Validation successful at ${context.path}`, {
        validationTime: `${validationTime.toFixed(2)}ms`,
      });
    }

    return {
      success: true,
      data,
      metadata: {
        validationTime,
        transformationsApplied: [], // Would be populated by transformation engine
        warnings: [],
      },
    };
  } catch (error) {
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    const validationError =
      error instanceof ValidationError ? error : new ValidationError(String(error), context.path);

    if (config.enableLogging) {
      log(config, 'error', `Validation failed at ${context.path}`, {
        error: validationError.message,
        validationTime: `${validationTime.toFixed(2)}ms`,
      });
    }

    // Call custom error handler if provided
    if (config.onError) {
      try {
        config.onError(validationError, context);
      } catch (handlerError) {
        if (config.enableLogging) {
          log(config, 'error', 'Error in custom error handler', {
            handlerError: String(handlerError),
          });
        }
      }
    }

    return {
      success: false,
      error: validationError,
      metadata: {
        validationTime,
        transformationsApplied: [],
        warnings: [],
      },
    };
  }
}

/**
 * Async version of wrapValidation
 */
export async function wrapAsyncValidation<T>(
  validationFn: () => Promise<T>,
  context: ValidationContext,
  config: IntegrationConfig = {}
): Promise<ValidationResult<T>> {
  const startTime = performance.now();

  try {
    if (config.enableLogging) {
      log(config, 'info', `Starting async validation at ${context.path}`, { context });
    }

    const data = await validationFn();
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    if (config.enableLogging) {
      log(config, 'info', `Async validation successful at ${context.path}`, {
        validationTime: `${validationTime.toFixed(2)}ms`,
      });
    }

    return {
      success: true,
      data,
      metadata: {
        validationTime,
        transformationsApplied: [],
        warnings: [],
      },
    };
  } catch (error) {
    const endTime = performance.now();
    const validationTime = endTime - startTime;

    const validationError =
      error instanceof ValidationError ? error : new ValidationError(String(error), context.path);

    if (config.enableLogging) {
      log(config, 'error', `Async validation failed at ${context.path}`, {
        error: validationError.message,
        validationTime: `${validationTime.toFixed(2)}ms`,
      });
    }

    // Call custom error handler if provided
    if (config.onError) {
      try {
        config.onError(validationError, context);
      } catch (handlerError) {
        if (config.enableLogging) {
          log(config, 'error', 'Error in custom error handler', {
            handlerError: String(handlerError),
          });
        }
      }
    }

    return {
      success: false,
      error: validationError,
      metadata: {
        validationTime,
        transformationsApplied: [],
        warnings: [],
      },
    };
  }
}

/**
 * Logging utility with customizable logger
 */
export function log(
  config: IntegrationConfig,
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: unknown
): void {
  if (!config.enableLogging) return;

  if (config.logger) {
    config.logger(message, level, data);
  } else {
    // Default console logging
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ts-auto-validator] [${level.toUpperCase()}]`;

    switch (level) {
      case 'info':
        console.info(`${prefix} ${message}`, data ? data : '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data ? data : '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data ? data : '');
        break;
    }
  }
}

/**
 * Formats validation error for HTTP responses
 */
export function formatValidationErrorForHttp(
  error: ValidationError,
  includeDetails: boolean = true
): {
  error: string;
  message: string;
  details?: {
    path?: string;
    expected?: string;
    received?: string;
    value?: unknown;
  };
} {
  const response = {
    error: 'Validation Error',
    message: error.message,
  };

  if (includeDetails) {
    return {
      ...response,
      details: {
        path: error.path,
        expected: error.expected,
        received: error.received,
        value: error.value,
      },
    };
  }

  return response;
}

/**
 * Determines if we should include error details based on environment
 */
export function shouldIncludeErrorDetails(
  explicitSetting?: boolean,
  nodeEnv: string = process.env.NODE_ENV || 'development'
): boolean {
  if (explicitSetting !== undefined) {
    return explicitSetting;
  }

  // Default: include details in development, exclude in production
  return nodeEnv === 'development';
}

/**
 * Creates a debounced function for validation
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Safely checks if a framework is available without throwing errors
 */
export function isFrameworkAvailable(frameworkName: string): boolean {
  try {
    require.resolve(frameworkName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current environment
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV;

  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Sanitizes error data for safe serialization
 */
export function sanitizeErrorForSerialization(error: ValidationError): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    path: error.path,
    expected: error.expected,
    received: error.received,
    // Don't include the raw value as it might contain sensitive data
    // value: error.value,
  };
}

/**
 * Creates a mock request object for testing purposes
 */
export function createMockRequest(data: unknown = {}): MockRequest {
  return {
    body: data,
    query: {},
    params: {},
    headers: {},
    method: 'POST',
    url: '/test',
    get: (_header: string) => undefined,
    header: (_header: string) => undefined,
  };
}

/**
 * Creates a mock response object for testing purposes
 */
export function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headersSent: false,
    locals: {},
    headers: {},
    _body: undefined,
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: unknown) {
      this._body = data;
      return this;
    },
    send: function (data: unknown) {
      this._body = data;
      return this;
    },
    setHeader: function (name: string, value: string) {
      this.headers = this.headers || {};
      this.headers[name] = value;
      return this;
    },
    end: function () {
      return this;
    },
  };
  return res;
}

/**
 * Type definitions for mock objects
 */
export interface MockRequest {
  body: unknown;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  headers: Record<string, unknown>;
  method: string;
  url: string;
  get: (header: string) => string | undefined;
  header: (header: string) => string | undefined;
}

export interface MockResponse {
  statusCode: number;
  headersSent: boolean;
  locals: Record<string, unknown>;
  headers: Record<string, unknown>;
  _body: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
  send: (data: unknown) => MockResponse;
  setHeader: (name: string, value: string) => MockResponse;
  end: () => MockResponse;
}
