import { ValidatorFunction } from "../validator/validator-factory.js";

export class ValidatorCache {
  private cache = new Map<string, ValidatorFunction>();
  private maxSize: number;
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): ValidatorFunction<T> | undefined {
    const validator = this.cache.get(key);
    if (validator) {
      this.accessOrder.set(key, ++this.accessCounter);
      return validator as ValidatorFunction<T>;
    }
    return undefined;
  }

  set<T>(key: string, validator: ValidatorFunction<T>): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, validator);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | undefined;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }
}
