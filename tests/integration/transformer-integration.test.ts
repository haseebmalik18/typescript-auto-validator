import { describe, it, expect, beforeEach } from "@jest/globals";
import { InterfaceExtractor, CodeGenerator } from "../../src/transformer/index";

describe("Transformer Integration", () => {
  let extractor: InterfaceExtractor;
  let generator: CodeGenerator;

  beforeEach(() => {
    extractor = new InterfaceExtractor();
    generator = new CodeGenerator();
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
      const validator = generator.generateValidator(userInterface);
      expect(validator).toContain("validateUser");
      expect(validator).toContain("typeof obj.id !== 'number'");
      expect(validator).toContain("typeof obj.name !== 'string'");
    }
  });

  it("should handle nested objects", () => {
    const source = `
      export interface Address {
        street: string;
        city: string;
        zipCode: string;
      }

      export interface UserProfile {
        id: number;
        name: string;
        address: Address;
        settings: {
          theme: 'light' | 'dark';
          notifications: boolean;
        };
      }
    `;

    const interfaces = extractor.extractFromSource(source);

    const userProfileInterface = interfaces.find(
      (i) => i.name === "UserProfile",
    );
    expect(userProfileInterface).toBeDefined();

    if (userProfileInterface) {
      const addressProp = userProfileInterface.properties.find(
        (p) => p.name === "address",
      );
      expect(addressProp?.type.kind).toBe("reference");

      const settingsProp = userProfileInterface.properties.find(
        (p) => p.name === "settings",
      );
      expect(settingsProp?.type.kind).toBe("object");
    }
  });

  it("should generate complete validator bundle", () => {
    const source = `
      export interface User {
        id: number;
        name: string;
        email?: string;
      }
      
      export interface Product {
        id: number;
        title: string;
        price: number;
        tags: string[];
      }
    `;

    const interfaces = extractor.extractFromSource(source);
    const bundle = generator.generateValidatorBundle(interfaces);

    expect(bundle).toContain("validateUser");
    expect(bundle).toContain("validateProduct");
    expect(bundle).toContain("isUser");
    expect(bundle).toContain("isProduct");
    expect(bundle).toContain("ValidationError");

    const lines = bundle.split("\n");
    expect(lines.length).toBeGreaterThan(10);
  });
});
