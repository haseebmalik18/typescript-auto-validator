export interface TypeInfo {
  kind:
    | "string"
    | "number"
    | "boolean"
    | "array"
    | "object"
    | "union"
    | "literal"
    | "date"
    | "reference"
    | "unknown";
  nullable: boolean;
  elementType?: TypeInfo;
  types?: TypeInfo[];
  properties?: PropertyInfo[];
  value?: string | number | boolean | null;
  literalType?: "string" | "number" | "boolean";
  name?: string;
}

export interface PropertyInfo {
  name: string;
  type: TypeInfo;
  optional: boolean;
  readonly: boolean;
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  filePath: string;
  exported: boolean;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidatorConfig {
  strict?: boolean;
  allowUnknownProperties?: boolean;
  transformDates?: boolean;
}

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
  }
}
