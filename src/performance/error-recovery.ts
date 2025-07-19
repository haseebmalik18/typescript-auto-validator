import { ErrorRecoveryStrategy } from './types.js';

export class ErrorRecovery {
  private strategy: ErrorRecoveryStrategy;

  constructor(strategy: ErrorRecoveryStrategy = 'fail-fast') {
    this.strategy = strategy;
  }

  handleError(error: Error, context: { path: string; value: unknown }): {
    shouldContinue: boolean;
    result?: unknown;
    error?: Error;
  } {
    switch (this.strategy) {
      case 'fail-fast':
        return { shouldContinue: false, error };
      
      case 'collect-all':
        return { shouldContinue: true, error };
      
      case 'graceful':
        return { shouldContinue: true, result: this.getDefaultValue(context.value) };
      
      case 'best-effort':
        return { shouldContinue: true, result: context.value };
      
      default:
        return { shouldContinue: false, error };
    }
  }

  private getDefaultValue(value: unknown): unknown {
    if (typeof value === 'string') return '';
    if (typeof value === 'number') return 0;
    if (typeof value === 'boolean') return false;
    if (Array.isArray(value)) return [];
    if (typeof value === 'object' && value !== null) return {};
    return null;
  }
} 