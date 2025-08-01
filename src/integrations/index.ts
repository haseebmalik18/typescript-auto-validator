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
} from "./react/index.js";

export {
  createTypeScriptResolver,
  createFieldValidator,
  useValidatedForm,
  createNestedResolver,
  transformValidationErrors,
} from "./react/hook-form.js";

export {
  createValidatedQuery,
  createValidatedMutation,
  createValidatedInfiniteQuery,
  createValidatedQueryBundle,
  createOptimisticMutation,
} from "./react/query.js";

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
} from "./express/index.js";

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
} from "./nextjs/index.js";

export type {
  IntegrationConfig,
  ValidationResult as IntegrationValidationResult,
  RequestValidationOptions,
  ResponseValidationOptions,
  ValidationHookState,
  UseValidationOptions,
} from "./types.js";

export {
  createValidationContext,
  wrapValidation,
  wrapAsyncValidation,
  formatValidationErrorForHttp,
  shouldIncludeErrorDetails,
  debounce,
  isValidationError,
} from "./utils.js";