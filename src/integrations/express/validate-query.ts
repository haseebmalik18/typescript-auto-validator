import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { createValidationMiddleware } from './middleware.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Express middleware for validating request query parameters
 */
export function validateQuery<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: false,
    validateQuery: true,
    validateParams: false,
    validateHeaders: false,
  });
} 