import { NextApiRequest } from 'next';
import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { RequestValidationOptions } from '../types.js';
import { 
  createValidationContext,
  wrapValidation,
} from '../utils.js';

/**
 * Validates Next.js API request data against an interface
 */
export function validateRequest<T>(
  req: NextApiRequest,
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
): T {
  const config = {
    validateBody: true,
    ...options,
  };

  const validator = new ValidatorFactory().createValidator<T>(interfaceInfo, config);
  const context = createValidationContext(
    `nextjs.validateRequest.${req.method}.${req.url}`,
    req
  );

  let dataToValidate: unknown;
  if (config.validateBody) {
    dataToValidate = req.body;
  } else if (config.validateQuery) {
    dataToValidate = req.query;
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