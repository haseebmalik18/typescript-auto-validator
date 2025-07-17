import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { ValidationError } from '../../validator/error-handler.js';
import { TestingConfig, TestAssertionResult } from '../types.js';

/**
 * Test assertion that expects validation to fail
 * 
 * @example
 * ```typescript
 * interface User {
 *   id: number;
 *   name: string;
 *   email: string;
 * }
 * 
 * describe('User validation', () => {
 *   test('should reject invalid user data', () => {
 *     const result = expectInvalid<User>(userInterfaceInfo, {
 *       id: 'not-a-number',
 *       name: '',
 *       email: 'invalid-email'
 *     });
 *     
 *     expect(result.passed).toBe(true); // passed means it correctly failed validation
 *     expect(result.error).toBeDefined();
 *   });
 * });
 * ```
 */
export function expectInvalid<T>(
  interfaceInfo: InterfaceInfo,
  data: unknown,
  config: TestingConfig & {
    expectedErrorPath?: string;
    expectedErrorMessage?: string | RegExp;
  } = {}
): TestAssertionResult<T> {
  const startTime = Date.now();
  
  try {
    const factory = new ValidatorFactory(config);
    const validator = factory.createValidator<T>(interfaceInfo, config);
    const result = validator(data);
    const endTime = Date.now();
    
    // If we get here, validation unexpectedly passed
    return {
      passed: false,
      message: `Expected validation to fail for ${interfaceInfo.name}, but it passed`,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  } catch (error) {
    const endTime = Date.now();
    const validationError = error instanceof ValidationError 
      ? error 
      : new ValidationError(String(error), `test.expectInvalid.${interfaceInfo.name}`);
    
    // Check if error matches expected criteria
    let errorMatches = true;
    let errorMessage = `Validation correctly failed for ${interfaceInfo.name}`;
    
    if (config.expectedErrorPath && !validationError.path?.includes(config.expectedErrorPath)) {
      errorMatches = false;
      errorMessage = `Expected error at path "${config.expectedErrorPath}", but got error at "${validationError.path}"`;
    }
    
    if (config.expectedErrorMessage) {
      const messageMatches = typeof config.expectedErrorMessage === 'string'
        ? validationError.message.includes(config.expectedErrorMessage)
        : config.expectedErrorMessage.test(validationError.message);
      
      if (!messageMatches) {
        errorMatches = false;
        errorMessage = `Expected error message to match "${config.expectedErrorMessage}", but got "${validationError.message}"`;
      }
    }
    
    return {
      passed: errorMatches,
      message: errorMessage,
      error: validationError,
      performance: config.includePerformanceMetrics ? {
        validationTime: endTime - startTime,
        memoryUsage: process.memoryUsage?.()?.heapUsed,
      } : undefined,
    };
  }
}

/**
 * Batch validation testing for multiple invalid test cases
 * 
 * @example
 * ```typescript
 * const invalidCases = [
 *   { id: 'not-a-number', name: 'John', email: 'john@example.com' },
 *   { id: 1, name: '', email: 'john@example.com' },
 *   { id: 1, name: 'John', email: 'invalid-email' },
 * ];
 * 
 * const results = expectInvalidBatch<User>(userInterfaceInfo, invalidCases);
 * expect(results.every(r => r.passed)).toBe(true);
 * ```
 */
export function expectInvalidBatch<T>(
  interfaceInfo: InterfaceInfo,
  testCases: unknown[],
  config: TestingConfig = {}
): TestAssertionResult<T>[] {
  return testCases.map((testCase, index) => {
    try {
      const result = expectInvalid<T>(interfaceInfo, testCase, config);
      return {
        ...result,
        message: `${result.message} (case ${index + 1}/${testCases.length})`,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Batch validation test failed for case ${index + 1}/${testCases.length}: ${String(error)}`,
        error: error instanceof ValidationError 
          ? error 
          : new ValidationError(String(error), `test.expectInvalidBatch.${interfaceInfo.name}[${index}]`),
      };
    }
  });
} 