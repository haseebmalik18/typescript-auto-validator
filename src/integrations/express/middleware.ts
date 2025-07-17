import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { 
  RequestValidationOptions,
  ValidationContext,
} from '../types.js';
import { 
  createValidationContext,
  wrapValidation,
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
  log,
} from '../utils.js';

/**
 * Express middleware that validates request data against TypeScript interfaces
 * 
 * @example
 * ```typescript
 * interface CreateUserRequest {
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 * 
 * app.post('/users', 
 *   createValidationMiddleware<CreateUserRequest>(createUserInterfaceInfo, {
 *     validateBody: true,
 *     validateQuery: false,
 *     validateParams: false,
 *   }),
 *   (req, res) => {
 *     // req.body is now guaranteed to match CreateUserRequest
 *     const user = createUser(req.body);
 *     res.json(user);
 *   }
 * );
 * ```
 */
export function createValidationMiddleware<T = any>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = {
      validateBody: true,
      validateQuery: false,
      validateParams: false,
      validateHeaders: false,
      errorStatusCode: 400,
      includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
      ...options,
    };
    
    try {
      const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, config);
      const context = createValidationContext(
        `express.${req.method}.${req.path}`,
        req,
        res
      );
      
      if (config.enableLogging) {
        log(config, 'info', `Validating request ${req.method} ${req.path}`, {
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
        
        if (queryResult.data !== undefined) {
          req.query = queryResult.data as any;
        }
      }
      
      // Validate URL parameters
      if (config.validateParams && Object.keys(req.params).length > 0) {
        const paramsResult = wrapValidation(
          () => validator(req.params),
          { ...context, path: `${context.path}.params` },
          config
        );
        
        if (!paramsResult.success && paramsResult.error) {
          throw paramsResult.error;
        }
        
        if (paramsResult.data !== undefined && paramsResult.data !== null) {
          req.params = paramsResult.data as any;
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
        log(config, 'info', `Request validation successful for ${req.method} ${req.path}`);
      }
      
      next();
    } catch (error) {
      if (config.enableLogging) {
        log(config, 'error', `Request validation failed for ${req.method} ${req.path}`, {
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
 * Specialized middleware for validating only request body
 * 
 * @example
 * ```typescript
 * app.post('/users', 
 *   validateBodyMiddleware<CreateUserRequest>(createUserInterfaceInfo),
 *   (req, res) => {
 *     // req.body is validated
 *     res.json(req.body);
 *   }
 * );
 * ```
 */
export function validateBodyMiddleware<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: true,
    validateQuery: false,
    validateParams: false,
    validateHeaders: false,
  });
}

/**
 * Specialized middleware for validating only query parameters
 */
export function validateQueryMiddleware<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: false,
    validateQuery: true,
    validateParams: false,
    validateHeaders: false,
  });
}

/**
 * Specialized middleware for validating only URL parameters
 */
export function validateParamsMiddleware<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: false,
    validateQuery: false,
    validateParams: true,
    validateHeaders: false,
  });
}

/**
 * Middleware that validates multiple request parts with different schemas
 * 
 * @example
 * ```typescript
 * app.post('/users/:id', 
 *   validateMultipleMiddleware({
 *     body: createUserBodyInterfaceInfo,
 *     params: userParamsInterfaceInfo,
 *     query: userQueryInterfaceInfo,
 *   }),
 *   (req, res) => {
 *     // All parts are validated
 *     res.json({ body: req.body, params: req.params, query: req.query });
 *   }
 * );
 * ```
 */
export function validateMultipleMiddleware(schemas: {
  body?: InterfaceInfo;
  query?: InterfaceInfo;
  params?: InterfaceInfo;
  headers?: InterfaceInfo;
}, options: RequestValidationOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = {
      errorStatusCode: 400,
      includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
      ...options,
    };
    
    try {
      const context = createValidationContext(
        `express.${req.method}.${req.path}`,
        req,
        res
      );
      
      // Validate each part with its own schema
      if (schemas.body && req.body !== undefined) {
        const validator = new ValidatorFactory().createValidator(schemas.body, config);
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
      
      if (schemas.query && Object.keys(req.query).length > 0) {
        const validator = new ValidatorFactory().createValidator(schemas.query, config);
        const result = wrapValidation(
          () => validator(req.query),
          { ...context, path: `${context.path}.query` },
          config
        );
        
        if (!result.success && result.error) {
          throw result.error;
        }
        
        if (result.data !== undefined) {
          req.query = result.data as any;
        }
      }
      
      if (schemas.params && Object.keys(req.params).length > 0) {
        const validator = new ValidatorFactory().createValidator(schemas.params, config);
        const result = wrapValidation(
          () => validator(req.params),
          { ...context, path: `${context.path}.params` },
          config
        );
        
        if (!result.success && result.error) {
          throw result.error;
        }
        
        if (result.data !== undefined && result.data !== null) {
          req.params = result.data as any;
        }
      }
      
      if (schemas.headers) {
        const validator = new ValidatorFactory().createValidator(schemas.headers, config);
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
      
      next();
    } catch (error) {
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

/**
 * Middleware for async validation with Express
 * Useful when validation involves async operations like database lookups
 */
export function createAsyncValidationMiddleware<T>(
  interfaceInfo: InterfaceInfo,
  asyncValidator: (data: T, req: Request, res: Response) => Promise<T>,
  options: RequestValidationOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = {
      validateBody: true,
      errorStatusCode: 400,
      includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
      ...options,
    };
    
    try {
      // First, run standard validation
      const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, config);
      const context = createValidationContext(
        `express.async.${req.method}.${req.path}`,
        req,
        res
      );
      
      let dataToValidate: unknown;
      if (config.validateBody) {
        dataToValidate = req.body;
      } else if (config.validateQuery) {
        dataToValidate = req.query;
      } else if (config.validateParams) {
        dataToValidate = req.params;
      } else {
        throw new Error('No validation target specified');
      }
      
      const basicResult = wrapValidation(
        () => validator(dataToValidate),
        context,
        config
      );
      
      if (!basicResult.success && basicResult.error) {
        throw basicResult.error;
      }
      
      // Then run async validation
      if (basicResult.data !== undefined) {
        const asyncResult = await asyncValidator(basicResult.data, req, res);
        
        // Update the appropriate request property
        if (config.validateBody) {
          req.body = asyncResult;
        } else if (config.validateQuery) {
          req.query = asyncResult as any;
        } else if (config.validateParams) {
          req.params = asyncResult as any;
        }
      }
      
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        const errorResponse = formatValidationErrorForHttp(error, config.includeErrorDetails);
        res.status(config.errorStatusCode).json(errorResponse);
      } else {
        const errorResponse = {
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during async validation',
          ...(config.includeErrorDetails && { 
            details: { originalError: String(error) } 
          }),
        };
        res.status(500).json(errorResponse);
      }
    }
  };
} 