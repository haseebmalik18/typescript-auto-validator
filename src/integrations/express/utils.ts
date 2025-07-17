import { Request, Response } from 'express';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Extracts data from Express request based on validation options
 */
export function extractRequestData(
  req: Request,
  options: RequestValidationOptions
): unknown {
  if (options.validateBody) return req.body;
  if (options.validateQuery) return req.query;
  if (options.validateParams) return req.params;
  if (options.validateHeaders) return req.headers;
  return req.body; // Default to body
}

/**
 * Formats validation error for Express response
 */
export function formatExpressError(
  error: any, // Changed from ValidationError to any as ValidationError is no longer imported
  includeDetails: boolean = true
): any {
  return {
    error: 'Validation Error',
    message: error.message,
    ...(includeDetails && {
      details: {
        path: error.path,
        expected: error.expected,
        received: error.received,
      }
    })
  };
}

/**
 * Creates a validator function for Express use
 */
export function createExpressValidator<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
): (data: unknown) => T {
  return new ValidatorFactory().createValidator<T>(interfaceInfo, options);
} 