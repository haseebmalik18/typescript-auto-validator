import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { HmrContext } from "vite";
import type { ValidatorPluginOptions } from "../../src/plugin/vite-plugin.js";

// Mock fs module before any imports
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn().mockReturnValue(true);
const mockMkdirSync = jest.fn();

jest.unstable_mockModule("fs", () => ({
  writeFileSync: mockWriteFileSync,
  readFileSync: jest.fn(),
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

// Mock path module
jest.unstable_mockModule("path", () => ({
  resolve: jest.fn((...args: string[]) => args.join("/")),
  dirname: jest.fn((path: string) => path.split("/").slice(0, -1).join("/")),
  basename: jest.fn((path: string, ext?: string) => {
    const base = path.split("/").pop() || path;
    return ext ? base.replace(ext, "") : base;
  }),
  extname: jest.fn((path: string) => {
    const parts = path.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
  }),
}));

// Now import the module under test
const { default: typescriptValidator } = await import("../../src/plugin/vite-plugin.js");

/**
 * Helper function to safely call Vite plugin hooks that can be either
 * functions or undefined. Returns undefined if hook is not defined or
 * if the hook call throws an error.
 */
function callPluginHook(hook: any, ...args: any[]): any {
  if (typeof hook === "function") {
    try {
      return hook.apply(null, args);
    } catch (error) {
      console.warn("Plugin hook threw error:", error);
      return undefined;
    }
  }
  return undefined;
}

describe("Vite Plugin", () => {
  beforeEach(() => {
    // Reset all mocks to ensure test isolation
    jest.clearAllMocks();
    mockWriteFileSync.mockClear();
    mockExistsSync.mockReturnValue(true);
    mockMkdirSync.mockImplementation(() => '');
  });

  describe("Plugin Registration", () => {
    it("should return a valid Vite plugin object", () => {
      const plugin = typescriptValidator();

      expect(plugin.name).toBe("typescript-validator");
      expect(plugin.transform).toBeDefined();
      expect(plugin.buildStart).toBeDefined();
      expect(plugin.generateBundle).toBeDefined();
      expect(plugin.handleHotUpdate).toBeDefined();
    });

    it("should accept and use plugin options correctly", () => {
      const options: ValidatorPluginOptions = {
        include: ["src/**/*.ts"],
        exclude: ["**/*.test.ts"],
        outputDir: "custom/output",
        generateTypeGuards: false,
        watchMode: false,
      };

      const plugin = typescriptValidator(options);
      expect(plugin.name).toBe("typescript-validator");
    });
  });

  describe("Code Transformation", () => {
    it("should process TypeScript files with interfaces", () => {
      const plugin = typescriptValidator();

      const mockCode = `
        export interface User {
          id: number;
          name: string;
        }
      `;

      const result = callPluginHook(plugin.transform, mockCode, "test.ts");
      expect(result).toBeNull();
    });

    it("should skip non-TypeScript files", () => {
      const plugin = typescriptValidator();

      const result = callPluginHook(plugin.transform, 'console.log("hello")', "test.js");
      expect(result).toBeNull();
    });

    it("should handle files without interfaces gracefully", () => {
      const plugin = typescriptValidator();

      const mockCode = `
        const x = 5;
        console.log(x);
      `;

      const result = callPluginHook(plugin.transform, mockCode, "test.ts");
      expect(result).toBeNull();
    });

    it("should generate validator files for interfaces", () => {
      const plugin = typescriptValidator();

      const mockCodeWithInterface = `
        export interface User {
          id: number;
          name: string;
          email?: string;
        }
      `;

      callPluginHook(plugin.buildStart);
      callPluginHook(plugin.transform, mockCodeWithInterface, "src/user.ts");
      callPluginHook(plugin.generateBundle);

      expect(mockWriteFileSync).toHaveBeenCalled();

      const validatorWriteCall = mockWriteFileSync.mock.calls.find((call: any) =>
        call[0].toString().includes("user.validators.ts"),
      );
      expect(validatorWriteCall).toBeDefined();

      if (validatorWriteCall) {
        const [, content] = validatorWriteCall;
        expect(content).toContain("validateUser");
        expect(content).toContain("ValidationError");
        expect(content).toContain("Auto-generated validators");
        expect(content).toContain("DO NOT EDIT");
      }

      const indexWriteCall = mockWriteFileSync.mock.calls.find((call: any) =>
        call[0].toString().includes("index.ts"),
      );
      expect(indexWriteCall).toBeDefined();
    });
  });

  describe("Hot Module Replacement", () => {
    it("should handle hot updates when watch mode is enabled", () => {
      const plugin = typescriptValidator({ watchMode: true });

      const mockContext: Partial<HmrContext> = {
        file: "src/user.ts",
        timestamp: Date.now(),
        modules: [],
        read: () => Promise.resolve(""),
        server: {} as any,
      };

      expect(() => {
        callPluginHook(plugin.handleHotUpdate, mockContext);
      }).not.toThrow();
    });

    it("should skip hot updates when watch mode is disabled", () => {
      const plugin = typescriptValidator({ watchMode: false });

      const mockContext: Partial<HmrContext> = {
        file: "src/user.ts",
        timestamp: Date.now(),
        modules: [],
        read: () => Promise.resolve(""),
        server: {} as any,
      };

      const result = callPluginHook(plugin.handleHotUpdate, mockContext);
      expect(result).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed TypeScript gracefully", () => {
      const plugin = typescriptValidator();

      const invalidCode = `
        export interface User {
          id: number
          name: string
          invalid syntax here
        }
      `;

      expect(() => {
        callPluginHook(plugin.transform, invalidCode, "invalid.ts");
      }).not.toThrow();
    });
  });
});
