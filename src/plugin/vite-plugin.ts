import { Plugin } from "vite";
import { resolve, isAbsolute } from "path";
import { InterfaceExtractor } from "../transformer/interface-extractor.js";
import { ValidatorGenerator } from "../generator/validator-generator.js";
import { InterfaceInfo } from "../types.js";
import { fileSystem, FileSystemOperations } from "../utils/filesystem.js";

export interface ValidatorPluginOptions {
  include?: string[];
  exclude?: string[];
  outputDir?: string;
  generateTypeGuards?: boolean;
  watchMode?: boolean;
  enableLogging?: boolean;
  generateAutoValidators?: boolean;
  fileSystem?: FileSystemOperations;
}

export default function typescriptValidator(
  options: ValidatorPluginOptions = {},
): Plugin {
  const {
    include = ["**/*.ts", "**/*.tsx"],
    exclude = ["node_modules/**", "**/*.test.ts", "**/*.spec.ts"],
    outputDir = "src/generated",
    _generateTypeGuards = true, // Currently unused but kept for future feature
    watchMode = true,
    enableLogging = true,
    generateAutoValidators = true,
    fileSystem: fs = fileSystem,
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
      
      // Interfaces found and processed

      return interfaces;
    } catch (error) {
      // Skip files that fail to process
      return null;
    }
  }

  function generateAutoValidatorModule(): void {
    if (!generateAutoValidators) return;

    const allInterfaceList = Array.from(allInterfaces.values());
    if (allInterfaceList.length === 0) {
      return;
    }

    try {
      // Directory creation is handled by filesystem abstraction

      const moduleCode = generator.generateValidatorModule(allInterfaceList);
      const outputPath = resolve(resolvedOutputDir, "auto-validators.ts");
      
      fs.writeFile(outputPath, moduleCode);
      
      // Auto validators generated successfully
    } catch (error) {
      // Failed to generate auto validator module
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
        // ts-auto-validator starting
      }
      
      allInterfaces.clear();
      processedFiles.clear();
    },

    load(id) {
      if (generateAutoValidators && id.includes('src/index')) {
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
          // Failed to process file
        }
        return null;
      }
    },

    generateBundle() {
      generateAutoValidatorModule();

      // ts-auto-validator generation complete
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

          generateAutoValidatorModule();
          
          // Hot-reloaded validators
        }
      } catch (error) {
        // Failed to hot-reload validators
      }
    },
  };
}
