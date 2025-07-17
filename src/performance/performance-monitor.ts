/**
 * Simple Performance Monitor
 * Basic performance monitoring for validation operations
 */

import { PerformanceMetrics, ValidationEvent } from './types.js';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private enabled: boolean = true;

  constructor(options: { enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? true;
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Record a validation event
   */
  recordEvent(event: ValidationEvent): void {
    if (!this.enabled) return;

    if (event.type === 'complete') {
      this.metrics.validationCount++;
      
      if (event.duration !== undefined) {
        this.metrics.totalTime += event.duration;
        this.metrics.averageTime = this.metrics.totalTime / this.metrics.validationCount;
      }

      if (event.cacheUsed) {
        this.metrics.cacheHits++;
      } else {
        this.metrics.cacheMisses++;
      }

      this.updateCacheHitRatio();
    }

    this.metrics.timestamp = new Date();
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.createInitialMetrics();
  }

  private createInitialMetrics(): PerformanceMetrics {
    return {
      totalTime: 0,
      validationCount: 0,
      averageTime: 0,
      memoryUsage: 0,
      cacheHitRatio: 0,
      cacheHits: 0,
      cacheMisses: 0,
      peakMemoryUsage: 0,
      timestamp: new Date(),
    };
  }

  private updateCacheHitRatio(): void {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRatio = totalCacheRequests > 0 
      ? this.metrics.cacheHits / totalCacheRequests 
      : 0;
  }
} 