# TypeScript Runtime Validator

🚀 **Advanced TypeScript runtime validation with zero-config type safety, framework integrations, and enterprise-grade transformation rules**

[![npm version](https://badge.fury.io/js/typescript-runtime-validator.svg)](https://www.npmjs.com/package/typescript-runtime-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

Transform your TypeScript interfaces into runtime validators automatically. No schema duplication, no learning curve, just type-safe validation that works seamlessly with your existing TypeScript code.

## ✨ Features

- 🎯 **Zero Configuration** - Works directly with your TypeScript interfaces
- 🚀 **Superior Performance** - Pre-compiled validators, not runtime schema parsing
- 🔧 **Framework Ready** - Express, Next.js, React integrations included
- 🛡️ **Type Safety** - Full TypeScript support with proper type inference
- 🔄 **Advanced Transformations** - Coercion, parsing, formatting, sanitization
- 🎨 **Developer Experience** - No schema duplication, works with existing types

## 📦 Installation

```bash
npm install typescript-runtime-validator
```

## 🚀 Quick Start

### 1. Define Your Types

```typescript
// user.ts
export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  createdAt: Date;
}
```

### 2. Generate Validators

```typescript
import { createValidator } from 'typescript-runtime-validator';

// Automatically creates validator from your interface
const validateUser = createValidator<User>();

// Use the validator
try {
  const user = validateUser({
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    createdAt: new Date()
  });
  console.log("Valid user:", user);
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

## 🔧 Framework Integrations

### Express.js Middleware

```typescript
import express from 'express';
import { validateRequest } from 'typescript-runtime-validator/express';

interface CreateUserRequest {
  name: string;
  email: string;
  age: number;
}

const app = express();

app.post('/users', 
  validateRequest<CreateUserRequest>('body'),
  (req, res) => {
    // req.body is now fully type-safe and validated
    const { name, email, age } = req.body;
    res.json({ message: 'User created', user: { name, email, age } });
  }
);
```

### Next.js API Routes

```typescript
import { withValidation } from 'typescript-runtime-validator/nextjs';

interface UserRequest {
  name: string;
  email: string;
}

export default withValidation<UserRequest>({
  body: true
})(async (req, res) => {
  // req.body is validated and type-safe
  const { name, email } = req.body;
  res.json({ user: { name, email } });
});
```

### React Form Validation

```typescript
import { useValidation } from 'typescript-runtime-validator/react';

interface FormData {
  username: string;
  email: string;
  age: number;
}

function MyForm() {
  const { validate, errors } = useValidation<FormData>();
  
  const handleSubmit = (data: unknown) => {
    try {
      const validData = validate(data);
      console.log('Valid form data:', validData);
    } catch (error) {
      console.log('Validation errors:', errors);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
    </form>
  );
}
```

## 🔄 Advanced Transformations

### Automatic Type Coercion

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  available: boolean;
}

const validator = createValidator<Product>({
  autoTransform: true
});

// Automatically converts strings to appropriate types
const product = validator({
  id: "123",        // → 123 (number)
  name: "Widget",   // → "Widget" (string)
  price: "29.99",   // → 29.99 (number)
  available: "true" // → true (boolean)
});
```

### Custom Transformation Rules

```typescript
interface User {
  name: string;
  email: string;
}

const validator = createValidator<User>({
  transformations: {
    preTransform: [
      {
        type: 'sanitize',
        targetType: 'trim'
      },
      {
        type: 'sanitize', 
        targetType: 'lowercase',
        condition: { sourceType: 'string' }
      }
    ]
  }
});
```

## 🛠️ Build Tool Integration

### Webpack Plugin

```javascript
// webpack.config.js
const { TypeScriptRuntimeValidatorPlugin } = require('typescript-runtime-validator/webpack');

module.exports = {
  plugins: [
    new TypeScriptRuntimeValidatorPlugin({
      include: ['src/**/*.ts'],
      outputDir: 'src/generated'
    })
  ]
};
```

### Vite Plugin

```javascript
// vite.config.js
import { typeScriptRuntimeValidator } from 'typescript-runtime-validator/vite';

export default {
  plugins: [
    typeScriptRuntimeValidator({
      include: ['src/**/*.ts']
    })
  ]
};
```

## 🔗 Advanced Usage

### Complex Nested Types

```typescript
interface Company {
  id: number;
  name: string;
  employees: Employee[];
  headquarters: Address;
  metadata?: Record<string, any>;
}

interface Employee {
  id: number;
  name: string;
  role: 'developer' | 'designer' | 'manager';
  startDate: Date;
}

interface Address {
  street: string;
  city: string;
  country: string;
  zipCode: string;
}

// Validates entire nested structure automatically
const validateCompany = createValidator<Company>();
```

### Union Types & Discriminated Unions

```typescript
type Status = 'pending' | 'approved' | 'rejected';

interface BaseRequest {
  id: string;
  status: Status;
}

interface PendingRequest extends BaseRequest {
  status: 'pending';
  submittedAt: Date;
}

interface ProcessedRequest extends BaseRequest {
  status: 'approved' | 'rejected';
  processedAt: Date;
  reviewedBy: string;
}

type Request = PendingRequest | ProcessedRequest;

const validateRequest = createValidator<Request>();
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation**: [Full Documentation](https://github.com/yourusername/typescript-runtime-validator)
- **Issues**: [Report Issues](https://github.com/yourusername/typescript-runtime-validator/issues)
- **NPM**: [Package on NPM](https://www.npmjs.com/package/typescript-runtime-validator)

---

**Made with ❤️ for the TypeScript community** 