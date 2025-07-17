import { describe, it, expect } from "@jest/globals";
import { InterfaceExtractor } from "../../src/transformer/index.js";
import { ValidatorGenerator } from "../../src/generator/validator-generator.js";
import { ValidatorFactory } from "../../src/validator/validator-factory.js";
import { ValidationError } from "../../src/validator/error-handler.js";
import typescriptValidator from "../../src/plugin/vite-plugin.js";

describe("Complete Workflow Integration", () => {
  describe("End-to-End: Interface → Validation → Runtime", () => {
    it("should work with real-world complex interfaces", () => {
      const complexInterface = `
        export interface User {
          id: number;
          username: string;
          email: string;
          profile: UserProfile;
          preferences: UserPreferences;
          roles: UserRole[];
          createdAt: Date;
          lastLogin?: Date;
          isActive: boolean;
        }

        export interface UserProfile {
          firstName: string;
          lastName: string;
          avatar?: string;
          location: {
            country: string;
            city: string;
            timezone: string;
          };
          socialLinks: {
            twitter?: string;
            github?: string;
          };
        }

        export interface UserPreferences {
          theme: 'light' | 'dark' | 'auto';
          language: 'en' | 'es' | 'fr';
          notifications: {
            email: boolean;
            push: boolean;
          };
        }

        export type UserRole = 'admin' | 'moderator' | 'user';
      `;

      const extractor = new InterfaceExtractor();
      const interfaces = extractor.extractFromSource(complexInterface);

      expect(interfaces).toHaveLength(4);

      const userInterface = interfaces.find((i) => i.name === "User")!;
      expect(userInterface).toBeDefined();
      expect(userInterface.properties).toHaveLength(9);

      const generator = new ValidatorGenerator();
      const validatorCode = generator.generateValidatorModule(interfaces);

      expect(validatorCode).toBeDefined();
      expect(validatorCode).toContain("validateUser");
      expect(validatorCode).toContain("validateUserProfile");
      expect(validatorCode).toContain("validateUserPreferences");

      // Test that the generated code compiles and works
      const factory = new ValidatorFactory();
      const userValidator = factory.createValidatorWithRegistry<any>(userInterface, interfaces);

      const validUser = {
        id: 1,
        username: "johndoe",
        email: "john@example.com",
        profile: {
          firstName: "John",
          lastName: "Doe",
          location: {
            country: "US",
            city: "New York",
            timezone: "America/New_York",
          },
          socialLinks: {
            github: "johndoe",
          },
        },
        preferences: {
          theme: "dark" as const,
          language: "en" as const,
          notifications: {
            email: true,
            push: false,
          },
        },
        roles: ["user" as const],
        createdAt: new Date(),
        isActive: true,
      };

      expect(() => userValidator(validUser)).not.toThrow();

      expect(() => {
        userValidator({
          ...validUser,
          id: "not-a-number",
        });
      }).toThrow(ValidationError);
    });

    it("should handle API response patterns", () => {
      const apiInterface = `
        export interface ApiResponse<T> {
          success: boolean;
          data?: T;
          error?: ApiError;
          timestamp: Date;
        }

        export interface ApiError {
          code: string;
          message: string;
          field?: string;
        }
      `;

      const extractor = new InterfaceExtractor();
      const interfaces = extractor.extractFromSource(apiInterface);

      const apiErrorInterface = interfaces.find((i) => i.name === "ApiError")!;
      const factory = new ValidatorFactory();
      const apiErrorValidator = factory.createValidatorWithRegistry(apiErrorInterface, interfaces);

      const validApiError = {
        code: "VALIDATION_ERROR",
        message: "Invalid email format",
        field: "email",
      };

      expect(apiErrorValidator(validApiError)).toEqual(validApiError);

      const apiErrorWithoutField = {
        code: "SERVER_ERROR",
        message: "Internal server error",
      };

      expect(apiErrorValidator(apiErrorWithoutField)).toEqual(
        apiErrorWithoutField,
      );
    });

    it("should handle e-commerce data structures", () => {
      const ecommerceInterface = `
        export interface Product {
          id: string;
          name: string;
          price: {
            amount: number;
            currency: 'USD' | 'EUR' | 'GBP';
          };
          category: ProductCategory;
          inventory: {
            quantity: number;
            available: number;
            reserved: number;
          };
          attributes: ProductAttribute[];
          status: 'active' | 'inactive' | 'discontinued';
        }

        export interface ProductCategory {
          id: string;
          name: string;
          slug: string;
          parentId?: string;
        }

        export interface ProductAttribute {
          name: string;
          value: string | number | boolean;
          type: 'text' | 'number' | 'boolean';
        }
      `;

      const extractor = new InterfaceExtractor();
      const interfaces = extractor.extractFromSource(ecommerceInterface);

      const productInterface = interfaces.find((i) => i.name === "Product")!;
      const factory = new ValidatorFactory();
      const productValidator = factory.createValidatorWithRegistry(productInterface, interfaces);

      const validProduct = {
        id: "prod-123",
        name: "MacBook Pro",
        price: {
          amount: 2499.99,
          currency: "USD" as const,
        },
        category: {
          id: "cat-electronics",
          name: "Electronics",
          slug: "electronics",
        },
        inventory: {
          quantity: 10,
          available: 8,
          reserved: 2,
        },
        attributes: [
          { name: "Screen Size", value: "16 inches", type: "text" as const },
          { name: "RAM", value: 32, type: "number" as const },
          { name: "Touch Bar", value: true, type: "boolean" as const },
        ],
        status: "active" as const,
      };

      expect(productValidator(validProduct)).toEqual(validProduct);

      expect(() => {
        productValidator({
          ...validProduct,
          price: {
            amount: "not-a-number",
            currency: "USD",
          },
        });
      }).toThrow(ValidationError);
    });
  });

  describe("Plugin Integration (Basic)", () => {
    it("should create plugin with correct structure", () => {
      const plugin = typescriptValidator({
        generateTypeGuards: true,
        watchMode: false,
      });

      expect(plugin.name).toBe("typescript-validator");
      expect(plugin).toHaveProperty("transform");
      expect(plugin).toHaveProperty("configResolved");
      expect(plugin).toHaveProperty("buildStart");
      expect(plugin).toHaveProperty("generateBundle");
      expect(plugin).toHaveProperty("handleHotUpdate");
    });

    it("should accept different configuration options", () => {
      const plugin1 = typescriptValidator();
      expect(plugin1.name).toBe("typescript-validator");

      const plugin2 = typescriptValidator({
        include: ["src/**/*.ts"],
        exclude: ["**/*.test.ts"],
        outputDir: "custom/output",
        generateTypeGuards: false,
        watchMode: true,
      });
      expect(plugin2.name).toBe("typescript-validator");
    });

    it("should be a valid Vite plugin", () => {
      const plugin = typescriptValidator();

      expect(typeof plugin.name).toBe("string");
      expect(plugin.name).toBe("typescript-validator");

      expect(typeof plugin.transform).toBe("function");
      expect(typeof plugin.configResolved).toBe("function");
      expect(typeof plugin.buildStart).toBe("function");
      expect(typeof plugin.generateBundle).toBe("function");
      expect(typeof plugin.handleHotUpdate).toBe("function");
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should provide detailed error messages for validation failures", () => {
      const extractor = new InterfaceExtractor();
      const factory = new ValidatorFactory();

      const source = `
        export interface NestedUser {
          id: number;
          profile: {
            personal: {
              name: string;
              age: number;
            };
            contact: {
              email: string;
              phone?: string;
            };
          };
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const validator = factory.createValidatorWithRegistry(interfaces[0], interfaces);

      try {
        validator({
          id: 1,
          profile: {
            personal: {
              name: "John",
              age: "twenty-five",
            },
            contact: {
              email: "john@example.com",
            },
          },
        });
        fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.path).toContain("age");
          expect(error.expected).toBe("number");
          expect(error.received).toBe("string");
        }
      }
    });

    it("should handle missing required fields", () => {
      const extractor = new InterfaceExtractor();
      const factory = new ValidatorFactory();

      const source = `
        export interface RequiredFields {
          id: number;
          name: string;
          email: string;
          optionalField?: string;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const validator = factory.createValidatorWithRegistry(interfaces[0], interfaces);

      expect(() => {
        validator({
          id: 1,
          name: "John",
        });
      }).toThrow(ValidationError);

      expect(() => {
        validator({
          id: 1,
          name: "John",
          email: "john@example.com",
        });
      }).not.toThrow();
    });

    it("should handle empty and null values correctly", () => {
      const extractor = new InterfaceExtractor();
      const factory = new ValidatorFactory();

      const source = `
        export interface NullableTest {
          id: number;
          name: string;
          description?: string;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const validator = factory.createValidatorWithRegistry(interfaces[0], interfaces);

      expect(() => {
        validator({
          id: null,
          name: "Test",
        });
      }).toThrow(ValidationError);

      expect(() => {
        validator({
          id: 1,
          name: "",
          description: "",
        });
      }).not.toThrow();

      expect(() => {
        validator({
          id: 1,
          name: "Test",
          description: undefined,
        });
      }).not.toThrow();
    });
  });

  describe("Performance & Caching", () => {
    it("should cache validators for performance", () => {
      const factory = new ValidatorFactory();

      const interfaceInfo = {
        name: "CacheTest",
        properties: [
          {
            name: "id",
            type: { kind: "number" as const, nullable: false },
            optional: false,
            readonly: false,
          },
        ],
        filePath: "",
        exported: true,
      };

      const validator1 = factory.createValidatorWithRegistry(interfaceInfo, []);
      const validator2 = factory.createValidatorWithRegistry(interfaceInfo, []);

      expect(validator1).toBe(validator2);
    });

    it("should handle large object validation efficiently", () => {
      const extractor = new InterfaceExtractor();
      const factory = new ValidatorFactory();

      const largeInterface = `
        export interface LargeObject {
          ${Array.from({ length: 20 }, (_, i) => `field${i}: string;`).join("\n")}
        }
      `;

      const interfaces = extractor.extractFromSource(largeInterface);
      const validator = factory.createValidatorWithRegistry(interfaces[0], interfaces);

      const largeData: any = {};
      for (let i = 0; i < 20; i++) {
        largeData[`field${i}`] = `value${i}`;
      }

      const start = performance.now();
      const result = validator(largeData);
      const end = performance.now();

      expect(result).toEqual(largeData);
      expect(end - start).toBeLessThan(10);
    });
  });

  describe("Library Completeness", () => {
    it("should export all necessary components", () => {
      expect(InterfaceExtractor).toBeDefined();
      expect(ValidatorGenerator).toBeDefined();
      expect(ValidatorFactory).toBeDefined();
      expect(ValidationError).toBeDefined();
      expect(typescriptValidator).toBeDefined();
    });

    it("should have working type guards", () => {
      const extractor = new InterfaceExtractor();
      const generator = new ValidatorGenerator();

      const source = `
        export interface SimpleInterface {
          id: number;
          name: string;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      expect(interfaces).toHaveLength(1);

      const moduleCode = generator.generateValidatorModule(interfaces);
      expect(moduleCode).toContain("validateSimpleInterface");
      expect(moduleCode).toContain("registerValidator");
    });

    it("should generate clean, readable code", () => {
      const interfaceInfo = {
        name: "TestInterface",
        properties: [
          {
            name: "id",
            type: { kind: "number" as const, nullable: false },
            optional: false,
            readonly: false,
          },
          {
            name: "name", 
            type: { kind: "string" as const, nullable: false },
            optional: false,
            readonly: false,
          },
        ],
        filePath: "/test/test.ts",
        exported: true,
      };

      const generator = new ValidatorGenerator();
      const functionCode = generator.generateValidatorFunction(interfaceInfo);

      expect(functionCode).toContain("validateTestInterface");
      expect(functionCode).toContain("typeof obj.id !== 'number'");
      expect(functionCode).toContain("typeof obj.name !== 'string'");
      expect(functionCode).toMatch(/Generated validator for TestInterface/);
    });
  });
});
