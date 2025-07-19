import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ValidationError,
  ValidatorFactory,
  validate,
  createValidator,
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateArray,
  validateObject,
} from "../../src/validator/index";
import { InterfaceInfo, TypeInfo } from "../../src/types";

describe("ValidationError", () => {
  it("should create error with message", () => {
    const error = new ValidationError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("ValidationError");
  });

  it("should create error with path and details", () => {
    const error = new ValidationError(
      "Test error",
      "user.name",
      "string",
      "number",
      123,
    );
    expect(error.path).toBe("user.name");
    expect(error.expected).toBe("string");
    expect(error.received).toBe("number");
    expect(error.value).toBe(123);
  });

  it("should have static factory methods", () => {
    const error1 = ValidationError.create("user.id", "number", "string", "123");
    expect(error1.message).toContain("Validation failed at user.id");

    const error2 = ValidationError.missing("user.name");
    expect(error2.message).toContain("Missing required property: user.name");
  });

  it("should serialize to JSON", () => {
    const error = new ValidationError("Test", "path", "string", "number", 123);
    const json = error.toJSON();

    expect(json.name).toBe("ValidationError");
    expect(json.message).toBe("Test");
    expect(json.path).toBe("path");
    expect(json.expected).toBe("string");
    expect(json.received).toBe("number");
    expect(json.value).toBe(123);
  });
});

describe("Primitive Validators", () => {
  describe("validateString", () => {
    it("should validate string values", () => {
      expect(validateString("hello", "test")).toBe("hello");
      expect(validateString("", "test")).toBe("");
    });

    it("should throw for non-string values", () => {
      expect(() => validateString(123, "test")).toThrow(ValidationError);
      expect(() => validateString(null, "test")).toThrow(ValidationError);
      expect(() => validateString(undefined, "test")).toThrow(ValidationError);
    });
  });

  describe("validateNumber", () => {
    it("should validate number values", () => {
      expect(validateNumber(123, "test")).toBe(123);
      expect(validateNumber(0, "test")).toBe(0);
      expect(validateNumber(-456.789, "test")).toBe(-456.789);
    });

    it("should throw for non-number values", () => {
      expect(() => validateNumber("123", "test")).toThrow(ValidationError);
      expect(() => validateNumber(NaN, "test")).toThrow(ValidationError);
      expect(() => validateNumber(null, "test")).toThrow(ValidationError);
    });
  });

  describe("validateBoolean", () => {
    it("should validate boolean values", () => {
      expect(validateBoolean(true, "test")).toBe(true);
      expect(validateBoolean(false, "test")).toBe(false);
    });

    it("should throw for non-boolean values", () => {
      expect(() => validateBoolean(1, "test")).toThrow(ValidationError);
      expect(() => validateBoolean("true", "test")).toThrow(ValidationError);
      expect(() => validateBoolean(null, "test")).toThrow(ValidationError);
    });
  });

  describe("validateDate", () => {
    it("should validate Date values", () => {
      const date = new Date();
      expect(validateDate(date, "test")).toBe(date);
    });

    it("should throw for invalid dates", () => {
      expect(() => validateDate(new Date("invalid"), "test")).toThrow(
        ValidationError,
      );
      expect(() => validateDate("2023-01-01", "test")).toThrow(ValidationError);
      expect(() => validateDate(null, "test")).toThrow(ValidationError);
    });
  });
});

describe("Array Validators", () => {
  describe("validateArray", () => {
    it("should validate array values", () => {
      expect(validateArray([], "test")).toEqual([]);
      expect(validateArray([1, 2, 3], "test")).toEqual([1, 2, 3]);
    });

    it("should throw for non-array values", () => {
      expect(() => validateArray("[]", "test")).toThrow(ValidationError);
      expect(() => validateArray(null, "test")).toThrow(ValidationError);
      expect(() => validateArray({}, "test")).toThrow(ValidationError);
    });
  });
});

describe("Object Validators", () => {
  describe("validateObject", () => {
    it("should validate object values", () => {
      const obj = { a: 1, b: 2 };
      expect(validateObject(obj, "test")).toBe(obj);
      expect(validateObject({}, "test")).toEqual({});
    });

    it("should throw for non-object values", () => {
      expect(() => validateObject(null, "test")).toThrow(ValidationError);
      expect(() => validateObject("{}", "test")).toThrow(ValidationError);
      expect(() => validateObject([], "test")).toThrow(ValidationError);
    });
  });
});

