import { Request, Response, NextFunction } from "express";
import { InterfaceInfo } from "../../types.js";
import { ValidatorFactory } from "../../validator/validator-factory.js";
import { ValidationError } from "../../validator/error-handler.js";
import { wrapValidation, createValidationContext } from "../utils.js";
import { IntegrationConfig } from "../types.js";

/**
 * Configuration options for Express validation middleware
 */
export interface ExpressValidationConfig extends IntegrationConfig {
  /** Which parts of the request to validate */
  validateBody?: boolean;
  validateQuery?: boolean;
  validateParams?: boolean;
  validateHeaders?: boolean;

  /** Custom error status code */
  errorStatusCode?: number;

  /** Whether to include error details in response */
  includeErrorDetails?: boolean;

  /** Custom error response formatter */
  formatError?: (error: ValidationError, req: Request) => object;

  /** Whether to continue on validation errors (for logging/analytics) */
  continueOnError?: boolean;

  /** Custom success response formatter */
  formatSuccess?: <T>(data: T, req: Request) => T | unknown;

  /** Performance monitoring */
  trackPerformance?: boolean;

  /** Skip validation for certain conditions */
  skipValidation?: (req: Request) => boolean;
}

/**
 * Extended Request interface with validated data
 */
export interface ValidatedRequest<TBody = unknown, TQuery = unknown, TParams = unknown>
  extends Request {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
  validatedParams?: TParams;
  validationMetadata?: {
    validationTime: number;
    validatedParts: string[];
    warnings: string[];
  };
}

/**
 * Validation middleware factory for Express.js
 * Provides comprehensive request validation with type safety
 */
export class ExpressValidationMiddleware {
  private validatorFactory: ValidatorFactory;
  private defaultConfig: ExpressValidationConfig;

