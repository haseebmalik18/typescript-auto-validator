import { InterfaceInfo } from '../../types.js';
import { ValidatorFactory } from '../../validator/validator-factory.js';
import { TestingConfig } from '../types.js';

/**
 * Creates a validator specifically configured for testing
 */
export function createTestValidator<T>(
  interfaceInfo: InterfaceInfo,
  config: TestingConfig = {}
): (data: unknown) => T {
  const testConfig = {
    strict: true,
    timeout: 5000,
    includePerformanceMetrics: false,
    enableLogging: false, // Usually disable logging in tests
    ...config,
  };

  const factory = new ValidatorFactory(testConfig);
  return factory.createValidator<T>(interfaceInfo, testConfig);
} 