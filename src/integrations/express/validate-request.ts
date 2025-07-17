import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { RequestValidationOptions } from '../types.js';
import { 
  createValidationContext,
  wrapValidation,
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
} from '../utils.js';

/**
 * Validates Express request data against an interface
 */
export function validateRequest<T>(
  req: Request,
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
): T {
  const config = {
    validateBody: true,
    ...options,
  };

  const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, config);
  const context = createValidationContext(
    `express.validateRequest.${req.method}.${req.path}`,
    req
  );

  let dataToValidate: unknown;
  if (config.validateBody) {
    dataToValidate = req.body;
  } else if (config.validateQuery) {
    dataToValidate = req.query;
  } else if (config.validateParams) {
    dataToValidate = req.params;
  } else if (config.validateHeaders) {
    dataToValidate = req.headers;
  } else {
    throw new Error('No validation target specified');
  }

  const result = wrapValidation(
    () => validator(dataToValidate),
    context,
    config
  );

  if (!result.success && result.error) {
    throw result.error;
  }

  return result.data!;
} 