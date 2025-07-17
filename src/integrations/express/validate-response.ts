import { Response } from 'express';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { ResponseValidationOptions } from '../types.js';
import { 
  createValidationContext,
  wrapValidation,
  log,
} from '../utils.js';

/**
 * Validates Express response data against an interface
 */
export function validateResponse<T>(
  data: unknown,
  interfaceInfo: InterfaceInfo,
  options: ResponseValidationOptions = {}
): T {
  const config = {
    validateResponse: true,
    onResponseValidationError: 'log' as const,
    ...options,
  };

  const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, config);
  const context = createValidationContext(
    `express.validateResponse.${interfaceInfo.name}`
  );

  const result = wrapValidation(
    () => validator(data),
    context,
    config
  );

  if (!result.success && result.error) {
    if (config.onResponseValidationError === 'throw') {
      throw result.error;
    } else if (config.onResponseValidationError === 'log') {
      log(config, 'error', 'Response validation failed', {
        error: result.error.message,
      });
    }
    // If 'ignore', just return the data as-is
    return data as T;
  }

  return result.data!;
} 