describe("ValidatorFactory", () => {
  let factory: ValidatorFactory;

  beforeEach(() => {
    factory = new ValidatorFactory();
  });

  describe("createValidator", () => {
    it("should create validator for simple interface", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "User",
        properties: [
          {
            name: "id",
            type: { kind: "number", nullable: false },
            optional: false,
            readonly: false,
          },
          {
            name: "name",
            type: { kind: "string", nullable: false },
            optional: false,
            readonly: false,
          },
          {
            name: "email",
            type: { kind: "string", nullable: false },
            optional: true,
            readonly: false,
          },
        ],
        filePath: "",
        exported: true,
      };

      const validator = factory.createValidator(interfaceInfo);

      const validUser = { id: 1, name: "John", email: "john@example.com" };
      expect(validator(validUser)).toEqual(validUser);

      const userWithoutEmail = { id: 2, name: "Jane" };
      expect(validator(userWithoutEmail)).toEqual(userWithoutEmail);

      expect(() => validator({ id: "1", name: "John" })).toThrow(
        ValidationError,
      );
      expect(() => validator({ name: "John" })).toThrow(ValidationError);
    });

    it("should create validator for array types", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "UserList",
        properties: [
          {
            name: "users",
            type: {
              kind: "array",
              elementType: { kind: "string", nullable: false },
              nullable: false,
            },
            optional: false,
            readonly: false,
          },
        ],
        filePath: "",
        exported: true,
      };

      const validator = factory.createValidator(interfaceInfo);

      expect(validator({ users: ["John", "Jane"] })).toEqual({
        users: ["John", "Jane"],
      });
      expect(() => validator({ users: [1, 2] })).toThrow(ValidationError);
      expect(() => validator({ users: "not-array" })).toThrow(ValidationError);
    });

    it("should cache validators", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "CachedType",
        properties: [],
        filePath: "",
        exported: true,
      };

      const validator1 = factory.createValidator(interfaceInfo);
      const validator2 = factory.createValidator(interfaceInfo);

      expect(validator1).toBe(validator2);
    });
  });

  describe("createTypeValidator", () => {
    it("should create validator for type info", () => {
      const typeInfo: TypeInfo = { kind: "string", nullable: false };
      const validator = factory.createTypeValidator(typeInfo);

      expect(validator("hello")).toBe("hello");
      expect(() => validator(123)).toThrow(ValidationError);
    });

    it("should handle union types", () => {
      const typeInfo: TypeInfo = {
        kind: "union",
        types: [
          { kind: "string", nullable: false },
          { kind: "number", nullable: false },
        ],
        nullable: false,
      };

      const validator = factory.createTypeValidator(typeInfo);

      expect(validator("hello")).toBe("hello");
      expect(validator(123)).toBe(123);
      expect(() => validator(true)).toThrow(ValidationError);
    });

    it("should handle literal types", () => {
      const typeInfo: TypeInfo = {
        kind: "literal",
        value: "success",
        literalType: "string",
        nullable: false,
      };

      const validator = factory.createTypeValidator(typeInfo);

      expect(validator("success")).toBe("success");
      expect(() => validator("failure")).toThrow(ValidationError);
      expect(() => validator(123)).toThrow(ValidationError);
    });
  });
});

describe("Integration Tests", () => {
  it("should validate complex nested objects", () => {
    const interfaceInfo: InterfaceInfo = {
      name: "ComplexUser",
      properties: [
        {
          name: "id",
          type: { kind: "number", nullable: false },
          optional: false,
          readonly: false,
        },
        {
          name: "name",
          type: { kind: "string", nullable: false },
          optional: false,
          readonly: false,
        },
        {
          name: "tags",
          type: {
            kind: "array",
            elementType: { kind: "string", nullable: false },
            nullable: false,
          },
          optional: false,
          readonly: false,
        },
        {
          name: "status",
          type: {
            kind: "union",
            types: [
              {
                kind: "literal",
                value: "active",
                literalType: "string",
                nullable: false,
              },
              {
                kind: "literal",
                value: "inactive",
                literalType: "string",
                nullable: false,
              },
            ],
            nullable: false,
          },
          optional: false,
          readonly: false,
        },
      ],
      filePath: "",
      exported: true,
    };

    const factory = new ValidatorFactory();
    const validator = factory.createValidator(interfaceInfo);

    const validData = {
      id: 1,
      name: "John Doe",
      tags: ["admin", "user"],
      status: "active",
    };

    expect(validator(validData)).toEqual(validData);

    expect(() =>
      validator({
        ...validData,
        status: "unknown",
      }),
    ).toThrow(ValidationError);

    expect(() =>
      validator({
        ...validData,
        tags: [123, 456],
      }),
    ).toThrow(ValidationError);
  });

  it("should provide detailed error paths for nested validation failures", () => {
    const interfaceInfo: InterfaceInfo = {
      name: "NestedUser",
      properties: [
        {
          name: "profile",
          type: {
            kind: "object",
            properties: [
              {
                name: "age",
                type: { kind: "number", nullable: false },
                optional: false,
                readonly: false,
              },
            ],
            nullable: false,
          },
          optional: false,
          readonly: false,
        },
      ],
      filePath: "",
      exported: true,
    };

    const factory = new ValidatorFactory();
    const validator = factory.createValidator(interfaceInfo);

    try {
      validator({ profile: { age: "twenty" } });
      throw new Error("Should have thrown ValidationError");
    } catch (error) {
      if (error instanceof ValidationError) {
        expect(error.path).toContain("age");
        expect(error.expected).toBe("number");
        expect(error.received).toBe("string");
      } else {
        throw new Error("Should have thrown ValidationError");
      }
    }
  });
});
