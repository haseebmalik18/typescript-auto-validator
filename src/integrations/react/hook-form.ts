import { InterfaceInfo } from "../../types.js";
import { ValidatorFactory } from "../../validator/validator-factory.js";
import { wrapValidation, createValidationContext } from "../utils.js";
import { IntegrationConfig } from "../types.js";

/**
 * Configuration for React Hook Form integration
 */
export interface ReactHookFormConfig extends IntegrationConfig {
  /** Mode for validation timing */
  mode?: "onChange" | "onBlur" | "onSubmit" | "onTouched" | "all";
  /** Revalidate mode after submission */
  reValidateMode?: "onChange" | "onBlur" | "onSubmit";
  /** Custom error message formatter */
  formatError?: (error: any, field: string) => string;
  /** Focus on first error */
  shouldFocusError?: boolean;
  /** Custom field validation */
  shouldUseNativeValidation?: boolean;
}

/**
 * Resolver function type for React Hook Form
 */
export type Resolver<T = any> = (
  values: T,
  context?: any,
  options?: { criteriaMode?: "firstError" | "all"; fields?: any; names?: any },
) => Promise<{
  values: T;
  errors: Record<string, { type: string; message: string }>;
}>;

/**
 * Creates a React Hook Form resolver from TypeScript interface
 */
export function createTypeScriptResolver<T extends Record<string, any>>(
  interfaceInfo: InterfaceInfo,
  config: ReactHookFormConfig = {},
): Resolver<T> {
  const validatorFactory = new ValidatorFactory(config);

  return async (
    values: T,
    context?: any,
    options?: any,
  ): Promise<{
    values: T;
    errors: Record<string, { type: string; message: string }>;
  }> => {
    try {
      const validator = validatorFactory.createValidator<T>(interfaceInfo);
      const validationContext = createValidationContext("react-hook-form", {
        values,
        context,
        options,
      });

      const result = wrapValidation(
        () => validator(values),
        validationContext,
        config,
      );

      if (result.success) {
        return {
          values: result.data!,
          errors: {},
        };
      }

      // Convert validation error to React Hook Form format
      const errors: Record<string, { type: string; message: string }> = {};

      if (result.error) {
        const fieldPath = result.error.path || "root";
        const message = config.formatError
          ? config.formatError(result.error, fieldPath)
          : result.error.message;

        errors[fieldPath] = {
          type: "validation",
          message,
        };
      }

      return {
        values: {} as T,
        errors,
      };
    } catch (error) {
      return {
        values: {} as T,
        errors: {
          root: {
            type: "validation",
            message:
              error instanceof Error ? error.message : "Validation failed",
          },
        },
      };
    }
  };
}

/**
 * Creates field-level validation for React Hook Form
 */
export function createFieldValidator<T = any>(
  interfaceInfo: InterfaceInfo,
  fieldName: keyof T,
  config: ReactHookFormConfig = {},
) {
  const validatorFactory = new ValidatorFactory(config);

  return async (value: any): Promise<string | boolean> => {
    try {
      // Create a temporary object with just this field for validation
      const tempObject = { [fieldName]: value } as Partial<T>;
      const validator =
        validatorFactory.createValidator<Partial<T>>(interfaceInfo);

      const result = wrapValidation(
        () => validator(tempObject),
        createValidationContext(`react-hook-form.field.${String(fieldName)}`),
        config,
      );

      if (result.success) {
        return true;
      }

      const message = config.formatError
        ? config.formatError(result.error, String(fieldName))
        : result.error?.message || "Validation failed";

      return message;
    } catch (error) {
      return error instanceof Error ? error.message : "Validation failed";
    }
  };
}

/**
 * Hook for creating validated form with React Hook Form
 */
export function useValidatedForm<T extends Record<string, any>>(
  interfaceInfo: InterfaceInfo,
  options: ReactHookFormConfig & {
    defaultValues?: Partial<T>;
    onSubmit?: (data: T) => void | Promise<void>;
  } = {},
) {
  const resolver = createTypeScriptResolver<T>(interfaceInfo, options);

  // This would be used with React Hook Form's useForm hook
  // const form = useForm<T>({ resolver, ...options });

  return {
    resolver,
    validateField: createFieldValidator<T>(
      interfaceInfo,
      "" as keyof T,
      options,
    ),
    config: options,
  };
}

/**
 * Schema-based validation for complex nested forms
 */
export function createNestedResolver<T extends Record<string, any>>(
  schemas: Record<keyof T, InterfaceInfo>,
  config: ReactHookFormConfig = {},
): Resolver<T> {
  const validators = Object.entries(schemas).map(([field, schema]) => ({
    field,
    validator: new ValidatorFactory(config).createValidator(
      schema as InterfaceInfo,
    ),
  }));

  return async (
    values: T,
  ): Promise<{
    values: T;
    errors: Record<string, { type: string; message: string }>;
  }> => {
    const errors: Record<string, { type: string; message: string }> = {};
    let hasErrors = false;

    for (const { field, validator } of validators) {
      try {
        const fieldValue = values[field];
        const result = wrapValidation(
          () => validator(fieldValue),
          createValidationContext(`react-hook-form.nested.${field}`),
          config,
        );

        if (!result.success && result.error) {
          const message = config.formatError
            ? config.formatError(result.error, field)
            : result.error.message;

          errors[field] = {
            type: "validation",
            message,
          };
          hasErrors = true;
        }
      } catch (error) {
        errors[field] = {
          type: "validation",
          message: error instanceof Error ? error.message : "Validation failed",
        };
        hasErrors = true;
      }
    }

    return {
      values: hasErrors ? ({} as T) : values,
      errors,
    };
  };
}

/**
 * Utility for transforming validation errors
 */
export function transformValidationErrors(
  errors: any[],
  config: ReactHookFormConfig = {},
): Record<string, { type: string; message: string }> {
  const transformed: Record<string, { type: string; message: string }> = {};

  for (const error of errors) {
    const fieldPath = error.path || "root";
    const message = config.formatError
      ? config.formatError(error, fieldPath)
      : error.message || "Validation failed";

    transformed[fieldPath] = {
      type: error.code || "validation",
      message,
    };
  }

  return transformed;
}