  constructor(config: ExpressValidationConfig = {}) {
    this.validatorFactory = new ValidatorFactory(config);
    this.defaultConfig = {
      validateBody: true,
      validateQuery: false,
      validateParams: false,
      validateHeaders: false,
      errorStatusCode: 400,
      includeErrorDetails: true,
      continueOnError: false,
      trackPerformance: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * Create middleware to validate request body
   */
  validateBody<T>(
    schema: InterfaceInfo,
    config: Partial<ExpressValidationConfig> = {},
  ) {
    return this.createValidationMiddleware<T>(schema, {
      validateBody: true,
      ...config,
    });
  }

  /**
   * Create middleware to validate query parameters
   */
  validateQuery<T>(
    schema: InterfaceInfo,
    config: Partial<ExpressValidationConfig> = {},
  ) {
    return this.createValidationMiddleware<T>(schema, {
      validateQuery: true,
      ...config,
    });
  }

  /**
   * Create middleware to validate URL parameters
   */
  validateParams<T>(
    schema: InterfaceInfo,
    config: Partial<ExpressValidationConfig> = {},
  ) {
    return this.createValidationMiddleware<T>(schema, {
      validateParams: true,
      ...config,
    });
  }

  /**
   * Create comprehensive middleware to validate multiple request parts
   */
  validateRequest<TBody = unknown, TQuery = unknown, TParams = unknown>(
    schemas: {
      body?: InterfaceInfo;
      query?: InterfaceInfo;
      params?: InterfaceInfo;
    },
    config: Partial<ExpressValidationConfig> = {},
  ) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    return async (
      req: ValidatedRequest<TBody, TQuery, TParams>,
      res: Response,
      next: NextFunction,
    ) => {
      const startTime = Date.now();
      const validatedParts: string[] = [];
      const warnings: string[] = [];

      try {
        // Skip validation if condition is met
        if (mergedConfig.skipValidation && mergedConfig.skipValidation(req)) {
          return next();
        }

        // Validate body
        if (schemas.body && mergedConfig.validateBody) {
          const bodyResult = await this.validateRequestPart<TBody>(
            req.body,
            schemas.body,
            "body",
            req,
            mergedConfig,
          );
          req.validatedBody = bodyResult;
          validatedParts.push("body");
        }

        // Validate query
        if (schemas.query && mergedConfig.validateQuery) {
          const queryResult = await this.validateRequestPart<TQuery>(
            req.query,
            schemas.query,
            "query",
            req,
            mergedConfig,
          );
          req.validatedQuery = queryResult;
          validatedParts.push("query");
        }

        // Validate params
        if (schemas.params && mergedConfig.validateParams) {
          const paramsResult = await this.validateRequestPart<TParams>(
            req.params,
            schemas.params,
            "params",
            req,
            mergedConfig,
          );
          req.validatedParams = paramsResult;
          validatedParts.push("params");
        }

        // Add validation metadata
        if (mergedConfig.trackPerformance) {
          req.validationMetadata = {
            validationTime: Date.now() - startTime,
            validatedParts,
            warnings,
          };
        }

        next();
      } catch (error) {
        this.handleValidationError(error, req, res, next, mergedConfig);
      }
    };
  }

  /**
   * Create middleware for response validation
   */
  validateResponse<T>(
    schema: InterfaceInfo,
    config: Partial<ExpressValidationConfig> = {},
  ) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      // Override res.send
      res.send = function (body: unknown) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const validationContext = createValidationContext(
              "express.response",
              req,
              res,
            );
            const result = wrapValidation(
              () => {
                const validator = new ValidatorFactory().createValidator<T>(
                  schema,
                );
                return validator(body);
              },
              validationContext,
              mergedConfig,
            );

            if (!result.success) {
              if (mergedConfig.enableLogging) {
                console.warn(
                  "Response validation failed:",
                  result.error?.message,
                );
              }
              // Continue with original response but log the issue
            } else {
              body = result.data;
            }
          } catch (error) {
            if (mergedConfig.enableLogging) {
              console.warn("Response validation error:", error);
            }
          }
        }

        return originalSend(body);
      };

      // Override res.json
      res.json = function (obj: unknown) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const validationContext = createValidationContext(
              "express.response",
              req,
              res,
            );
            const result = wrapValidation(
              () => {
                const validator = new ValidatorFactory().createValidator<T>(
                  schema,
                );
                return validator(obj);
              },
              validationContext,
              mergedConfig,
            );

            if (!result.success) {
              if (mergedConfig.enableLogging) {
                console.warn(
                  "Response validation failed:",
                  result.error?.message,
                );
              }
            } else {
              obj = result.data;
            }
          } catch (error) {
            if (mergedConfig.enableLogging) {
              console.warn("Response validation error:", error);
            }
          }
        }

        return originalJson(obj);
      };

      next();
    };
  }

  /**
   * Create error handling middleware for validation errors
   */
  errorHandler(config: Partial<ExpressValidationConfig> = {}) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      if (error instanceof ValidationError) {
        const statusCode = mergedConfig.errorStatusCode || 400;
        const errorResponse = this.formatErrorResponse(
          error,
          req,
          mergedConfig,
        );

        return res.status(statusCode).json(errorResponse);
      }

      // Pass non-validation errors to next error handler
      next(error);
    };
  }

  // Private helper methods

  private createValidationMiddleware<T>(
    schema: InterfaceInfo,
    config: ExpressValidationConfig,
  ) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    return async (
      req: ValidatedRequest<T>,
      res: Response,
      next: NextFunction,
    ) => {
      const startTime = Date.now();

      try {
        // Skip validation if condition is met
        if (mergedConfig.skipValidation && mergedConfig.skipValidation(req)) {
          return next();
        }

        let dataToValidate: unknown;
        let validationPath: string;

        if (mergedConfig.validateBody) {
          dataToValidate = req.body;
          validationPath = "body";
        } else if (mergedConfig.validateQuery) {
          dataToValidate = req.query;
          validationPath = "query";
        } else if (mergedConfig.validateParams) {
          dataToValidate = req.params;
          validationPath = "params";
        } else {
          dataToValidate = req.body;
          validationPath = "body";
        }

        const result = await this.validateRequestPart<T>(
          dataToValidate,
          schema,
          validationPath,
          req,
          mergedConfig,
        );

        // Store validated data
        if (mergedConfig.validateBody) {
          req.validatedBody = result;
        } else if (mergedConfig.validateQuery) {
          req.validatedQuery = result;
        } else if (mergedConfig.validateParams) {
          req.validatedParams = result;
        }

        // Add performance metadata
        if (mergedConfig.trackPerformance) {
          req.validationMetadata = {
            validationTime: Date.now() - startTime,
            validatedParts: [validationPath],
            warnings: [],
          };
        }

        next();
      } catch (error) {
        this.handleValidationError(error, req, res, next, mergedConfig);
      }
    };
  }

  private async validateRequestPart<T = unknown>(
    data: unknown,
    schema: InterfaceInfo,
    part: string,
    req: Request,
    config: ExpressValidationConfig,
  ): Promise<T> {
    const validationContext = createValidationContext(
      `express.${part}`,
      req,
      undefined,
    );

    const result = wrapValidation(
      () => {
        const validator = this.validatorFactory.createValidator(schema);
        return validator(data);
      },
      validationContext,
      config,
    );

    if (!result.success) {
      throw result.error;
    }

    return result.data as T;
  }

  private handleValidationError(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
    config: ExpressValidationConfig,
  ) {
    if (config.continueOnError) {
      // Log error but continue
      if (config.enableLogging) {
        console.warn("Validation error (continuing):", error);
      }
      return next();
    }

    if (error instanceof ValidationError) {
      const statusCode = config.errorStatusCode || 400;
      const errorResponse = this.formatErrorResponse(error, req, config);

      return res.status(statusCode).json(errorResponse);
    }

    // Pass non-validation errors to next error handler
    next(error);
  }

  private formatErrorResponse(
    error: ValidationError,
    req: Request,
    config: ExpressValidationConfig,
  ) {
    if (config.formatError) {
      return config.formatError(error, req);
    }

    const baseResponse = {
      error: "Validation Error",
      message: error.message,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    };

    if (config.includeErrorDetails) {
      return {
        ...baseResponse,
        details: {
          path: error.path,
          expected: error.expected,
          received: error.received,
          value: error.value,
        },
      };
    }

    return baseResponse;
  }
}

