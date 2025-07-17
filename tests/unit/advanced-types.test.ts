import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ValidationError,
  ValidatorFactory,
  validateIntersection,
  validateTuple,
  validateLiteralUnion,
  validateDiscriminatedUnion,
  validateNull,
  validateUndefined,
  validateAny,
  validateUnknown,
  validateNever,
  validateString,
  validateNumber,
  validateBrandedType,
} from "../../src/validator/index";
import { TypeInfo, InterfaceInfo } from "../../src/types";

describe("Advanced Type Validation - Phase 2 Week 5", () => {
  let factory: ValidatorFactory;

  beforeEach(() => {
    factory = new ValidatorFactory();
  });

  describe("Intersection Types", () => {
    it("should validate intersection of two object types", () => {
      const validator1 = (value: unknown, path: string) => {
        if (typeof value !== 'object' || value === null) {
          throw new ValidationError(`Expected object at ${path}`);
        }
        const obj = value as any;
        if (typeof obj.name !== 'string') {
          throw new ValidationError(`Expected name to be string at ${path}`);
        }
        return { name: obj.name };
      };

      const validator2 = (value: unknown, path: string) => {
        if (typeof value !== 'object' || value === null) {
          throw new ValidationError(`Expected object at ${path}`);
        }
        const obj = value as any;
        if (typeof obj.age !== 'number') {
          throw new ValidationError(`Expected age to be number at ${path}`);
        }
        return { age: obj.age };
      };

      const result = validateIntersection(
        { name: "John", age: 30 },
        "user",
        [validator1, validator2]
      );

      expect(result).toEqual({ name: "John", age: 30 });
    });

    it("should fail intersection validation when one type fails", () => {
      const validator1 = () => ({ name: "John" });
      const validator2 = () => { throw new ValidationError("Age validation failed"); };

      expect(() => 
        validateIntersection(
          { name: "John", age: "not-a-number" },
          "user",
          [validator1, validator2]
        )
      ).toThrow(ValidationError);
    });

    it("should validate branded types", () => {
      const baseValidator = (value: unknown, path: string) => validateString(value, path);
      const emailValidator = (value: string) => /\S+@\S+\.\S+/.test(value);

      const result = validateBrandedType(
        "test@example.com",
        "email",
        baseValidator,
        emailValidator,
        "Email"
      );

      expect(result).toBe("test@example.com");
    });

    it("should fail branded type validation with invalid brand", () => {
      const baseValidator = (value: unknown, path: string) => validateString(value, path);
      const emailValidator = (value: string) => /\S+@\S+\.\S+/.test(value);

      expect(() =>
        validateBrandedType(
          "not-an-email",
          "email",
          baseValidator,
          emailValidator,
          "Email"
        )
      ).toThrow(ValidationError);
    });
  });

  describe("Tuple Types", () => {
    it("should validate fixed-length tuples", () => {
      const stringValidator = (value: unknown, path: string) => validateString(value, path);
      const numberValidator = (value: unknown, path: string) => validateNumber(value, path);

      const result = validateTuple(
        ["hello", 42],
        "tuple",
        [stringValidator, numberValidator]
      );

      expect(result).toEqual(["hello", 42]);
    });

    it("should fail tuple validation with wrong length", () => {
      const stringValidator = (value: unknown, path: string) => validateString(value, path);
      const numberValidator = (value: unknown, path: string) => validateNumber(value, path);

      expect(() =>
        validateTuple(
          ["hello"],
          "tuple",
          [stringValidator, numberValidator]
        )
      ).toThrow(ValidationError);
    });

    it("should validate variable-length tuples with rest elements", () => {
      const stringValidator = (value: unknown, path: string) => validateString(value, path);

      const result = validateTuple(
        ["first", "second", "third"],
        "tuple",
        [stringValidator],
        true // allowExtraElements
      );

      expect(result).toEqual(["first", "second", "third"]);
    });

    it("should validate tuple types through TypeInfo", () => {
      const tupleType: TypeInfo = {
        kind: "tuple",
        elementTypes: [
          { kind: "string", nullable: false },
          { kind: "number", nullable: false },
          { kind: "boolean", nullable: false }
        ],
        nullable: false
      };

      const validator = factory.createTypeValidator(tupleType);
      const result = validator(["hello", 42, true]);

      expect(result).toEqual(["hello", 42, true]);
    });
  });

  describe("Null and Undefined Types", () => {
    it("should validate null values", () => {
      expect(validateNull(null, "test")).toBe(null);
    });

    it("should fail null validation with non-null values", () => {
      expect(() => validateNull(undefined, "test")).toThrow(ValidationError);
      expect(() => validateNull("null", "test")).toThrow(ValidationError);
    });

    it("should validate undefined values", () => {
      expect(validateUndefined(undefined, "test")).toBe(undefined);
    });

    it("should fail undefined validation with non-undefined values", () => {
      expect(() => validateUndefined(null, "test")).toThrow(ValidationError);
      expect(() => validateUndefined("undefined", "test")).toThrow(ValidationError);
    });

    it("should handle nullable types through TypeInfo", () => {
      const nullableStringType: TypeInfo = {
        kind: "string",
        nullable: true
      };

      const validator = factory.createTypeValidator(nullableStringType);
      
      expect(validator("hello")).toBe("hello");
      expect(validator(null)).toBe(null);
    });
  });

  describe("Any, Unknown, and Never Types", () => {
    it("should validate any type accepts all values", () => {
      expect(validateAny("string", "test")).toBe("string");
      expect(validateAny(123, "test")).toBe(123);
      expect(validateAny(null, "test")).toBe(null);
      expect(validateAny(undefined, "test")).toBe(undefined);
      expect(validateAny([], "test")).toEqual([]);
      expect(validateAny({}, "test")).toEqual({});
    });

    it("should validate unknown type accepts all values", () => {
      expect(validateUnknown("string", "test")).toBe("string");
      expect(validateUnknown(123, "test")).toBe(123);
      expect(validateUnknown(null, "test")).toBe(null);
    });

    it("should validate never type rejects all values", () => {
      expect(() => validateNever("anything", "test")).toThrow(ValidationError);
      expect(() => validateNever(null, "test")).toThrow(ValidationError);
      expect(() => validateNever(undefined, "test")).toThrow(ValidationError);
    });
  });

  describe("Enhanced String Validation with Constraints", () => {
    it("should validate string length constraints", () => {
      expect(validateString("hello", "test", { minLength: 3, maxLength: 10 })).toBe("hello");
    });

    it("should fail string validation with length too short", () => {
      expect(() =>
        validateString("hi", "test", { minLength: 3 })
      ).toThrow(ValidationError);
    });

    it("should fail string validation with length too long", () => {
      expect(() =>
        validateString("this is too long", "test", { maxLength: 5 })
      ).toThrow(ValidationError);
    });

    it("should validate string pattern constraints", () => {
      expect(validateString("test@example.com", "email", { pattern: "\\S+@\\S+\\.\\S+" }))
        .toBe("test@example.com");
    });

    it("should fail string validation with pattern mismatch", () => {
      expect(() =>
        validateString("not-an-email", "email", { pattern: "\\S+@\\S+\\.\\S+" })
      ).toThrow(ValidationError);
    });
  });

  describe("Enhanced Number Validation with Constraints", () => {
    it("should validate number range constraints", () => {
      expect(validateNumber(15, "age", { min: 0, max: 100 })).toBe(15);
    });

    it("should fail number validation below minimum", () => {
      expect(() =>
        validateNumber(-5, "age", { min: 0 })
      ).toThrow(ValidationError);
    });

    it("should fail number validation above maximum", () => {
      expect(() =>
        validateNumber(150, "age", { max: 100 })
      ).toThrow(ValidationError);
    });
  });

  describe("Enhanced Literal Union Validation", () => {
    it("should validate sorted literal unions", () => {
      const result = validateLiteralUnion("success", "status", ["error", "success", "pending"]);
      expect(result).toBe("success");
    });

    it("should provide sorted options in error messages", () => {
      try {
        validateLiteralUnion("invalid", "status", ["error", "success", "pending"]);
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.message).toContain('"error", "pending", "success"');
        }
      }
    });

    it("should optimize literal union validation in factory", () => {
      const literalUnionType: TypeInfo = {
        kind: "union",
        types: [
          { kind: "literal", value: "red", literalType: "string", nullable: false },
          { kind: "literal", value: "green", literalType: "string", nullable: false },
          { kind: "literal", value: "blue", literalType: "string", nullable: false }
        ],
        nullable: false
      };

      const validator = factory.createTypeValidator(literalUnionType);
      expect(validator("red")).toBe("red");
      expect(validator("green")).toBe("green");
      expect(validator("blue")).toBe("blue");
      
      expect(() => validator("yellow")).toThrow(ValidationError);
    });
  });

  describe("Discriminated Union Validation", () => {
    it("should validate discriminated unions efficiently", () => {
      const typeMap = new Map<string, (value: unknown, path: string) => unknown>([
        ["circle", (value: unknown, path: string) => {
          const obj = value as any;
          if (typeof obj.radius !== 'number') {
            throw new ValidationError(`Expected radius to be number at ${path}`);
          }
          return { type: "circle", radius: obj.radius };
        }],
        ["rectangle", (value: unknown, path: string) => {
          const obj = value as any;
          if (typeof obj.width !== 'number' || typeof obj.height !== 'number') {
            throw new ValidationError(`Expected width and height to be numbers at ${path}`);
          }
          return { type: "rectangle", width: obj.width, height: obj.height };
        }]
      ]);

      const circle = validateDiscriminatedUnion(
        { type: "circle", radius: 5 },
        "shape",
        "type",
        typeMap
      );

      expect(circle).toEqual({ type: "circle", radius: 5 });

      const rectangle = validateDiscriminatedUnion(
        { type: "rectangle", width: 10, height: 20 },
        "shape",
        "type",
        typeMap
      );

      expect(rectangle).toEqual({ type: "rectangle", width: 10, height: 20 });
    });

    it("should fail discriminated union with invalid discriminant", () => {
      const typeMap = new Map<string, (value: unknown, path: string) => unknown>([
        ["circle", () => ({})]
      ]);

      expect(() =>
        validateDiscriminatedUnion(
          { type: "triangle", sides: 3 },
          "shape",
          "type",
          typeMap
        )
      ).toThrow(ValidationError);
    });

    it("should fail discriminated union with missing discriminant", () => {
      const typeMap = new Map<string, (value: unknown, path: string) => unknown>([
        ["circle", () => ({})]
      ]);

      expect(() =>
        validateDiscriminatedUnion(
          { radius: 5 },
          "shape",
          "type",
          typeMap
        )
      ).toThrow(ValidationError);
    });
  });

  describe("Complex Nested Object Validation", () => {
    it("should validate deeply nested objects with all advanced types", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "ComplexData",
        properties: [
          {
            name: "id",
            type: { kind: "number", nullable: false },
            optional: false,
            readonly: false,
          },
          {
            name: "metadata",
            type: {
              kind: "object",
              properties: [
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
                      { kind: "literal", value: "active", literalType: "string", nullable: false },
                      { kind: "literal", value: "inactive", literalType: "string", nullable: false },
                    ],
                    nullable: false,
                  },
                  optional: false,
                  readonly: false,
                },
                {
                  name: "coordinates",
                  type: {
                    kind: "tuple",
                    elementTypes: [
                      { kind: "number", nullable: false },
                      { kind: "number", nullable: false },
                    ],
                    nullable: false,
                  },
                  optional: true,
                  readonly: false,
                }
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

      const validator = factory.createValidator(interfaceInfo);

      const validData = {
        id: 1,
        metadata: {
          tags: ["urgent", "review"],
          status: "active",
          coordinates: [10.5, 20.3]
        }
      };

      const result = validator(validData);
      expect(result).toEqual(validData);
    });

    it("should provide detailed error paths for complex nested failures", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "NestedData",
        properties: [
          {
            name: "user",
            type: {
              kind: "object",
              properties: [
                {
                  name: "profile",
                  type: {
                    kind: "object",
                    properties: [
                      {
                        name: "settings",
                        type: {
                          kind: "object",
                          properties: [
                            {
                              name: "theme",
                              type: {
                                kind: "union",
                                types: [
                                  { kind: "literal", value: "light", literalType: "string", nullable: false },
                                  { kind: "literal", value: "dark", literalType: "string", nullable: false },
                                ],
                                nullable: false,
                              },
                              optional: false,
                              readonly: false,
                            }
                          ],
                          nullable: false,
                        },
                        optional: false,
                        readonly: false,
                      }
                    ],
                    nullable: false,
                  },
                  optional: false,
                  readonly: false,
                }
              ],
              nullable: false,
            },
            optional: false,
            readonly: false,
          }
        ],
        filePath: "",
        exported: true,
      };

      const validator = factory.createValidator(interfaceInfo);

      try {
        validator({
          user: {
            profile: {
              settings: {
                theme: "invalid-theme"
              }
            }
          }
        });
        throw new Error("Should have thrown ValidationError");
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.path).toContain("theme");
          expect(error.message).toContain("light");
          expect(error.message).toContain("dark");
        } else {
          throw new Error("Should have thrown ValidationError");
        }
      }
    });
  });
}); 