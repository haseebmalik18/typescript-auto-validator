import { NextApiRequest } from 'next';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Extracts data from Next.js request based on validation options
 */
export function extractNextRequestData(
  req: NextApiRequest,
  options: RequestValidationOptions
): unknown {
  if (options.validateBody) return req.body;
  if (options.validateQuery) return req.query;
  if (options.validateHeaders) return req.headers;
  return req.body; // Default to body
}

/**
 * Formats validation error for Next.js response
 */
export function formatNextError(
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
 * Creates a validator function for Next.js use
 */
export function createNextValidator<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
): (data: unknown) => T {
  return new ValidatorFactory().createValidator<T>(interfaceInfo, options);
} 