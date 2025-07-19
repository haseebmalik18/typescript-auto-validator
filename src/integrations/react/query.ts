import { InterfaceInfo } from "../../types.js";
import { ValidatorFactory } from "../../validator/validator-factory.js";
import { wrapValidation, createValidationContext } from "../utils.js";
import { IntegrationConfig } from "../types.js";

/**
 * Configuration for React Query integration
 */
export interface ReactQueryConfig extends IntegrationConfig {
  /** Automatically validate query responses */
  autoValidateQueries?: boolean;
  /** Automatically validate mutation inputs */
  autoValidateMutations?: boolean;
  /** Cache validation results */
  cacheValidation?: boolean;
  /** Retry failed validations */
  retryValidation?: boolean;
  /** Custom error handling */
  onValidationError?: (error: any, queryKey: any) => void;
  /** Transform data after validation */
  transformData?: (data: any) => any;
}

/**
 * Validated query options
 */
export interface ValidatedQueryOptions<TData = any, TError = any> {
  /** Interface schema for response validation */
  responseSchema?: InterfaceInfo;
  /** Query key for caching */
  queryKey: any[];
  /** Query function */
  queryFn: () => Promise<any>;
  /** Enable validation */
  enableValidation?: boolean;
  /** Validation configuration */
  validationConfig?: ReactQueryConfig;
  /** Additional React Query options */
  queryOptions?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: boolean | number;
  };
}

/**
 * Validated mutation options
 */
export interface ValidatedMutationOptions<
  TData = any,
  TVariables = any,
  TError = any,
> {
  /** Interface schema for input validation */
  inputSchema?: InterfaceInfo;
  /** Interface schema for response validation */
  responseSchema?: InterfaceInfo;
  /** Mutation function */
  mutationFn: (variables: TVariables) => Promise<any>;
  /** Enable input validation */
  validateInput?: boolean;
  /** Enable response validation */
  validateResponse?: boolean;
  /** Validation configuration */
  validationConfig?: ReactQueryConfig;
  /** Mutation callbacks */
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables) => void;
  onMutate?: (variables: TVariables) => void;
}

/**
 * Creates a validated query hook
 */
export function createValidatedQuery<TData = any, TError = any>(
  options: ValidatedQueryOptions<TData, TError>,
) {
  const {
    responseSchema,
    queryKey,
    queryFn,
    enableValidation = true,
    validationConfig = {},
    queryOptions = {},
  } = options;

  const validatorFactory = new ValidatorFactory(validationConfig);

  // This would integrate with React Query's useQuery hook
  const validatedQueryFn = async (): Promise<TData> => {
    const startTime = Date.now();

    try {
      // Execute original query function
      const rawData = await queryFn();

      // Validate response if schema is provided
      if (enableValidation && responseSchema) {
        const validator =
          validatorFactory.createValidator<TData>(responseSchema);
        const context = createValidationContext(
          `react-query.${queryKey.join(".")}`,
        );

        const result = wrapValidation(
          () => validator(rawData),
          context,
          validationConfig,
        );

        if (!result.success && result.error) {
          if (validationConfig.onValidationError) {
            validationConfig.onValidationError(result.error, queryKey);
          }
          throw result.error;
        }

        const validatedData = result.data!;

        // Apply data transformation if configured
        return validationConfig.transformData
          ? validationConfig.transformData(validatedData)
          : validatedData;
      }

      return rawData;
    } catch (error) {
      if (validationConfig.onValidationError) {
        validationConfig.onValidationError(error, queryKey);
      }
      throw error;
    }
  };

  return {
    queryKey,
    queryFn: validatedQueryFn,
    queryOptions,
    validationConfig,
  };
}

/**
 * Creates a validated mutation hook
 */
export function createValidatedMutation<
  TData = any,
  TVariables = any,
  TError = any,
>(options: ValidatedMutationOptions<TData, TVariables, TError>) {
  const {
    inputSchema,
    responseSchema,
    mutationFn,
    validateInput = true,
    validateResponse = true,
    validationConfig = {},
    onSuccess,
    onError,
    onMutate,
  } = options;

  const validatorFactory = new ValidatorFactory(validationConfig);

  const validatedMutationFn = async (variables: TVariables): Promise<TData> => {
    const startTime = Date.now();

    try {
      // Validate input if schema is provided
      if (validateInput && inputSchema) {
        const inputValidator =
          validatorFactory.createValidator<TVariables>(inputSchema);
        const inputContext = createValidationContext(
          "react-query.mutation.input",
        );

        const inputResult = wrapValidation(
          () => inputValidator(variables),
          inputContext,
          validationConfig,
        );

        if (!inputResult.success && inputResult.error) {
          if (validationConfig.onValidationError) {
            validationConfig.onValidationError(inputResult.error, variables);
          }
          throw inputResult.error;
        }
      }

      // Execute mutation
      const rawData = await mutationFn(variables);

      // Validate response if schema is provided
      if (validateResponse && responseSchema) {
        const responseValidator =
          validatorFactory.createValidator<TData>(responseSchema);
        const responseContext = createValidationContext(
          "react-query.mutation.response",
        );

        const responseResult = wrapValidation(
          () => responseValidator(rawData),
          responseContext,
          validationConfig,
        );

        if (!responseResult.success && responseResult.error) {
          if (validationConfig.onValidationError) {
            validationConfig.onValidationError(responseResult.error, variables);
          }
          throw responseResult.error;
        }

        return responseResult.data!;
      }

      return rawData;
    } catch (error) {
      if (onError) {
        onError(error as TError, variables);
      }
      throw error;
    }
  };

  return {
    mutationFn: validatedMutationFn,
    onSuccess,
    onError,
    onMutate,
    validationConfig,
  };
}

/**
 * Infinite query support with validation
 */
export function createValidatedInfiniteQuery<TData = any, TError = any>(
  options: ValidatedQueryOptions<TData, TError> & {
    getNextPageParam: (lastPage: TData, pages: TData[]) => any;
    getPreviousPageParam?: (firstPage: TData, pages: TData[]) => any;
  },
) {
  const baseQuery = createValidatedQuery(options);

  return {
    ...baseQuery,
    getNextPageParam: options.getNextPageParam,
    getPreviousPageParam: options.getPreviousPageParam,
  };
}

/**
 * Batch validation for multiple queries
 */
export function createValidatedQueryBundle<T extends Record<string, any>>(
  queries: {
    [K in keyof T]: ValidatedQueryOptions<T[K]>;
  },
  config: ReactQueryConfig = {},
) {
  const validatedQueries = Object.entries(queries).map(
    ([key, queryOptions]) => ({
      key,
      ...createValidatedQuery(queryOptions as ValidatedQueryOptions),
    }),
  );

  return {
    queries: validatedQueries,
    config,
    // Helper method to get all query keys
    getQueryKeys: () => validatedQueries.map((q) => q.queryKey),
  };
}

/**
 * Optimistic updates with validation
 */
export function createOptimisticMutation<
  TData = any,
  TVariables = any,
  TError = any,
>(
  options: ValidatedMutationOptions<TData, TVariables, TError> & {
    optimisticUpdate: (variables: TVariables) => TData;
    rollback: (
      error: TError,
      variables: TVariables,
      previousData?: TData,
    ) => void;
  },
) {
  const baseMutation = createValidatedMutation(options);

  return {
    ...baseMutation,
    optimisticUpdate: options.optimisticUpdate,
    rollback: options.rollback,
  };
}
