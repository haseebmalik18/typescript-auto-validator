/**
 * Performance & Optimization Types - Phase 2 Week 7
 * Enterprise-grade type definitions for performance monitoring
 */

/**
 * Performance metrics collected during validation
 */
export interface PerformanceMetrics {
  /** Total validation time in milliseconds */
  totalTime: number;
  /** Number of validations performed */
  validationCount: number;
  /** Average validation time per operation */
  averageTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Cache hit ratio (0-1) */
  cacheHitRatio: number;
  /** Number of cache hits */
  cacheHits: number;
  /** Number of cache misses */
  cacheMisses: number;
  /** Peak memory usage during operation */
  peakMemoryUsage: number;
  /** Timestamp when metrics were collected */
  timestamp: Date;
  /** Custom labels for categorizing metrics */
  labels?: Record<string, string>;
}

/**
 * Cache strategies for validation optimization
 */
export type CacheStrategy = 
  | 'lru'           // Least Recently Used
  | 'lfu'           // Least Frequently Used
  | 'ttl'           // Time To Live
  | 'adaptive'      // Adaptive based on usage patterns
  | 'none';         // No caching

/**
 * Cache configuration options
 */
export interface CacheConfiguration {
  strategy: CacheStrategy;
  maxSize: number;
  ttlMs?: number;
  maxMemoryMB?: number;
  cleanupInterval?: number;
  enableMetrics?: boolean;
}

/**
 * Cache statistics and performance data
 */
export interface CacheStatistics {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRatio: number;
  evictionCount: number;
  memoryUsageBytes: number;
  averageAccessTime: number;
  oldestEntryAge: number;
  newestEntryAge: number;
}

/**
 * Memory usage tracking
 */
export interface MemoryUsage {
  used: number;
  total: number;
  free: number;
  percentage: number;
  external: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

/**
 * Benchmark test result
 */
export interface BenchmarkResult {
  name: string;
  operationsPerSecond: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  memoryUsage: MemoryUsage;
  iterations: number;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Validation performance profile
 */
export interface ValidationProfile {
  validatorType: string;
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
  objectSize: 'small' | 'medium' | 'large' | 'very-large';
  averageTime: number;
  samples: number;
  standardDeviation: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Optimization levels for different environments
 */
export type OptimizationLevel = 
  | 'development'   // Full debugging, minimal optimization
  | 'testing'       // Balanced performance with debugging
  | 'staging'       // Production-like with some debugging
  | 'production';   // Maximum performance, minimal debugging

/**
 * Error recovery strategies
 */
export type ErrorRecoveryStrategy = 
  | 'fail-fast'     // Stop on first error
  | 'collect-all'   // Collect all errors before failing
  | 'graceful'      // Attempt to recover and continue
  | 'best-effort';  // Return partial results on error

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  level: OptimizationLevel;
  caching: CacheConfiguration;
  errorRecovery: ErrorRecoveryStrategy;
  enableMetrics: boolean;
  enableProfiling: boolean;
  maxMemoryUsageMB: number;
  warningThresholdMs: number;
  errorThresholdMs: number;
}

/**
 * Validation event for monitoring
 */
export interface ValidationEvent {
  type: 'start' | 'complete' | 'error' | 'cache-hit' | 'cache-miss';
  validatorType: string;
  path: string;
  duration?: number;
  success: boolean;
  error?: string;
  cacheUsed: boolean;
  memoryBefore: number;
  memoryAfter: number;
  timestamp: Date;
}

/**
 * Performance warning threshold
 */
export interface PerformanceThreshold {
  name: string;
  metric: keyof PerformanceMetrics;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Hot path detection for optimization
 */
export interface HotPath {
  path: string;
  validatorType: string;
  frequency: number;
  totalTime: number;
  averageTime: number;
  suggestion: string;
}

/**
 * Memory pool configuration for object reuse
 */
export interface MemoryPoolConfig {
  enabled?: boolean;
  maxPoolSize?: number;
  objectTypes?: string[];
  cleanupIntervalMs?: number;
  maxObjectAge?: number;
  gcInterval?: number;
  memoryThreshold?: number;
} 