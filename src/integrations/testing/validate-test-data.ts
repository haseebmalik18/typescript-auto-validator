import { InterfaceInfo } from '../../types.js';
import { createTestValidator } from './test-validator.js';
import { TestingConfig, TestAssertionResult } from '../types.js';
import { ValidationError } from '../../validator/error-handler.js';

/**
 * Validates test data and returns a detailed result
 */
export function validateTestData<T>(
  interfaceInfo: InterfaceInfo,
  data: unknown,
  config: TestingConfig = {}
): TestAssertionResult<T> {
  const startTime = Date.now();
  
  try {
    const validator = createTestValidator<T>(interfaceInfo, config);
    const result = validator(data);
    const endTime = Date.now();
    
    return {
      passed: true,
      data: result,
      message: `Test data validation passed for ${interfaceInfo.name}`,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  } catch (error) {
    const endTime = Date.now();
    const validationError = error instanceof ValidationError 
      ? error 
      : new ValidationError(String(error), `test.validateTestData.${interfaceInfo.name}`);
    
    return {
      passed: false,
      message: `Test data validation failed for ${interfaceInfo.name}: ${validationError.message}`,
      error: validationError,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  }
} 