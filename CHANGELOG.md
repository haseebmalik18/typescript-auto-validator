# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-XX

### Added
- Initial release of ts-auto-validator
- Zero-configuration TypeScript interface validation
- Auto validation functions with automatic type detection
- Advanced transformation engine with built-in type coercion
- Framework integrations for Express.js, Next.js, and React
- Build plugins for Vite and Webpack
- Performance monitoring and caching system
- Comprehensive error handling with detailed validation errors
- Support for complex types (unions, intersections, tuples, branded types)
- Testing utilities for validation assertions
- Full TypeScript type safety with proper type inference

### Framework Integrations
- **Express.js**: Middleware for request/response validation
- **Next.js**: API route validation for both Pages and App Router
- **React**: Hooks and components for form validation
- **React Hook Form**: Resolver integration
- **React Query**: Validated queries and mutations

### Features
- Automatic type coercion (string → number, string → boolean, etc.)
- Custom transformation rules with safe execution
- Discriminated union optimization
- Nested object validation with detailed error paths
- Array and tuple validation
- Literal type validation
- Branded type support
- Intersection type validation
- Null/undefined handling
- Advanced constraints (min/max, length, patterns)
- Performance caching and metrics
- Hot module replacement support
- TypeScript declaration generation

[Unreleased]: https://github.com/haseebmalik18/ts-auto-validator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haseebmalik18/ts-auto-validator/releases/tag/v0.1.0