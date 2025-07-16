import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  InterfaceExtractor,
  TypeAnalyzer,
  CodeGenerator,
} from "../../src/transformer/index";

describe("InterfaceExtractor", () => {
  let extractor: InterfaceExtractor;

  beforeEach(() => {
    extractor = new InterfaceExtractor();
  });

  describe("extractFromSource", () => {
    it("should extract basic interface", () => {
      const source = `
        interface User {
          id: number;
          name: string;
          email?: string;
        }
      `;

      const interfaces = extractor.extractFromSource(source);

      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe("User");
      expect(interfaces[0].properties).toHaveLength(3);

      const [id, name, email] = interfaces[0].properties;
      expect(id.name).toBe("id");
      expect(id.type.kind).toBe("number");
      expect(id.optional).toBe(false);

      expect(name.name).toBe("name");
      expect(name.type.kind).toBe("string");
      expect(name.optional).toBe(false);

      expect(email.name).toBe("email");
      expect(email.type.kind).toBe("string");
      expect(email.optional).toBe(true);
    });

    it("should extract array types", () => {
      const source = `
        interface Product {
          tags: string[];
          reviews: Review[];
        }
        
        interface Review {
          rating: number;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const product = interfaces.find((i) => i.name === "Product")!;

      const tags = product.properties.find((p) => p.name === "tags")!;
      expect(tags.type.kind).toBe("array");
      expect(tags.type.elementType?.kind).toBe("string");

      const reviews = product.properties.find((p) => p.name === "reviews")!;
      expect(reviews.type.kind).toBe("array");
      expect(reviews.type.elementType?.kind).toBe("reference");
      expect(reviews.type.elementType?.name).toBe("Review");
    });

    it("should extract union types", () => {
      const source = `
        interface Config {
          mode: 'development' | 'production';
          value: string | number;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const config = interfaces[0];

      const mode = config.properties.find((p) => p.name === "mode")!;
      expect(mode.type.kind).toBe("union");
      expect(mode.type.types).toHaveLength(2);
      expect(mode.type.types![0].kind).toBe("literal");
      expect(mode.type.types![0].value).toBe("development");

      const value = config.properties.find((p) => p.name === "value")!;
      expect(value.type.kind).toBe("union");
      expect(value.type.types![0].kind).toBe("string");
      expect(value.type.types![1].kind).toBe("number");
    });

    it("should handle Date types", () => {
      const source = `
        interface Event {
          timestamp: Date;
          createdAt: Date;
        }
      `;

      const interfaces = extractor.extractFromSource(source);
      const event = interfaces[0];

      const timestamp = event.properties.find((p) => p.name === "timestamp")!;
      expect(timestamp.type.kind).toBe("date");
    });

    it("should detect exported interfaces", () => {
      const source = `
        export interface PublicUser {
          id: number;
        }
        
        interface PrivateUser {
          id: number;
        }
      `;

      const interfaces = extractor.extractFromSource(source);

      const publicUser = interfaces.find((i) => i.name === "PublicUser")!;
      expect(publicUser.exported).toBe(true);

      const privateUser = interfaces.find((i) => i.name === "PrivateUser")!;
      expect(privateUser.exported).toBe(false);
    });
  });
});

describe("TypeAnalyzer", () => {
  let analyzer: TypeAnalyzer;

  beforeEach(() => {
    analyzer = new TypeAnalyzer();
  });

  describe("analyzeInterfaceDependencies", () => {
    it("should find type dependencies", () => {
      const properties = [
        {
          name: "user",
          type: { kind: "reference" as const, name: "User", nullable: false },
          optional: false,
          readonly: false,
        },
        {
          name: "address",
          type: {
            kind: "reference" as const,
            name: "Address",
            nullable: false,
          },
          optional: false,
          readonly: false,
        },
      ];

      const dependencies = analyzer.analyzeInterfaceDependencies(properties);
      expect(dependencies).toContain("User");
      expect(dependencies).toContain("Address");
    });

    it("should find nested dependencies", () => {
      const properties = [
        {
          name: "data",
          type: {
            kind: "array" as const,
            elementType: {
              kind: "reference" as const,
              name: "Item",
              nullable: false,
            },
            nullable: false,
          },
          optional: false,
          readonly: false,
        },
      ];

      const dependencies = analyzer.analyzeInterfaceDependencies(properties);
      expect(dependencies).toContain("Item");
    });
  });

  describe("getValidationComplexity", () => {
    it("should calculate complexity for primitive types", () => {
      expect(
        analyzer.getValidationComplexity({ kind: "string", nullable: false }),
      ).toBe(1);
      expect(
        analyzer.getValidationComplexity({ kind: "number", nullable: false }),
      ).toBe(1);
      expect(
        analyzer.getValidationComplexity({ kind: "boolean", nullable: false }),
      ).toBe(1);
    });

    it("should calculate complexity for complex types", () => {
      const arrayType = {
        kind: "array" as const,
        elementType: { kind: "string" as const, nullable: false },
        nullable: false,
      };
      expect(analyzer.getValidationComplexity(arrayType)).toBe(4);

      const unionType = {
        kind: "union" as const,
        types: [
          { kind: "string" as const, nullable: false },
          { kind: "number" as const, nullable: false },
        ],
        nullable: false,
      };
      expect(analyzer.getValidationComplexity(unionType)).toBe(3);
    });
  });
});

describe("CodeGenerator", () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe("generateValidator", () => {
    it("should generate validator for simple interface", () => {
      const interfaceInfo = {
        name: "User",
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
        filePath: "",
        exported: true,
      };

      const validator = generator.generateValidator(interfaceInfo);

      expect(validator).toContain("function validateUser");
      expect(validator).toContain("typeof value !== 'object'");
      expect(validator).toContain("typeof obj.id !== 'number'");
      expect(validator).toContain("typeof obj.name !== 'string'");
    });

    it("should generate validator for array types", () => {
      const interfaceInfo = {
        name: "ProductList",
        properties: [
          {
            name: "items",
            type: {
              kind: "array" as const,
              elementType: { kind: "string" as const, nullable: false },
              nullable: false,
            },
            optional: false,
            readonly: false,
          },
        ],
        filePath: "",
        exported: true,
      };

      const validator = generator.generateValidator(interfaceInfo);

      expect(validator).toContain("Array.isArray");
      expect(validator).toContain("forEach");
    });

    it("should generate type guard function", () => {
      const interfaceInfo = {
        name: "User",
        properties: [],
        filePath: "",
        exported: true,
      };

      const typeGuard = generator.generateTypeGuard(interfaceInfo);

      expect(typeGuard).toContain("function isUser");
      expect(typeGuard).toContain("value is User");
      expect(typeGuard).toContain("validateUser(value)");
      expect(typeGuard).toContain("return true");
      expect(typeGuard).toContain("return false");
    });
  });
});
