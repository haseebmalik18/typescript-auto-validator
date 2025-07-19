import { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { InterfaceInfo } from "../../types.js";
import { ValidatorFactory } from "../../validator/validator-factory.js";
import { ValidationError } from "../../validator/error-handler.js";
import { wrapValidation, createValidationContext } from "../utils.js";
import { IntegrationConfig } from "../types.js";

/**
 * Configuration for Next.js API route validation
 */
export interface NextApiValidationConfig extends IntegrationConfig {
  /** Validate request body */
  validateBody?: boolean;
  /** Validate query parameters */
  validateQuery?: boolean;
  /** Validate response data */
  validateResponse?: boolean;
  /** Custom error status code */
  errorStatusCode?: number;
  /** Include detailed error information */
  includeErrorDetails?: boolean;
  /** Custom error response formatter */
  formatError?: (error: ValidationError, req: NextApiRequest) => any;
  /** Skip validation for certain HTTP methods */
  skipMethods?: string[];
  /** Track performance metrics */
  trackPerformance?: boolean;
  /** Custom response formatter */
  formatResponse?: (data: any) => any;
}

/**
 * Extended Next.js API request with validated data
 */
export interface ValidatedNextApiRequest<TBody = any, TQuery = any>
  extends NextApiRequest {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
  validationMetadata?: {
    validationTime: number;
    validatedParts: string[];
  };
}

/**
 * Next.js API route validation middleware factory
 */
export class NextApiValidationMiddleware {
  private validatorFactory: ValidatorFactory;
  private defaultConfig: NextApiValidationConfig;

  constructor(config: NextApiValidationConfig = {}) {
    this.validatorFactory = new ValidatorFactory(config);
    this.defaultConfig = {
      validateBody: true,
      validateQuery: false,
      validateResponse: false,
      errorStatusCode: 400,
      includeErrorDetails: true,
      skipMethods: [],
      trackPerformance: true,
      enableLogging: false,
      ...config,
    };
  }

  /**
   * Create validation middleware for API routes
   */
  validate<TBody = any, TQuery = any, TResponse = any>(
    schemas: {
      body?: InterfaceInfo;
      query?: InterfaceInfo;
      response?: InterfaceInfo;
    },
    config: Partial<NextApiValidationConfig> = {},
  ) {
    const mergedConfig = { ...this.defaultConfig, ...config };

    return (handler: NextApiHandler) => {
      return async (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse | { error: string; message: string }>,
      ) => {
        const startTime = Date.now();
        const validatedParts: string[] = [];

        try {
          // Skip validation for certain methods
          if (mergedConfig.skipMethods?.includes(req.method || "")) {
            return handler(req, res);
          }

          // Validate request body
          if (schemas.body && mergedConfig.validateBody && req.body) {
            const bodyResult = await this.validateRequestPart(
              req.body,
              schemas.body,
              "body",
              req,
              mergedConfig,
            );
            req.validatedBody = bodyResult;
            validatedParts.push("body");
          }

          // Validate query parameters
          if (schemas.query && mergedConfig.validateQuery && req.query) {
            const queryResult = await this.validateRequestPart(
              req.query,
              schemas.query,
              "query",
              req,
              mergedConfig,
            );
            req.validatedQuery = queryResult;
            validatedParts.push("query");
          }

          // Add validation metadata
          if (mergedConfig.trackPerformance) {
            req.validationMetadata = {
              validationTime: Date.now() - startTime,
              validatedParts,
            };
          }

          // Wrap response validation if configured
          if (schemas.response && mergedConfig.validateResponse) {
            await this.wrapResponseValidation(
              res,
              schemas.response,
              mergedConfig,
            );
          }

          // Execute the original handler
          return handler(req, res);
        } catch (error) {
          this.handleValidationError(error, req, res, mergedConfig);
        }
      };
    };
  }

  /**
   * Validate only request body
   */
  validateBody<T>(
    schema: InterfaceInfo,
    config: Partial<NextApiValidationConfig> = {},
  ) {
    return this.validate<T>(
      { body: schema },
      { validateBody: true, ...config },
    );
  }

  /**
   * Validate only query parameters
   */
  validateQuery<T>(
    schema: InterfaceInfo,
    config: Partial<NextApiValidationConfig> = {},
  ) {
    return this.validate<any, T>(
      { query: schema },
      { validateQuery: true, ...config },
    );
  }

  /**
   * Validate only response data
   */
  validateResponse<T>(
    schema: InterfaceInfo,
    config: Partial<NextApiValidationConfig> = {},
  ) {
    return this.validate<any, any, T>(
      { response: schema },
      { validateResponse: true, ...config },
    );
  }

  // Private helper methods

  private async validateRequestPart(
    data: unknown,
    schema: InterfaceInfo,
    part: string,
    req: NextApiRequest,
    config: NextApiValidationConfig,
  ): Promise<any> {
    const validationContext = createValidationContext(
      `nextjs.api.${part}`,
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

    return result.data;
  }

  private async wrapResponseValidation(
    res: NextApiResponse,
    schema: InterfaceInfo,
    config: NextApiValidationConfig,
  ) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (obj: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const validationContext = createValidationContext(
            "nextjs.api.response",
          );
          const result = wrapValidation(
            () => {
              const validator = new ValidatorFactory().createValidator(schema);
              return validator(obj);
            },
            validationContext,
            config,
          );

          if (!result.success) {
            if (config.enableLogging) {
              console.warn(
                "Response validation failed:",
                result.error?.message,
              );
            }
          } else {
            obj = config.formatResponse
              ? config.formatResponse(result.data)
              : result.data;
          }
        } catch (error) {
          if (config.enableLogging) {
            console.warn("Response validation error:", error);
          }
        }
      }

      return originalJson(obj);
    };

    res.send = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const validationContext = createValidationContext(
            "nextjs.api.response",
          );
          const result = wrapValidation(
            () => {
              const validator = new ValidatorFactory().createValidator(schema);
              return validator(body);
            },
            validationContext,
            config,
          );

          if (!result.success) {
            if (config.enableLogging) {
              console.warn(
                "Response validation failed:",
                result.error?.message,
              );
            }
          } else {
            body = config.formatResponse
              ? config.formatResponse(result.data)
              : result.data;
          }
        } catch (error) {
          if (config.enableLogging) {
            console.warn("Response validation error:", error);
          }
        }
      }

      return originalSend(body);
    };
  }

  private handleValidationError(
    error: any,
    req: NextApiRequest,
    res: NextApiResponse,
    config: NextApiValidationConfig,
  ) {
    if (error instanceof ValidationError) {
      const statusCode = config.errorStatusCode || 400;
      const errorResponse = this.formatErrorResponse(error, req, config);

      return res.status(statusCode).json(errorResponse);
    }

    // Handle unexpected errors
    const errorResponse = {
      error: "Internal Server Error",
      message: "An unexpected error occurred during validation",
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    };

    return res.status(500).json(errorResponse);
  }

  private formatErrorResponse(
    error: ValidationError,
    req: NextApiRequest,
    config: NextApiValidationConfig,
  ) {
    if (config.formatError) {
      return config.formatError(error, req);
    }

    const baseResponse = {
      error: "Validation Error",
      message: error.message,
      timestamp: new Date().toISOString(),
      path: req.url,
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
 * Default validation middleware instance
 */
export const nextApiValidation = new NextApiValidationMiddleware();

/**
 * Convenience functions for common validation scenarios
 */

/**
 * Zero-config validation for API routes
 * Automatically validates request body based on the handler's type parameters
 */
export function withValidation<TBody = any, TQuery = any, TResponse = any>(
  schemas: {
    body?: InterfaceInfo;
    query?: InterfaceInfo;
    response?: InterfaceInfo;
  },
  config?: Partial<NextApiValidationConfig>,
) {
  return nextApiValidation.validate<TBody, TQuery, TResponse>(schemas, config);
}

/**
 * Validate request body only
 */
export function withBodyValidation<T>(
  schema: InterfaceInfo,
  config?: Partial<NextApiValidationConfig>,
) {
  return nextApiValidation.validateBody<T>(schema, config);
}

/**
 * Validate query parameters only
 */
export function withQueryValidation<T>(
  schema: InterfaceInfo,
  config?: Partial<NextApiValidationConfig>,
) {
  return nextApiValidation.validateQuery<T>(schema, config);
}

/**
 * Validate response data only
 */
export function withResponseValidation<T>(
  schema: InterfaceInfo,
  config?: Partial<NextApiValidationConfig>,
) {
  return nextApiValidation.validateResponse<T>(schema, config);
}

/**
 * Higher-order function for creating type-safe API routes
 */
export function createApiRoute<TBody = any, TQuery = any, TResponse = any>(
  schemas: {
    body?: InterfaceInfo;
    query?: InterfaceInfo;
    response?: InterfaceInfo;
  },
  handler: (
    req: ValidatedNextApiRequest<TBody, TQuery>,
    res: NextApiResponse<TResponse>,
  ) => void | Promise<void>,
  config?: Partial<NextApiValidationConfig>,
) {
  return withValidation<TBody, TQuery, TResponse>(schemas, config)(handler);
}

/**
 * Method-specific validation helpers
 */
export const apiRouteValidation = {
  /**
   * POST route with body validation
   */
  post<TBody, TResponse = any>(
    bodySchema: InterfaceInfo,
    handler: (
      req: ValidatedNextApiRequest<TBody>,
      res: NextApiResponse<TResponse>,
    ) => void | Promise<void>,
    config?: Partial<NextApiValidationConfig>,
  ) {
    return withBodyValidation<TBody>(bodySchema, {
      skipMethods: ["GET", "DELETE", "HEAD", "OPTIONS"],
      ...config,
    })(handler);
  },

  /**
   * PUT route with body validation
   */
  put<TBody, TResponse = any>(
    bodySchema: InterfaceInfo,
    handler: (
      req: ValidatedNextApiRequest<TBody>,
      res: NextApiResponse<TResponse>,
    ) => void | Promise<void>,
    config?: Partial<NextApiValidationConfig>,
  ) {
    return withBodyValidation<TBody>(bodySchema, {
      skipMethods: ["GET", "DELETE", "HEAD", "OPTIONS"],
      ...config,
    })(handler);
  },

  /**
   * GET route with query validation
   */
  get<TQuery, TResponse = any>(
    querySchema: InterfaceInfo,
    handler: (
      req: ValidatedNextApiRequest<any, TQuery>,
      res: NextApiResponse<TResponse>,
    ) => void | Promise<void>,
    config?: Partial<NextApiValidationConfig>,
  ) {
    return withQueryValidation<TQuery>(querySchema, {
      skipMethods: ["POST", "PUT", "PATCH", "DELETE"],
      ...config,
    })(handler);
  },

  /**
   * Universal route handler with method-based validation
   */
  handler<TBody = any, TQuery = any, TResponse = any>(
    schemas: {
      body?: InterfaceInfo;
      query?: InterfaceInfo;
      response?: InterfaceInfo;
    },
    handlers: {
      GET?: (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => void | Promise<void>;
      POST?: (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => void | Promise<void>;
      PUT?: (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => void | Promise<void>;
      DELETE?: (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => void | Promise<void>;
      PATCH?: (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => void | Promise<void>;
    },
    config?: Partial<NextApiValidationConfig>,
  ) {
    return withValidation<TBody, TQuery, TResponse>(
      schemas,
      config,
    )(
      async (
        req: ValidatedNextApiRequest<TBody, TQuery>,
        res: NextApiResponse<TResponse>,
      ) => {
        const method = req.method?.toUpperCase() as keyof typeof handlers;
        const handler = handlers[method];

        if (!handler) {
          return res.status(405).json({
            error: "Method Not Allowed",
            message: `Method ${req.method} not allowed`,
          } as any);
        }

        return handler(req, res);
      },
    );
  },
};
