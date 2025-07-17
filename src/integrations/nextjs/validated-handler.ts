import { NextApiRequest, NextApiResponse } from 'next';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { RequestValidationOptions } from '../types.js';
import { 
  createValidationContext,
  wrapValidation,
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
  log,
} from '../utils.js';

/**
 * Next.js API route handler with built-in validation
 * 
 * @example
 * ```typescript
 * // pages/api/users.ts
 * interface CreateUserRequest {
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 * 
 * interface UserResponse {
 *   id: string;
 *   name: string;
 *   email: string;
 *   createdAt: Date;
 * }
 * 
 * export default createValidatedHandler<CreateUserRequest, UserResponse>(
 *   createUserRequestInterfaceInfo,
 *   {
 *     validateBody: true,
 *     methods: ['POST'],
 *   },
 *   async (req, res) => {
 *     // req.body is guaranteed to match CreateUserRequest
 *     const user = await createUser(req.body);
 *     res.status(201).json(user);
 *   }
 * );
 * ```
 */
export function createValidatedHandler<TRequest = any, TResponse = any>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions & {
    methods?: string[];
    validateResponse?: boolean;
    responseInterfaceInfo?: InterfaceInfo;
  } = {},
  handler: (req: NextApiRequest, res: NextApiResponse<TResponse>) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const config = {
      validateBody: true,
      validateQuery: false,
      validateParams: false,
      validateHeaders: false,
      errorStatusCode: 400,
      includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
      methods: ['POST', 'PUT', 'PATCH'],
      validateResponse: false,
      ...options,
    };
    
    try {
      // Check HTTP method
      if (config.methods && config.methods.length > 0) {
        if (!req.method || !config.methods.includes(req.method)) {
          res.status(405).json({
            error: 'Method Not Allowed',
            message: `Method ${req.method} not allowed. Allowed methods: ${config.methods.join(', ')}`,
            allowedMethods: config.methods,
          } as any);
          return;
        }
      }
      
      const validator = new ValidatorFactory().createValidator<TRequest>(interfaceInfo, config);
      const context = createValidationContext(
        `nextjs.${req.method}.${req.url}`,
        req,
        res
      );
      
      if (config.enableLogging) {
        log(config, 'info', `Validating Next.js API request ${req.method} ${req.url}`, {
          validateBody: config.validateBody,
          validateQuery: config.validateQuery,
          validateParams: config.validateParams,
          validateHeaders: config.validateHeaders,
        });
      }
      
      // Validate request body
      if (config.validateBody && req.body !== undefined) {
        const bodyResult = wrapValidation(
          () => validator(req.body),
          { ...context, path: `${context.path}.body` },
          config
        );
        
        if (!bodyResult.success && bodyResult.error) {
          throw bodyResult.error;
        }
        
        if (bodyResult.data !== undefined) {
          req.body = bodyResult.data;
        }
      }
      
      // Validate query parameters
      if (config.validateQuery && Object.keys(req.query).length > 0) {
        const queryResult = wrapValidation(
          () => validator(req.query),
          { ...context, path: `${context.path}.query` },
          config
        );
        
        if (!queryResult.success && queryResult.error) {
          throw queryResult.error;
        }
        
        if (queryResult.data !== undefined && queryResult.data !== null) {
          req.query = queryResult.data as any;
        }
      }
      
      // Validate headers
      if (config.validateHeaders) {
        const headersResult = wrapValidation(
          () => validator(req.headers),
          { ...context, path: `${context.path}.headers` },
          config
        );
        
        if (!headersResult.success && headersResult.error) {
          throw headersResult.error;
        }
        
        if (headersResult.data !== undefined && headersResult.data !== null) {
          req.headers = headersResult.data as any;
        }
      }
      
      if (config.enableLogging) {
        log(config, 'info', `Request validation successful for ${req.method} ${req.url}`);
      }
      
      // Wrap response to validate output if requested
      if (config.validateResponse && config.responseInterfaceInfo) {
        const originalJson = res.json.bind(res);
        const responseValidator = new ValidatorFactory().createValidator(config.responseInterfaceInfo, config);
        
        res.json = function(data: any) {
          try {
            const validatedResponse = responseValidator(data);
            return originalJson(validatedResponse);
          } catch (responseError) {
            if (config.enableLogging) {
              log(config, 'error', 'Response validation failed', {
                error: responseError instanceof Error ? responseError.message : String(responseError),
              });
            }
            
            // In development, return the validation error
            // In production, return a generic error
            if (shouldIncludeErrorDetails(config.includeErrorDetails)) {
              return originalJson({
                error: 'Response Validation Error',
                message: responseError instanceof ValidationError 
                  ? responseError.message 
                  : 'Response does not match expected schema',
                details: responseError instanceof ValidationError 
                  ? formatValidationErrorForHttp(responseError, true).details 
                  : undefined,
              });
            } else {
              return originalJson({
                error: 'Internal Server Error',
                message: 'An error occurred while processing the response',
              });
            }
          }
        };
      }
      
      // Call the actual handler
      await handler(req, res);
      
    } catch (error) {
      if (config.enableLogging) {
        log(config, 'error', `Request validation failed for ${req.method} ${req.url}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      if (error instanceof ValidationError) {
        const errorResponse = formatValidationErrorForHttp(error, config.includeErrorDetails);
        res.status(config.errorStatusCode).json(errorResponse);
      } else {
        // Handle unexpected errors
        const errorResponse = {
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during validation',
          ...(config.includeErrorDetails && { 
            details: { originalError: String(error) } 
          }),
        };
        res.status(500).json(errorResponse);
      }
    }
  };
}

/**
 * Simplified handler for common use cases
 * 
 * @example
 * ```typescript
 * // pages/api/users.ts
 * export default validateBody<CreateUserRequest>(
 *   createUserRequestInterfaceInfo,
 *   async (req, res) => {
 *     const user = await createUser(req.body);
 *     res.json(user);
 *   }
 * );
 * ```
 */
export function validateBody<T>(
  interfaceInfo: InterfaceInfo,
  handler: (req: NextApiRequest & { body: T }, res: NextApiResponse) => Promise<void> | void,
  options: RequestValidationOptions = {}
) {
  return createValidatedHandler<T>(
    interfaceInfo,
    {
      ...options,
      validateBody: true,
      validateQuery: false,
      validateParams: false,
      validateHeaders: false,
    },
    handler as any
  );
}

/**
 * Handler that validates query parameters
 */
export function validateQuery<T>(
  interfaceInfo: InterfaceInfo,
  handler: (req: NextApiRequest & { query: T }, res: NextApiResponse) => Promise<void> | void,
  options: RequestValidationOptions = {}
) {
  return createValidatedHandler<T>(
    interfaceInfo,
    {
      ...options,
      validateBody: false,
      validateQuery: true,
      validateParams: false,
      validateHeaders: false,
      methods: ['GET', 'DELETE'],
    },
    handler as any
  );
}

/**
 * Handler for REST-style APIs with different schemas per method
 * 
 * @example
 * ```typescript
 * // pages/api/users/[id].ts
 * export default createRestHandler({
 *   GET: {
 *     query: getUserQueryInterfaceInfo,
 *     handler: async (req, res) => {
 *       const user = await getUser(req.query.id);
 *       res.json(user);
 *     }
 *   },
 *   PUT: {
 *     body: updateUserInterfaceInfo,
 *     query: userParamsInterfaceInfo,
 *     handler: async (req, res) => {
 *       const user = await updateUser(req.query.id, req.body);
 *       res.json(user);
 *     }
 *   },
 *   DELETE: {
 *     query: userParamsInterfaceInfo,
 *     handler: async (req, res) => {
 *       await deleteUser(req.query.id);
 *       res.status(204).end();
 *     }
 *   }
 * });
 * ```
 */
export function createRestHandler(methodHandlers: {
  [method: string]: {
    body?: InterfaceInfo;
    query?: InterfaceInfo;
    params?: InterfaceInfo;
    headers?: InterfaceInfo;
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;
    options?: RequestValidationOptions;
  };
}, globalOptions: RequestValidationOptions = {}) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const method = req.method?.toUpperCase();
    
    if (!method || !methodHandlers[method]) {
      res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method ${method} not allowed`,
        allowedMethods: Object.keys(methodHandlers),
      });
      return;
    }
    
    const methodConfig = methodHandlers[method];
    const config = {
      ...globalOptions,
      ...methodConfig.options,
      errorStatusCode: globalOptions.errorStatusCode || 400,
      includeErrorDetails: shouldIncludeErrorDetails(globalOptions.includeErrorDetails),
    };
    
    try {
      const context = createValidationContext(
        `nextjs.rest.${method}.${req.url}`,
        req,
        res
      );
      
      // Validate each part with its schema
      if (methodConfig.body && req.body !== undefined) {
        const validator = new ValidatorFactory().createValidator(methodConfig.body, config);
        const result = wrapValidation(
          () => validator(req.body),
          { ...context, path: `${context.path}.body` },
          config
        );
        
        if (!result.success && result.error) {
          throw result.error;
        }
        
        if (result.data !== undefined) {
          req.body = result.data;
        }
      }
      
      if (methodConfig.query && Object.keys(req.query).length > 0) {
        const validator = new ValidatorFactory().createValidator(methodConfig.query, config);
        const result = wrapValidation(
          () => validator(req.query),
          { ...context, path: `${context.path}.query` },
          config
        );
        
        if (!result.success && result.error) {
          throw result.error;
        }
        
        if (result.data !== undefined && result.data !== null) {
          req.query = result.data as any;
        }
      }
      
      if (methodConfig.headers) {
        const validator = new ValidatorFactory().createValidator(methodConfig.headers, config);
        const result = wrapValidation(
          () => validator(req.headers),
          { ...context, path: `${context.path}.headers` },
          config
        );
        
        if (!result.success && result.error) {
          throw result.error;
        }
        
        if (result.data !== undefined && result.data !== null) {
          req.headers = result.data as any;
        }
      }
      
      // Call the method-specific handler
      await methodConfig.handler(req, res);
      
    } catch (error) {
      if (config.enableLogging) {
        log(config, 'error', `REST handler validation failed for ${method} ${req.url}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      if (error instanceof ValidationError) {
        const errorResponse = formatValidationErrorForHttp(error, config.includeErrorDetails);
        res.status(config.errorStatusCode).json(errorResponse);
      } else {
        const errorResponse = {
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during validation',
          ...(config.includeErrorDetails && { 
            details: { originalError: String(error) } 
          }),
        };
        res.status(500).json(errorResponse);
      }
    }
  };
} 