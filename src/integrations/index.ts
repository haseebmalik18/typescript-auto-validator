import {
  expectValid,
  expectValidBatch,
  expectInvalid,
  expectInvalidBatch,
  benchmarkValidation,
  measureValidationPerformance,
  createTestValidator,
  validateTestData,
} from './testing/index.js';

export {
  useValidation,
  useAsyncValidation,
  useValidationEffect,
  ValidatedComponent,
  ValidationProvider,
  useValidationContext,
  withValidation as withReactValidation,
  validateProps,
  createValidatedHook,
} from './react/index.js';

export {
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validateRequest as expressValidateRequest,
  validateResponse,
  createValidationMiddleware,
  validationErrorHandler,
  extractRequestData,
  formatExpressError,
  createExpressValidator,
} from './express/index.js';

export {
  validateRequest as nextjsValidateRequest,
  validateApiRoute,
  createValidatedHandler,
  withValidation as withNextValidation,
  createValidatedRoute,
  createPageApiHandler,
  extractNextRequestData,
  formatNextError,
  createNextValidator,
} from './nextjs/index.js';

export {
  expectValid,
  expectValidBatch,
  expectInvalid,
  expectInvalidBatch,
  benchmarkValidation,
  measureValidationPerformance,
  createTestValidator,
  validateTestData,
};

export const TestingUtilities = {
  expectValid,
  expectValidBatch,
  expectInvalid,
  expectInvalidBatch,
  benchmarkValidation,
  measureValidationPerformance,
  createTestValidator,
  validateTestData,
};

export type {
  IntegrationConfig,
  ValidationResult as IntegrationValidationResult,
  RequestValidationOptions,
  ResponseValidationOptions,
  ValidationHookState,
  UseValidationOptions,
  TestingConfig,
  TestAssertionResult,
} from './types.js';

export {
  createValidationContext,
  wrapValidation,
  wrapAsyncValidation,
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
  debounce,
  isValidationError,
  PerformanceTracker,
} from './utils.js'; 