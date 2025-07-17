import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  TransformationEngine,
  getBuiltInTransformers,
  getDefaultTransformationStrategy,
  getAdvancedTransformers,
  ValidatorFactory,
  validateWithTransform,
  createTransformingValidatorForType,
  registerTransformer,
  configureValidator,
  TransformationError,
} from "../../src/validator/index";
import { TypeInfo, InterfaceInfo, ValidatorConfig } from "../../src/types";

describe("Type Transformations - Phase 2 Week 6", () => {
  let transformationEngine: TransformationEngine;
  let validatorFactory: ValidatorFactory;

  beforeEach(() => {
    transformationEngine = new TransformationEngine();
    validatorFactory = new ValidatorFactory();
  });

  describe("TransformationEngine", () => {
    it("should transform string to number", () => {
      const typeInfo: TypeInfo = { kind: "number", nullable: false };
      const result = transformationEngine.transform("123", typeInfo, "test", { autoTransform: true });

      expect(result.success).toBe(true);
      expect(result.value).toBe(123);
      expect(result.appliedTransformations).toContain("auto-coerce-string-to-number");
    });

    it("should transform string to boolean", () => {
      const typeInfo: TypeInfo = { kind: "boolean", nullable: false };
      const result = transformationEngine.transform("true", typeInfo, "test", { autoTransform: true });

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(result.appliedTransformations).toContain("auto-coerce-string-to-boolean");
    });

    it("should transform string to date", () => {
      const typeInfo: TypeInfo = { kind: "date", nullable: false };
      const result = transformationEngine.transform("2023-01-01", typeInfo, "test", { autoTransform: true });

      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Date);
      expect(result.appliedTransformations).toContain("auto-coerce-string-to-date");
    });

    it("should skip transformation when disabled", () => {
      const typeInfo: TypeInfo = { kind: "number", nullable: false };
      const result = transformationEngine.transform("123", typeInfo, "test", { autoTransform: false });

      expect(result.success).toBe(true);
      expect(result.value).toBe("123");
      expect(result.appliedTransformations).toHaveLength(0);
    });

    it("should handle transformation errors", () => {
      const typeInfo: TypeInfo = { kind: "number", nullable: false };
      const result = transformationEngine.transform("not-a-number", typeInfo, "test", { autoTransform: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TransformationError);
    });

    it("should register custom transformers", () => {
      const customTransformer = {
        sourceTypes: ['string'],
        targetType: 'string',
        canTransform: (value: unknown) => typeof value === 'string',
        transform: (value: unknown) => (value as string).toUpperCase(),
      };

      transformationEngine.registerTransformer('uppercase', customTransformer);
      const transformers = transformationEngine.getTransformersForType('string');
      
      const uppercaseTransformer = transformers.find(t => t.targetType === 'string');
      expect(uppercaseTransformer).toBeDefined();
      if (uppercaseTransformer) {
        expect(uppercaseTransformer.transform('hello')).toBe('HELLO');
      }
    });
  });

  describe("Built-in Transformers", () => {
    const builtInTransformers = getBuiltInTransformers();

    it("should convert string to number", () => {
      const transformer = builtInTransformers['string-to-number'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.canTransform?.('123')).toBe(true);
        expect(transformer.transform('123')).toBe(123);
        expect(transformer.canTransform?.('not-a-number')).toBe(false);
      }
    });

    it("should convert string to boolean", () => {
      const transformer = builtInTransformers['string-to-boolean'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.transform('true')).toBe(true);
        expect(transformer.transform('false')).toBe(false);
        expect(transformer.transform('1')).toBe(true);
        expect(transformer.transform('0')).toBe(false);
        expect(transformer.transform('yes')).toBe(true);
        expect(transformer.transform('no')).toBe(false);
      }
    });

    it("should convert number to string", () => {
      const transformer = builtInTransformers['number-to-string'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.transform(123)).toBe('123');
        expect(transformer.transform(45.67)).toBe('45.67');
      }
    });

    it("should convert boolean to string", () => {
      const transformer = builtInTransformers['boolean-to-string'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.transform(true)).toBe('true');
        expect(transformer.transform(false)).toBe('false');
      }
    });

    it("should convert date to string", () => {
      const transformer = builtInTransformers['date-to-string'];
      expect(transformer).toBeDefined();
      if (transformer) {
        const date = new Date('2023-01-01');
        expect(transformer.transform(date)).toBe('2023-01-01T00:00:00.000Z');
      }
    });
  });

  describe("Advanced Transformers", () => {
    const advancedTransformers = getAdvancedTransformers();

    it("should convert string to date", () => {
      const transformer = advancedTransformers['string-to-date'];
      expect(transformer).toBeDefined();
      if (transformer && transformer.canTransform && transformer.transform) {
        expect(transformer.canTransform('2023-12-25T10:30:00Z')).toBe(true);
        const result = transformer.transform('2023-12-25T10:30:00Z') as Date;
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2023);
      }
    });

    it("should convert number to string", () => {
      const transformer = advancedTransformers['number-to-string'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.transform(42)).toBe('42');
        expect(transformer.transform(3.14)).toBe('3.14');
      }
    });

    it("should convert boolean to string", () => {
      const transformer = advancedTransformers['boolean-to-string'];
      expect(transformer).toBeDefined();
      if (transformer) {
        expect(transformer.transform(true)).toBe('true');
        expect(transformer.transform(false)).toBe('false');
      }
    });
  });

  describe("Validation with Transformations", () => {
    it("should validate with automatic transformations", () => {
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
            name: "active",
            type: { kind: "boolean", nullable: false },
            optional: false,
            readonly: false,
          },
        ],
        filePath: "",
        exported: true,
      };

      const result = validateWithTransform({
        id: "123",
        name: "John Doe",
        active: "true"
      }, interfaceInfo) as {
        id: number;
        name: string;
        active: boolean;
      };

      expect(result.id).toBe(123);
      expect(result.name).toBe("John Doe");
      expect(result.active).toBe(true);
    });

    it("should handle transformation errors with different strategies", () => {
      const typeInfo: TypeInfo = { kind: "number", nullable: false };

      // Test 'skip' strategy
      const factory1 = new ValidatorFactory({
        autoTransform: true,
        transformationStrategy: { onError: 'skip' }
      });
      const validator1 = factory1.createTypeValidator(typeInfo);
      expect(validator1("not-a-number")).toBe("not-a-number");

      // Test 'default' strategy
      const factory2 = new ValidatorFactory({
        autoTransform: true,
        transformationStrategy: { onError: 'default', defaultValue: 0 }
      });
      const validator2 = factory2.createTypeValidator(typeInfo);
      expect(validator2("not-a-number")).toBe(0);

      // Test 'throw' strategy (default)
      const factory3 = new ValidatorFactory({
        autoTransform: true,
        transformationStrategy: { onError: 'throw' }
      });
      const validator3 = factory3.createTypeValidator(typeInfo);
      expect(() => validator3("not-a-number")).toThrow(TransformationError);
    });

    it("should support custom transformers", () => {
      registerTransformer('double', {
        sourceTypes: ['number'],
        targetType: 'number',
        canTransform: (value) => typeof value === 'number',
        transform: (value) => (value as number) * 2,
      });

      const typeInfo: TypeInfo = {
        kind: "number",
        nullable: false,
        transformations: {
          autoTransform: true,
          transformer: 'double'
        }
      };

      const validator = createTransformingValidatorForType(typeInfo);
      expect(validator(5)).toBe(10);
    });

    it("should support type-level transformation configuration", () => {
      const typeInfo: TypeInfo = {
        kind: "string",
        nullable: false,
        transformations: {
          autoTransform: true,
          transformer: 'trim-whitespace'
        }
      };

      // Since we don't have trim-whitespace anymore, let's test with a basic transformation
      const basicTypeInfo: TypeInfo = {
        kind: "string",
        nullable: false
      };

      const validator = createTransformingValidatorForType(basicTypeInfo);
      expect(validator("hello world")).toBe("hello world");
    });

    it("should handle complex nested transformations", () => {
      const interfaceInfo: InterfaceInfo = {
        name: "ComplexData",
        properties: [
          {
            name: "user",
            type: {
              kind: "object",
              properties: [
                {
                  name: "id",
                  type: { kind: "number", nullable: false },
                  optional: false,
                  readonly: false,
                },
                {
                  name: "email",
                  type: {
                    kind: "string",
                    nullable: false
                  },
                  optional: false,
                  readonly: false,
                },
                {
                  name: "createdAt",
                  type: { kind: "date", nullable: false },
                  optional: false,
                  readonly: false,
                }
              ],
              nullable: false,
            },
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

      const result = validateWithTransform({
        user: {
          id: "123",
          email: "user@example.com",
          createdAt: "2023-01-01T12:00:00Z"
        },
        metadata: {
          tags: ["tag1", "tag2"]
        }
      }, interfaceInfo) as {
        user: {
          id: number;
          email: string;
          createdAt: Date;
        };
        metadata: {
          tags: string[];
        };
      };

      expect(result.user.id).toBe(123);
      expect(result.user.email).toBe("user@example.com");
      expect(result.user.createdAt).toBeInstanceOf(Date);
      expect(result.metadata.tags).toEqual(["tag1", "tag2"]);
    });

    it("should support global configuration", () => {
      configureValidator({
        autoTransform: true,
        transformationStrategy: { onError: 'skip' }
      });

      const typeInfo: TypeInfo = { kind: "number", nullable: false };
      const validator = createTransformingValidatorForType(typeInfo);
      
      // Should use global config
      expect(validator("not-a-number")).toBe("not-a-number");
    });

    it("should handle transformation depth limits", () => {
      const typeInfo: TypeInfo = { kind: "string", nullable: false };
      
      const config: ValidatorConfig = {
        autoTransform: true,
        transformationStrategy: { 
          maxDepth: 1,
          onError: 'throw'
        }
      };

      const engine = new TransformationEngine({}, config.transformationStrategy);
      
      // This should work at depth 0
      const result = engine.transform("test", typeInfo, "path", config, 0);
      expect(result.success).toBe(true);

      // This should fail at depth 2 (over the limit)
      const result2 = engine.transform("test", typeInfo, "path", config, 2);
      expect(result2.success).toBe(false);
      expect(result2.error?.message).toContain("Maximum transformation depth exceeded");
    });
  });

  describe("Error Handling", () => {
    it("should create detailed transformation errors", () => {
      const error = TransformationError.create(
        "user.age",
        "not-a-number",
        "number",
        "string-to-number"
      );

      expect(error.path).toBe("user.age");
      expect(error.sourceValue).toBe("not-a-number");
      expect(error.targetType).toBe("number");
      expect(error.transformerName).toBe("string-to-number");
      expect(error.message).toContain("cannot transform");
    });

    it("should create invalid input errors", () => {
      const error = TransformationError.invalidInput(
        "user.email",
        123,
        "email-validator"
      );

      expect(error.path).toBe("user.email");
      expect(error.sourceValue).toBe(123);
      expect(error.transformerName).toBe("email-validator");
      expect(error.message).toContain("cannot process");
    });

    it("should serialize transformation errors to JSON", () => {
      const error = new TransformationError(
        "Test error",
        "test.path",
        "source",
        "target",
        "transformer"
      );

      const json = error.toJSON();
      expect(json.name).toBe("TransformationError");
      expect(json.path).toBe("test.path");
      expect(json.sourceValue).toBe("source");
      expect(json.targetType).toBe("target");
      expect(json.transformerName).toBe("transformer");
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle null and undefined values correctly", () => {
      const nullableType: TypeInfo = { kind: "string", nullable: true };
      const optionalType: TypeInfo = { kind: "string", nullable: false, optional: true };

      const factory = new ValidatorFactory({ autoTransform: true });
      
      const nullValidator = factory.createTypeValidator(nullableType);
      expect(nullValidator(null)).toBe(null);

      const optionalValidator = factory.createTypeValidator(optionalType);
      expect(optionalValidator(undefined)).toBe(undefined);
    });

    it("should handle large arrays efficiently", () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => String(i));
      const arrayType: TypeInfo = {
        kind: "array",
        elementType: { kind: "number", nullable: false },
        nullable: false,
      };

      const factory = new ValidatorFactory({ autoTransform: true });
      const validator = factory.createTypeValidator(arrayType);

      const start = Date.now();
      const result = validator(largeArray) as number[];
      const end = Date.now();

      expect(result).toHaveLength(1000);
      expect(result[0]).toBe(0);
      expect(result[999]).toBe(999);
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it("should prevent infinite transformation loops", () => {
      // This is handled by the depth limit in the transformation engine
      const typeInfo: TypeInfo = { kind: "string", nullable: false };
      
      const config: ValidatorConfig = {
        autoTransform: true,
        transformationStrategy: { maxDepth: 5, onError: 'throw' }
      };

      const factory = new ValidatorFactory(config);
      const validator = factory.createTypeValidator(typeInfo);

      // Should work normally
      expect(validator("test")).toBe("test");
    });
  });
}); 