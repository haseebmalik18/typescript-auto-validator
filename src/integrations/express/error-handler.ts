import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../validator/error-handler.js';
import { RequestValidationOptions } from '../types.js';
import { 
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
  log,
} from '../utils.js';

/**
 * Express error handler middleware for validation errors
 */
export function validationErrorHandler(
  options: RequestValidationOptions = {}
) {
  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const config = {
      errorStatusCode: 400,
      includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
      ...options,
    };

    if (error instanceof ValidationError) {
      if (config.enableLogging) {
        log(config, 'error', `Validation error in ${req.method} ${req.path}`, {
          error: error.message,
          path: error.path,
        });
      }

      const errorResponse = formatValidationErrorForHttp(error, config.includeErrorDetails);
      res.status(config.errorStatusCode).json(errorResponse);
      return;
    }

    // Not a validation error, pass to next error handler
    next(error);
  };
} 