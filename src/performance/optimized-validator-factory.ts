import { ValidatorFactory, ValidatorFunction } from '../validator/validator-factory.js';
import { TypeInfo, ValidatorConfig } from '../types.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { ValidationCache, CacheKeyGenerator } from './validation-cache.js';
import { OptimizationConfig } from './types.js';

export class OptimizedValidatorFactory extends ValidatorFactory {
  private performanceMonitor: PerformanceMonitor;
  private validationCache: ValidationCache;
  private optimizationConfig: OptimizationConfig;

  constructor(config: ValidatorConfig & { optimization?: OptimizationConfig } = {}) {
    super(config);
    
    this.optimizationConfig = config.optimization || {
      level: 'production',
      caching: {
        strategy: 'lru',
        maxSize: 1000,
        ttlMs: 300000,
        maxMemoryMB: 100,
        cleanupInterval: 60000,
        enableMetrics: true,
      },
      errorRecovery: 'fail-fast',
      enableMetrics: true,
      enableProfiling: false,
      maxMemoryUsageMB: 500,
      warningThresholdMs: 50,
      errorThresholdMs: 100,
    };

    this.performanceMonitor = new PerformanceMonitor({
      enabled: this.optimizationConfig.enableMetrics,
    });

    this.validationCache = new ValidationCache(this.optimizationConfig.caching.maxSize);
  }

  createOptimizedValidator<T>(typeInfo: TypeInfo, config?: ValidatorConfig): ValidatorFunction<T> {
    const baseValidator = this.createTypeValidator<T>(typeInfo, config);
    
    return (value: unknown, path: string = "value", validatorConfig?: ValidatorConfig): T => {
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage?.()?.heapUsed || 0;
      
      // Generate cache key
      const cacheKey = CacheKeyGenerator.generateKey(
        typeInfo.kind,
        value,
        path,
        validatorConfig as Record<string, unknown>
      );

      // Check cache first
      const cached = this.validationCache.get<T>(cacheKey);
      if (cached !== undefined) {
        const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;
        this.performanceMonitor.recordEvent({
          type: 'cache-hit',
          interfaceName: typeInfo.kind,
          duration: performance.now() - startTime,
          success: true,
          cacheUsed: true,
          memoryDelta: memoryAfter - memoryBefore,
          timestamp: Date.now(),
        });
        return cached;
      }
      
      try {
        // Perform validation using the base validator
        const result = baseValidator(value, path, validatorConfig);
        
        // Cache successful result
        this.validationCache.set(cacheKey, result);
        
        const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;
        this.performanceMonitor.recordEvent({
          type: 'complete',
          interfaceName: typeInfo.kind,
          duration: performance.now() - startTime,
          success: true,
          cacheUsed: false,
          memoryDelta: memoryAfter - memoryBefore,
          timestamp: Date.now(),
        });
        
        return result;
        
      } catch (error) {
        const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;
        this.performanceMonitor.recordEvent({
          type: 'error',
          interfaceName: typeInfo.kind,
          duration: performance.now() - startTime,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          cacheUsed: false,
          memoryDelta: memoryAfter - memoryBefore,
          timestamp: Date.now(),
        });
        throw error;
      }
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      performance: this.performanceMonitor.getMetrics(),
      cache: {
        size: this.validationCache.size(),
        maxSize: this.optimizationConfig.caching.maxSize,
      },
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  reset(): void {
    this.validationCache.clear();
    this.performanceMonitor.reset();
  }
} 