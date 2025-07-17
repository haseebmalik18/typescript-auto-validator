import { describe, it, expect, beforeEach } from "@jest/globals";
import { InterfaceExtractor } from "../../src/transformer/index";
import { ValidatorGenerator } from "../../src/generator/validator-generator";

describe("Transformer Integration", () => {
  let extractor: InterfaceExtractor;
  let generator: ValidatorGenerator;

  beforeEach(() => {
    extractor = new InterfaceExtractor();
    generator = new ValidatorGenerator();
  });

  it("should extract and generate validators for basic interfaces", () => {
    const source = `
      export interface User {
        id: number;
        name: string;
        email?: string;
        active: boolean;
      }
      
      export interface Product {
        id: number;
        title: string;
        price: number;
        inStock: boolean;
        tags: string[];
      }
    `;

    const interfaces = extractor.extractFromSource(source);

    expect(interfaces.length).toBeGreaterThan(0);

    const userInterface = interfaces.find((i) => i.name === "User");
    expect(userInterface).toBeDefined();

    if (userInterface) {
      const functionCode = generator.generateValidatorFunction(userInterface);
      expect(functionCode).toContain("validateUser");
      expect(functionCode).toContain("typeof obj.id !== 'number'");
      expect(functionCode).toContain("typeof obj.name !== 'string'");
    }

    const productInterface = interfaces.find((i) => i.name === "Product");
    expect(productInterface).toBeDefined();

    if (productInterface) {
      const functionCode = generator.generateValidatorFunction(productInterface);
      expect(functionCode).toContain("validateProduct");
      expect(functionCode).toContain("Array.isArray");
    }
  });

  it("should handle nested objects", () => {
    const source = `
      export interface Address {
        street: string;
        city: string;
        zipCode: string;
      }
      
      export interface Person {
        name: string;
        address: Address;
      }
    `;

    const interfaces = extractor.extractFromSource(source);
    expect(interfaces.length).toBeGreaterThan(0);

    const personInterface = interfaces.find((i) => i.name === "Person");
    expect(personInterface).toBeDefined();

    if (personInterface) {
      expect(personInterface.properties).toHaveLength(2);
      const addressProperty = personInterface.properties.find(
        (p) => p.name === "address",
      );
      expect(addressProperty).toBeDefined();
      expect(addressProperty?.type.kind).toBe("reference");
    }
  });

  it("should generate complete validator bundle", () => {
    const source = `
      export interface Config {
        apiUrl: string;
        timeout: number;
        retries: number;
      }
    `;

    const interfaces = extractor.extractFromSource(source);
    const moduleCode = generator.generateValidatorModule(interfaces);

    expect(moduleCode).toContain("validateConfig");
    expect(moduleCode).toContain("registerValidator");
    expect(moduleCode).toContain("import");
  });
});