/**
 * Factory function to create validation middleware instances
 */
export function createValidationMiddleware(
  options?: ExpressValidationConfig,
): ExpressValidationMiddleware {
  return new ExpressValidationMiddleware(options);
}

/**
 * Default middleware instance with standard configuration
 */
export const expressValidation = new ExpressValidationMiddleware();

/**
 * Convenience functions for common validation scenarios
 */

/**
 * Validate request body against schema
 */
export function validateBody<T>(
  schema: InterfaceInfo,
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.validateBody<T>(schema, config);
}

/**
 * Validate query parameters against schema
 */
export function validateQuery<T>(
  schema: InterfaceInfo,
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.validateQuery<T>(schema, config);
}

/**
 * Validate URL parameters against schema
 */
export function validateParams<T>(
  schema: InterfaceInfo,
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.validateParams<T>(schema, config);
}

/**
 * Validate multiple request parts
 */
export function validateRequest<TBody = unknown, TQuery = unknown, TParams = unknown>(
  schemas: {
    body?: InterfaceInfo;
    query?: InterfaceInfo;
    params?: InterfaceInfo;
  },
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.validateRequest<TBody, TQuery, TParams>(
    schemas,
    config,
  );
}

/**
 * Validate response data
 */
export function validateResponse<T>(
  schema: InterfaceInfo,
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.validateResponse<T>(schema, config);
}

/**
 * Error handling middleware for validation errors
 */
export function validationErrorHandler(
  config?: Partial<ExpressValidationConfig>,
) {
  return expressValidation.errorHandler(config);
}
