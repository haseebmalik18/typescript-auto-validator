// Auto-generated validators for src/user.ts
// DO NOT EDIT - This file is generated automatically

import { ValidationError } from 'typescript-runtime-validator';

import { ValidationError } from '../validator/error-handler';

export function validateUser(value: unknown): User {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError('Expected object, got ' + typeof value);
  }
  
  const obj = value as Record<string, unknown>;
  
  if (obj.id === undefined) {
    throw new ValidationError('Missing required property: id');
  }
  if (typeof obj.id !== 'number') {
    throw new ValidationError('Expected id to be number, got ' + typeof obj.id);
  }
  
  if (obj.name === undefined) {
    throw new ValidationError('Missing required property: name');
  }
  if (typeof obj.name !== 'string') {
    throw new ValidationError('Expected name to be string, got ' + typeof obj.name);
  }
  
  if (obj.email !== undefined) {
    if (typeof obj.email !== 'string') {
    throw new ValidationError('Expected email to be string, got ' + typeof obj.email);
  }
  }
  
  return obj as User;
}

export function isUser(value: unknown): value is User {
  try {
    validateUser(value);
    return true;
  } catch {
    return false;
  }
}

// Export all validators
export {
  validateUser,
  isUser,
};

// Export interface info for runtime use
export const interfaceInfo = {
  User: {
  "name": "User",
  "properties": [
    {
      "name": "id",
      "type": {
        "kind": "number",
        "nullable": false
      },
      "optional": false,
      "readonly": false
    },
    {
      "name": "name",
      "type": {
        "kind": "string",
        "nullable": false
      },
      "optional": false,
      "readonly": false
    },
    {
      "name": "email",
      "type": {
        "kind": "string",
        "nullable": false
      },
      "optional": true,
      "readonly": false
    }
  ],
  "filePath": "/src/user.ts",
  "exported": true
},
};