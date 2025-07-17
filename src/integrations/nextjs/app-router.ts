import { NextRequest, NextResponse } from 'next/server';
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
 * Creates a validated route handler for Next.js App Router (13+)
 */
export function createValidatedRoute<TRequest = any, TResponse = any>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions & {
    methods?: string[];
  } = {}
) {
  return function(
    handler: (request: NextRequest, validatedData: TRequest) => Promise<NextResponse<TResponse>>
  ) {
    return async function(request: NextRequest): Promise<NextResponse> {
      const config = {
        validateBody: true,
        methods: ['POST', 'PUT', 'PATCH'],
        errorStatusCode: 400,
        includeErrorDetails: shouldIncludeErrorDetails(options.includeErrorDetails),
        ...options,
      };

      try {
        // Check HTTP method
        if (config.methods && config.methods.length > 0) {
          if (!config.methods.includes(request.method)) {
            return NextResponse.json(
              {
                error: 'Method Not Allowed',
                message: `Method ${request.method} not allowed. Allowed methods: ${config.methods.join(', ')}`,
                allowedMethods: config.methods,
              },
              { status: 405 }
            );
          }
        }

        const validator = new ValidatorFactory().createValidator<TRequest>(interfaceInfo, config);
        const context = createValidationContext(
          `nextjs.app.${request.method}.${request.url}`,
          request
        );

        let dataToValidate: unknown;
        if (config.validateBody) {
          try {
            dataToValidate = await request.json();
          } catch {
            throw new ValidationError('Invalid JSON in request body', context.path);
          }
        } else {
          // For app router, we might validate URL params or search params
          const url = new URL(request.url);
          dataToValidate = Object.fromEntries(url.searchParams);
        }

        const result = wrapValidation(
          () => validator(dataToValidate),
          context,
          config
        );

        if (!result.success && result.error) {
          throw result.error;
        }

        return await handler(request, result.data!);

      } catch (error) {
        if (error instanceof ValidationError) {
          const errorResponse = formatValidationErrorForHttp(error, config.includeErrorDetails);
          return NextResponse.json(errorResponse, { status: config.errorStatusCode });
        } else {
          const errorResponse = {
            error: 'Internal Server Error',
            message: 'An unexpected error occurred during validation',
            ...(config.includeErrorDetails && { 
              details: { originalError: String(error) } 
            }),
          };
          return NextResponse.json(errorResponse, { status: 500 });
        }
      }
    };
  };
} 