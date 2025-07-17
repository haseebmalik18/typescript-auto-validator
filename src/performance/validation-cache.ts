/**
 * Simple LRU Validation Cache
 * Basic caching for validation results
 */

/**
 * Cache entry with minimal metadata
 */
interface CacheEntry<T = unknown> {
  value: T;
  accessTime: number;
}

/**
 * Cache key generator for validation operations
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key for validation operation
   */
  static generateKey(
    validatorType: string,
    value: unknown,
    path: string,
    options?: Record<string, unknown>
  ): string {
    const valueHash = this.hashValue(value);
    const optionsHash = options ? this.hashValue(options) : '';
    return `${validatorType}:${path}:${valueHash}:${optionsHash}`;
  }

  /**
   * Generate hash for any value
   */
  private static hashValue(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    try {
      const json = JSON.stringify(value, Object.keys(value).sort());
      return this.simpleHash(json);
    } catch {
      return this.simpleHash(String(value));
    }
  }

  /**
   * Simple hash function for strings
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Simple LRU validation cache
 */
export class ValidationCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached validation result
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Update access time for LRU
    entry.accessTime = Date.now();
    this.cache.set(key, entry);
    
    return entry.value as T;
  }

  /**
   * Set validation result in cache
   */
  set<T = unknown>(key: string, value: T): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      value,
      accessTime: Date.now(),
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
} 