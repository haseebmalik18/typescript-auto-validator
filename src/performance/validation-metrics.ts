/**
 * Validation Metrics - Phase 2 Week 7
 * Metrics collection and analysis for validation operations
 */

import { PerformanceMetrics, ValidationEvent } from './types.js';

export class ValidationMetrics {
  private events: ValidationEvent[] = [];
  private metrics: PerformanceMetrics;

  constructor() {
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Record validation event
   */
  recordEvent(event: ValidationEvent): void {
    this.events.push(event);
    this.updateMetrics(event);
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
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

  private updateMetrics(event: ValidationEvent): void {
    if (event.type === 'complete') {
      this.metrics.validationCount++;
      if (event.duration !== undefined) {
        this.metrics.totalTime += event.duration;
        this.metrics.averageTime = this.metrics.totalTime / this.metrics.validationCount;
      }
    }
    this.metrics.timestamp = new Date();
  }
} 