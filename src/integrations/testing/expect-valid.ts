import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { TestingConfig, TestAssertionResult } from '../types.js';

/**
 * Test assertion that expects validation to succeed
 */
export function expectValid<T>(
  interfaceInfo: InterfaceInfo,
  data: unknown,
  config: TestingConfig = {}
): TestAssertionResult<T> {
  const startTime = Date.now();
  
  try {
    const factory = new ValidatorFactory(config);
    const validator = factory.createValidator<T>(interfaceInfo, config);
    const result = validator(data);
    const endTime = Date.now();
    
    return {
      passed: true,
      data: result,
      message: `Validation passed for ${interfaceInfo.name}`,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  } catch (error) {
    const endTime = Date.now();
    const validationError = error instanceof ValidationError 
      ? error 
      : new ValidationError(String(error), `test.expectValid.${interfaceInfo.name}`);
    
    return {
      passed: false,
      message: `Expected validation to pass for ${interfaceInfo.name}, but got error: ${validationError.message}`,
      error: validationError,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  }
}

/**
 * Batch validation testing for multiple test cases
 * 
 * @example
 * ```typescript
 * const testCases = [
 *   { id: 1, name: 'John', email: 'john@example.com' },
 *   { id: 2, name: 'Jane', email: 'jane@example.com' },
 * ];
 * 
 * const results = expectValidBatch<User>(userInterfaceInfo, testCases);
 * expect(results.every(r => r.passed)).toBe(true);
 * ```
 */
export function expectValidBatch<T>(
  interfaceInfo: InterfaceInfo,
  testCases: unknown[],
  config: TestingConfig = {}
): TestAssertionResult<T>[] {
  return testCases.map((testCase, index) => {
    try {
      const result = expectValid<T>(interfaceInfo, testCase, config);
      return {
        ...result,
        message: `${result.message} (case ${index + 1}/${testCases.length})`,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Batch validation failed for case ${index + 1}/${testCases.length}: ${String(error)}`,
        error: error instanceof ValidationError 
          ? error 
          : new ValidationError(String(error), `test.expectValidBatch.${interfaceInfo.name}[${index}]`),
      };
    }
  });
} 