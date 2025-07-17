import { Plugin } from "vite";
import { resolve, dirname, basename, isAbsolute } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { InterfaceExtractor } from "../transformer/interface-extractor.js";
import { ValidatorGenerator } from "../generator/validator-generator.js";
import { InterfaceInfo } from "../types.js";

export interface ValidatorPluginOptions {
  include?: string[];
  exclude?: string[];
  outputDir?: string;
  generateTypeGuards?: boolean;
  watchMode?: boolean;
  enableLogging?: boolean;
  generateMagicValidators?: boolean;
}

export default function typescriptValidator(
  options: ValidatorPluginOptions = {},
): Plugin {
  const {
    include = ["**/*.ts", "**/*.tsx"],
    exclude = ["node_modules/**", "**/*.test.ts", "**/*.spec.ts"],
    outputDir = "src/generated",
    generateTypeGuards = true,
    watchMode = true,
    enableLogging = true,
    generateMagicValidators = true,
  } = options;

  const extractor = new InterfaceExtractor();
  const generator = new ValidatorGenerator();
  const processedFiles = new Set<string>();
  const allInterfaces = new Map<string, InterfaceInfo>();
  let resolvedOutputDir = outputDir;
  let configRoot = process.cwd();

  function shouldProcessFile(id: string): boolean {
    const includeMatch = include.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
      );
      return regex.test(id);
    });

    if (!includeMatch) return false;

    const excludeMatch = exclude.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
      );
      return regex.test(id);
    });

    return !excludeMatch;
  }

  function normalizeFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }
    
    if (filePath.startsWith("/")) {
      return resolve(configRoot, filePath.slice(1));
    }
    
    return resolve(configRoot, filePath);
  }

  function generateValidatorsForFile(filePath: string): InterfaceInfo[] | null {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      const interfaces = extractor.extractFromFile(normalizedPath);
      
      if (enableLogging !== false && interfaces.length > 0) {
        console.log(`📝 Found ${interfaces.length} interface(s) in ${basename(filePath)}: ${interfaces.map(i => i.name).join(', ')}`);
      }

      return interfaces;
    } catch (error) {
      if (enableLogging !== false) {
        console.warn(`Failed to generate validators for ${filePath}:`, error);
      }
      return null;
    }
  }

  function generateMagicValidatorModule(): void {
    if (!generateMagicValidators) return;

    const allInterfaceList = Array.from(allInterfaces.values());
    if (allInterfaceList.length === 0) {
      return;
    }

    try {
      if (!existsSync(resolvedOutputDir)) {
        mkdirSync(resolvedOutputDir, { recursive: true });
      }

      const moduleCode = generator.generateValidatorModule(allInterfaceList);
      const outputPath = resolve(resolvedOutputDir, "magic-validators.ts");
      
      writeFileSync(outputPath, moduleCode);
      
      if (enableLogging !== false) {
        console.log(`🎯 Generated magic validators for ${allInterfaceList.length} interfaces`);
      }
    } catch (error) {
      console.error("Failed to generate magic validator module:", error);
    }
  }

  return {
    name: "typescript-validator",
    configResolved(config) {
      configRoot = config.root;
      resolvedOutputDir = resolve(configRoot, outputDir);
    },

    buildStart() {
      if (enableLogging !== false) {
        console.log("🚀 TypeScript Runtime Validator starting...");
      }
      
      allInterfaces.clear();
      processedFiles.clear();
    },

    load(id) {
      if (generateMagicValidators && id.includes('src/index')) {
        return null;
      }
      return null;
    },

    transform(code, id) {
      if (!shouldProcessFile(id)) {
        return null;
      }

      try {
        const interfaces = generateValidatorsForFile(id);
        if (interfaces && interfaces.length > 0) {
          interfaces.forEach(iface => {
            allInterfaces.set(iface.name, iface);
          });
          processedFiles.add(id);
        }

        return null;
      } catch (error) {
        if (enableLogging !== false) {
          console.warn(`Failed to process ${id}:`, error);
        }
        return null;
      }
    },

    generateBundle() {
      generateMagicValidatorModule();

      if (enableLogging !== false) {
        console.log(`✅ TypeScript Runtime Validator generation complete!`);
      }
    },

    handleHotUpdate(ctx) {
      if (!watchMode) return;

      const { file } = ctx;
      
      if (!shouldProcessFile(file)) {
        return;
      }

      try {
        const interfaces = generateValidatorsForFile(file);
        if (interfaces && interfaces.length > 0) {
          interfaces.forEach(iface => {
            allInterfaces.set(iface.name, iface);
          });

          generateMagicValidatorModule();
          
          if (enableLogging !== false) {
            console.log(`🔥 Hot-reloaded validators for ${interfaces.map(i => i.name).join(', ')}`);
          }
        }
      } catch (error) {
        if (enableLogging !== false) {
          console.warn(`Failed to hot-reload validators for ${file}:`, error);
        }
      }
    },
  };
}
