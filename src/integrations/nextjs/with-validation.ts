import { NextApiRequest, NextApiResponse } from 'next';
import { InterfaceInfo } from '../../types.js';
import { createValidatedHandler } from './validated-handler.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Higher-order function that adds validation to Next.js API routes
 */
export function withValidation<TRequest = any, TResponse = any>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return function(
    handler: (req: NextApiRequest, res: NextApiResponse<TResponse>) => Promise<void> | void
  ) {
    return createValidatedHandler<TRequest, TResponse>(
      interfaceInfo,
      options,
      handler
    );
  };
} 