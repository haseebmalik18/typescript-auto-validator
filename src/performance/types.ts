export interface PerformanceMetrics {
  totalTime: number;
  validationCount: number;
  averageTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
  cacheHits: number;
  cacheMisses: number;
  peakMemoryUsage: number;
  timestamp: Date;
}

export interface ValidationEvent {
  type: 'start' | 'complete' | 'error' | 'cache-hit' | 'cache-miss';
  interfaceName?: string;
  duration?: number;
  success?: boolean;
  error?: Error;
  cacheUsed?: boolean;
  memoryDelta?: number;
  timestamp: number;
}

export interface CacheConfig {
  strategy: 'lru' | 'fifo' | 'lfu' | 'ttl';
  maxSize: number;
  ttlMs?: number;
  maxMemoryMB?: number;
  cleanupInterval?: number;
  enableMetrics?: boolean;
}

export interface OptimizationConfig {
  level: 'development' | 'production' | 'aggressive';
  caching: CacheConfig;
  errorRecovery: ErrorRecoveryStrategy;
  enableMetrics: boolean;
  enableProfiling: boolean;
  maxMemoryUsageMB: number;
  warningThresholdMs: number;
  errorThresholdMs: number;
}

export type ErrorRecoveryStrategy = 'fail-fast' | 'collect-all' | 'graceful' | 'best-effort';

export interface CacheMetrics {
  hitCount: number;
  missCount: number;
  hitRatio: number;
  totalSize: number;
  maxSize: number;
  memoryUsage: number;
  evictionCount: number;
  averageAccessTime: number;
}

export interface ValidationProfile {
  interfaceName: string;
  validationCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  complexity: number;
}

export interface ProfilingReport {
  totalValidations: number;
  totalTime: number;
  averageTime: number;
  memoryUsage: number;
  cacheEfficiency: number;
  interfaceProfiles: ValidationProfile[];
  topSlowInterfaces: ValidationProfile[];
  topErrorProneInterfaces: ValidationProfile[];
  recommendations: string[];
  timestamp: Date;
}

export interface ResourceMonitor {
  cpuUsage: number;
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

export interface MemorySnapshot {
  before: ResourceMonitor;
  after: ResourceMonitor;
  delta: {
    memory: number;
    heap: number;
    external: number;
  };
}

export interface ThresholdConfig {
  warningMs: number;
  errorMs: number;
  memoryWarningMB: number;
  memoryErrorMB: number;
  cacheHitRateWarning: number;
}

export interface Alert {
  type: 'warning' | 'error' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface CompilationMetrics {
  fileCount: number;
  interfaceCount: number;
  generatedValidatorCount: number;
  compilationTime: number;
  codeSize: number;
  dependencies: string[];
  warnings: string[];
  errors: string[];
}

export interface RuntimeMetrics {
  uptime: number;
  totalValidations: number;
  validationsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  memoryTrend: number[];
  performanceTrend: number[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  score: number;
  issues: Alert[];
  recommendations: string[];
  lastCheck: Date;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  operationsPerSecond: number;
  memoryUsage: number;
}

export interface LoadTestConfig {
  concurrency: number;
  duration: number;
  rampUpTime: number;
  targetRps: number;
  dataSize: number;
  validationComplexity: 'simple' | 'medium' | 'complex';
}

export interface LoadTestResult {
  config: LoadTestConfig;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  resourceUsage: ResourceMonitor[];
  timestamps: number[];
}

export interface PerformanceReport {
  summary: {
    period: string;
    totalValidations: number;
    averageTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  trends: {
    performance: number[];
    memory: number[];
    errors: number[];
    cache: number[];
  };
  topInterfaces: ValidationProfile[];
  alerts: Alert[];
  recommendations: string[];
  benchmarks: BenchmarkResult[];
  generatedAt: Date;
} 