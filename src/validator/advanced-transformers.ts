import { TransformerDefinition, TransformerRegistry } from "../types.js";

/**
 * Essential transformers for basic type coercion
 */
export function getAdvancedTransformers(): TransformerRegistry {
  return {
    'string-to-date': {
      sourceTypes: ['string'],
      targetType: 'date',
      canTransform: (value) => {
        if (typeof value !== 'string') return false;
        const date = new Date(value);
        return !isNaN(date.getTime());
      },
      transform: (value) => {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date string: ${value}`);
        }
        return date;
      },
      metadata: {
        description: 'Converts ISO date strings to Date objects',
        examples: [
          { input: '2023-12-25T10:30:00Z', output: new Date('2023-12-25T10:30:00Z') },
        ],
      },
    },

    'number-to-string': {
      sourceTypes: ['number'],
      targetType: 'string',
      canTransform: (value) => typeof value === 'number' && !isNaN(value),
      transform: (value) => String(value),
      metadata: {
        description: 'Converts numbers to strings',
        examples: [
          { input: 42, output: '42' },
          { input: 3.14, output: '3.14' },
        ],
      },
    },

    'boolean-to-string': {
      sourceTypes: ['boolean'],
      targetType: 'string',
      canTransform: (value) => typeof value === 'boolean',
      transform: (value) => String(value),
      metadata: {
        description: 'Converts booleans to strings',
        examples: [
          { input: true, output: 'true' },
          { input: false, output: 'false' },
        ],
      },
    },
  };
}

/**
 * Get all advanced transformers (for compatibility)
 */
export function getAllAdvancedTransformers(): TransformerRegistry {
  return getAdvancedTransformers();
} 