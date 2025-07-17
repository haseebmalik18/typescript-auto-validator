// Next.js Integration for TypeScript Runtime Validator

export { validateRequest } from './validate-request.js';
export { validateApiRoute } from './validate-api-route.js';
export { createValidatedHandler } from './validated-handler.js';
export { withValidation } from './with-validation.js';

// App Router support (Next.js 13+)
export { createValidatedRoute } from './app-router.js';

// Pages API support (Next.js 12 and below)
export { createPageApiHandler } from './pages-api.js';

// Utilities
export { 
  extractNextRequestData,
  formatNextError,
  createNextValidator,
} from './utils.js';

// Re-export Next.js-specific types
export type {
  NextApiRequest,
  NextApiResponse,
  NextValidationOptions,
} from './types.js'; 