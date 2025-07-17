import { InterfaceInfo } from '../../types.js';
import { createTestValidator } from './test-validator.js';
import { TestingConfig } from '../types.js';

/**
 * Performance metrics for validation benchmarks
 */
export interface ValidationPerformanceMetrics {
  /**
   * Average validation time in milliseconds
   */
  averageTime: number;
  
  /**
   * Minimum validation time in milliseconds
   */
  minTime: number;
  
  /**
   * Maximum validation time in milliseconds
   */
  maxTime: number;
  
  /**
   * Total time for all validations
   */
  totalTime: number;
  
  /**
   * Number of iterations performed
   */
  iterations: number;
  
  /**
   * Validations per second
   */
  validationsPerSecond: number;
  
  /**
   * Memory usage during testing (if available)
   */
  memoryUsage?: {
    initial: number;
    final: number;
    peak: number;
  };
}

/**
 * Benchmarks validation performance
 */
export function benchmarkValidation<T>(
  interfaceInfo: InterfaceInfo,
  testData: unknown[],
  options: {
    iterations?: number;
    warmupRuns?: number;
    includeMemoryMetrics?: boolean;
    config?: TestingConfig;
  } = {}
): ValidationPerformanceMetrics {
  const {
    iterations = 1000,
    warmupRuns = 100,
    includeMemoryMetrics = false,
    config = {}
  } = options;

  const validator = createTestValidator<T>(interfaceInfo, config);
  const times: number[] = [];
  
  let initialMemory = 0;
  let finalMemory = 0;
  let peakMemory = 0;
  
  if (includeMemoryMetrics && process.memoryUsage) {
    initialMemory = process.memoryUsage().heapUsed;
    peakMemory = initialMemory;
  }
  
  // Warmup runs
  for (let i = 0; i < warmupRuns; i++) {
    const data = testData[i % testData.length];
    try {
      validator(data);
    } catch {
      // Ignore errors during warmup
    }
  }
  
  // Actual benchmark runs
  for (let i = 0; i < iterations; i++) {
    const data = testData[i % testData.length];
    
    const startTime = performance.now();
    try {
      validator(data);
    } catch {
      // Continue even if validation fails
    }
    const endTime = performance.now();
    
    times.push(endTime - startTime);
    
    // Track peak memory usage
    if (includeMemoryMetrics && process.memoryUsage && i % 100 === 0) {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }
  }
  
  if (includeMemoryMetrics && process.memoryUsage) {
    finalMemory = process.memoryUsage().heapUsed;
  }
  
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const validationsPerSecond = 1000 / averageTime;
  
  return {
    averageTime,
    minTime,
    maxTime,
    totalTime,
    iterations,
    validationsPerSecond,
    ...(includeMemoryMetrics && {
      memoryUsage: {
        initial: initialMemory,
        final: finalMemory,
        peak: peakMemory,
      }
    })
  };
}

/**
 * Measures validation performance for a single operation
 */
export function measureValidationPerformance<T>(
  interfaceInfo: InterfaceInfo,
  data: unknown,
  config: TestingConfig = {}
): {
  validationTime: number;
  memoryBefore: number;
  memoryAfter: number;
  success: boolean;
  error?: Error;
} {
  const validator = createTestValidator<T>(interfaceInfo, config);
  
  const memoryBefore = process.memoryUsage?.()?.heapUsed || 0;
  const startTime = performance.now();
  
  let success = false;
  let error: Error | undefined;
  
  try {
    validator(data);
    success = true;
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }
  
  const endTime = performance.now();
  const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;
  
  return {
    validationTime: endTime - startTime,
    memoryBefore,
    memoryAfter,
    success,
    error,
  };
} 