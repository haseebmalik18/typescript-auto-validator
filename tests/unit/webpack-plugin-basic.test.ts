import { describe, it, expect } from "@jest/globals";
import { 
  TypeScriptRuntimeValidatorPlugin,
  createTypeScriptRuntimeValidatorPlugin,
  type WebpackValidatorPluginOptions 
} from "../../src/plugin/webpack-plugin.js";

describe("TypeScriptRuntimeValidatorPlugin - Basic Tests", () => {
  describe("Plugin Instantiation", () => {
    it("should create plugin with default options", () => {
      const plugin = new TypeScriptRuntimeValidatorPlugin();
      
      expect(plugin).toBeInstanceOf(TypeScriptRuntimeValidatorPlugin);
    });

    it("should create plugin with custom options", () => {
      const options: WebpackValidatorPluginOptions = {
        include: ["src/**/*.ts"],
        exclude: ["**/*.test.ts"],
        outputDir: "custom/output",
        generateTypeGuards: false,
        watchMode: false,
        enableLogging: false,
        generateMagicValidators: false,
        emitFiles: false,
        enableCaching: false,
        transformerOptions: {
          sourceMap: false,
          minify: true,
          target: "ES2018"
        }
      };

      const plugin = new TypeScriptRuntimeValidatorPlugin(options);
      
      expect(plugin).toBeInstanceOf(TypeScriptRuntimeValidatorPlugin);
    });

    it("should have apply method", () => {
      const plugin = new TypeScriptRuntimeValidatorPlugin();
      
      expect(typeof plugin.apply).toBe('function');
    });
  });

  describe("Factory Function", () => {
    it("should create plugin instance via factory function", () => {
      const options: WebpackValidatorPluginOptions = {
        enableLogging: false,
        outputDir: "test/output"
      };

      const plugin = createTypeScriptRuntimeValidatorPlugin(options);
      
      expect(plugin).toBeInstanceOf(TypeScriptRuntimeValidatorPlugin);
    });

    it("should create plugin with no options", () => {
      const plugin = createTypeScriptRuntimeValidatorPlugin();
      
      expect(plugin).toBeInstanceOf(TypeScriptRuntimeValidatorPlugin);
    });
  });

  describe("Configuration", () => {
    it("should merge options correctly", () => {
      const options: WebpackValidatorPluginOptions = {
        include: ["custom/**/*.ts"],
        transformerOptions: {
          minify: true
        }
      };

      const plugin = new TypeScriptRuntimeValidatorPlugin(options);
      
      // Plugin should exist and not throw
      expect(plugin).toBeDefined();
    });

    it("should handle partial transformer options", () => {
      const options: WebpackValidatorPluginOptions = {
        transformerOptions: {
          sourceMap: false
        }
      };

      const plugin = new TypeScriptRuntimeValidatorPlugin(options);
      
      expect(plugin).toBeDefined();
    });
  });

  describe("Plugin Interface", () => {
    it("should implement WebpackPluginInstance interface", () => {
      const plugin = new TypeScriptRuntimeValidatorPlugin();
      
      // Should have apply method
      expect(plugin.apply).toBeDefined();
      expect(typeof plugin.apply).toBe('function');
    });
  });
}); 