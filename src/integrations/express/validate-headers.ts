import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { createValidationMiddleware } from './middleware.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Express middleware for validating request headers
 */
export function validateHeaders<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: false,
    validateQuery: false,
    validateParams: false,
    validateHeaders: true,
  });
} 