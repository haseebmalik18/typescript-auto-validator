// Testing Utilities Exports
export { expectValid, expectValidBatch } from './expect-valid.js';
export { expectInvalid, expectInvalidBatch } from './expect-invalid.js';

// Performance testing
export { 
  benchmarkValidation,
  measureValidationPerformance,
} from './performance.js';

// Test utilities
export { createTestValidator } from './test-validator.js';
export { validateTestData } from './validate-test-data.js';

// Integration test helpers
export { 
  createTestServer,
} from './integration.js';

// Re-export testing-specific types
export type {
  TestingConfig,
  TestAssertionResult,
} from '../types.js'; 