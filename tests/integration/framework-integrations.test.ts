import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  InterfaceInfo,
  TestingUtilities,
  ValidatorFactory,
} from '../../src/index.js';

// Test interface definitions - simplified without strict constraints for testing
const userInterfaceInfo: InterfaceInfo = {
  name: 'User',
  properties: [
    { name: 'id', type: { kind: 'number', nullable: false }, optional: false, readonly: false },
    { name: 'name', type: { kind: 'string', nullable: false }, optional: false, readonly: false },
    { name: 'email', type: { kind: 'string', nullable: false }, optional: false, readonly: false },
    { name: 'age', type: { kind: 'number', nullable: false }, optional: true, readonly: false },
  ],
  filePath: '/test/user.ts',
  exported: true,
};

const createUserRequestInterfaceInfo: InterfaceInfo = {
  name: 'CreateUserRequest',
  properties: [
    { name: 'name', type: { kind: 'string', nullable: false }, optional: false, readonly: false },
    { name: 'email', type: { kind: 'string', nullable: false }, optional: false, readonly: false },
    { name: 'age', type: { kind: 'number', nullable: false }, optional: true, readonly: false },
  ],
  filePath: '/test/user.ts',
  exported: true,
};

interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

interface CreateUserRequest {
  name: string;
  email: string;
  age?: number;
}

describe('Framework Integrations', () => {
  describe('Testing Utilities', () => {
    test('expectValid should pass for valid data', () => {
      const validUserData: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const result = TestingUtilities.expectValid<User>(
        userInterfaceInfo,
        validUserData,
        { includePerformanceMetrics: true }
      );

      expect(result.passed).toBe(true);
      expect(result.data).toEqual(validUserData);
      expect(result.error).toBeUndefined();
      expect(result.performance?.validationTime).toBeDefined();
    });

    test('expectInvalid should pass for invalid data', () => {
      const invalidUserData = {
        id: 'not-a-number',
        name: '',
        email: 'invalid-email',
        age: 'not-a-number',
      };

      const result = TestingUtilities.expectInvalid<User>(
        userInterfaceInfo,
        invalidUserData,
        {
          expectedErrorPath: 'id',
          includePerformanceMetrics: true
        }
      );

      expect(result.passed).toBe(true); // Passed means it correctly failed validation
      expect(result.error).toBeDefined();
      expect(result.error?.path).toContain('id');
    });

    test('expectValidBatch should validate multiple items', () => {
      const validUsers: User[] = [
        { id: 1, name: 'John', email: 'john@example.com', age: 30 },
        { id: 2, name: 'Jane', email: 'jane@example.com', age: 25 },
        { id: 3, name: 'Bob', email: 'bob@example.com' },
      ];

      const results = TestingUtilities.expectValidBatch<User>(
        userInterfaceInfo,
        validUsers
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.passed)).toBe(true);
      expect(results.every(r => r.data)).toBe(true);
    });

    test('expectInvalidBatch should handle multiple invalid cases', () => {
      const invalidCases = [
        { id: 'not-a-number', name: 'John', email: 'john@example.com' }, // id should be number
        { id: 1, name: 123, email: 'john@example.com' }, // name should be string
        { id: 1, name: 'John', email: 456 }, // email should be string
      ];

      const results = TestingUtilities.expectInvalidBatch<User>(
        userInterfaceInfo,
        invalidCases
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.passed)).toBe(true);
    });
  });

  describe('Core Validation Integration', () => {
    test('should work with createValidator from core API', () => {
      const factory = new ValidatorFactory();
      const validator = factory.createValidator<User>(userInterfaceInfo);
      
      const validData: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for invalid data', () => {
      const factory = new ValidatorFactory();
      const validator = factory.createValidator<User>(userInterfaceInfo);
      
      const invalidData = {
        id: 'not-a-number',
        name: 'John Doe',
        email: 'john@example.com',
      };

      expect(() => validator(invalidData)).toThrow();
    });
  });

  describe('Framework Integration Types', () => {
    test('should have proper TypeScript types', () => {
      // This test verifies that the types compile correctly
      const testConfig = {
        enableLogging: true,
        autoTransform: false,
        detailedErrors: true,
      };

      const testResult = TestingUtilities.expectValid<User>(
        userInterfaceInfo,
        { id: 1, name: 'Test', email: 'test@example.com' },
        testConfig
      );

      // Type checks
      expect(typeof testResult.passed).toBe('boolean');
      expect(testResult.data || null).toBeTruthy();
      expect(typeof testResult.message).toBe('string');
    });
  });

  describe('Performance and Memory', () => {
    test('should have reasonable performance for large datasets', () => {
      const startTime = Date.now();
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 100) + 1,
      }));

      const results = TestingUtilities.expectValidBatch<User>(
        userInterfaceInfo,
        largeDataset
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(1000);
      expect(results.every(r => r.passed)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should have minimal memory footprint', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many validators
      for (let i = 0; i < 100; i++) {
        const result = TestingUtilities.expectValid<User>(
          userInterfaceInfo,
          { id: i, name: `User${i}`, email: `user${i}@example.com` }
        );
        expect(result.passed).toBe(true);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
}); 