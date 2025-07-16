export class ValidationError extends Error {
  constructor(
    message: string,
    public path?: string,
    public expected?: string,
    public received?: string,
    public value?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  static create(
    path: string,
    expected: string,
    received: string,
    value: unknown,
  ): ValidationError {
    const message = `Validation failed at ${path}: expected ${expected}, got ${received}`;
    return new ValidationError(message, path, expected, received, value);
  }

  static missing(path: string): ValidationError {
    const message = `Missing required property: ${path}`;
    return new ValidationError(
      message,
      path,
      "required property",
      "undefined",
      undefined,
    );
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      path: this.path,
      expected: this.expected,
      received: this.received,
      value: this.value,
    };
  }
}
