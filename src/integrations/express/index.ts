// Express Integration for TypeScript Runtime Validator

export { validateBody } from './validate-body.js';
export { validateQuery } from './validate-query.js';
export { validateParams } from './validate-params.js';
export { validateHeaders } from './validate-headers.js';
export { validateRequest } from './validate-request.js';
export { validateResponse } from './validate-response.js';

// Combined middleware
export { createValidationMiddleware } from './middleware.js';

// Error handling
export { validationErrorHandler } from './error-handler.js';

// Utilities
export { 
  extractRequestData,
  formatExpressError,
  createExpressValidator,
} from './utils.js';

// Re-export Express-specific types
export type {
  RequestValidationOptions,
  ResponseValidationOptions,
} from '../types.js'; 