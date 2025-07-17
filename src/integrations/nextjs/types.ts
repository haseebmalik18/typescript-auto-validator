import { NextApiRequest, NextApiResponse } from 'next';
import { RequestValidationOptions } from '../types.js';

/**
 * Re-export Next.js types for convenience
 */
export type { NextApiRequest, NextApiResponse };

/**
 * Next.js-specific validation options
 */
export interface NextValidationOptions extends RequestValidationOptions {
  /**
   * Allowed HTTP methods for the API route
   */
  methods?: string[];
  
  /**
   * Whether to validate response data
   */
  validateResponse?: boolean;
} 