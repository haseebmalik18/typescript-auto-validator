// Express Integration for TypeScript Runtime Validator

export { 
  createValidationMiddleware,
  validateRequest,
  validateBody,
  validateQuery,
  validateParams,
  validateResponse,
  validationErrorHandler
} from './middleware.js';

export { validateHeaders } from './validate-headers.js';
export { extractRequestData, formatExpressError, createExpressValidator } from './utils.js';

export type { 
  ExpressValidationConfig,
  ValidatedRequest 
} from './middleware.js';

export type { RequestValidationOptions } from '../types.js'; 