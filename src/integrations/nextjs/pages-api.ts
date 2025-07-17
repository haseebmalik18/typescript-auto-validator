import { NextApiRequest, NextApiResponse } from 'next';
import { InterfaceInfo } from '../../types.js';
import { createValidatedHandler } from './validated-handler.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Creates a validated handler for Next.js Pages API (Next.js 12 and below)
 */
export function createPageApiHandler<TRequest = any, TResponse = any>(
  interfaceInfo: InterfaceInfo,
  handler: (req: NextApiRequest, res: NextApiResponse<TResponse>) => Promise<void> | void,
  options: RequestValidationOptions = {}
) {
  return createValidatedHandler<TRequest, TResponse>(
    interfaceInfo,
    {
      validateBody: true,
      methods: ['POST', 'PUT', 'PATCH'],
      ...options,
    },
    handler
  );
} 