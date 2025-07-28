import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Express middleware for validating request headers
 */
export function validateHeaders<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  const validatorFactory = new ValidatorFactory(options);
  const validator = validatorFactory.createValidator<T>(interfaceInfo);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedHeaders = validator(req.headers) as T;
      // Extend request object with validated headers
      Object.defineProperty(req, 'validatedHeaders', {
        value: validatedHeaders,
        writable: false,
        enumerable: false,
        configurable: true
      });
      next();
    } catch (error) {
      const statusCode = options.errorStatusCode || 400;
      res.status(statusCode).json({
        error: 'Headers validation failed',
        message: error instanceof Error ? error.message : 'Invalid headers',
        details: options.includeErrorDetails ? error : undefined
      });
    }
  };
} 