import { Request, Response, NextFunction } from 'express';
import { InterfaceInfo } from '../../types.js';
import { createValidationMiddleware } from './middleware.js';
import { RequestValidationOptions } from '../types.js';

/**
 * Express middleware for validating request body
 */
export function validateBody<T>(
  interfaceInfo: InterfaceInfo,
  options: RequestValidationOptions = {}
) {
  return createValidationMiddleware<T>(interfaceInfo, {
    ...options,
    validateBody: true,
    validateQuery: false,
    validateParams: false,
    validateHeaders: false,
  });
} 