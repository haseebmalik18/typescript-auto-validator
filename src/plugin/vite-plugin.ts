import type { Plugin, ResolvedConfig, HmrContext } from "vite";
import { resolve, dirname, extname, basename } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { InterfaceExtractor, CodeGenerator } from "../transformer/index.js";

export interface ValidatorPluginOptions {
  include?: string[];
  exclude?: string[];
  outputDir?: string;
  generateTypeGuards?: boolean;
  watchMode?: boolean;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
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
  } = options;

  const extractor = new InterfaceExtractor();
  const generator = new CodeGenerator();
  const processedFiles = new Set<string>();
  const generatedValidators = new Map<string, string>();
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
    if (isAbsolutePath(filePath)) {
      return filePath;
    }
    
    if (filePath.startsWith("/")) {
      return resolve(configRoot, filePath.slice(1));
    }
    
    return resolve(configRoot, filePath);
  }

  function generateValidatorsForFile(filePath: string): string | null {
    try {
      const normalizedPath = normalizeFilePath(filePath);
      
      if (!existsSync(normalizedPath)) {
        throw new Error(`File not found: ${normalizedPath}`);
      }

      const interfaces = extractor.extractFromFile(normalizedPath);

      if (interfaces.length === 0) {
        return null;
      }

      const validatorCode = generator.generateValidatorBundle(interfaces);

      const moduleCode = `
// Auto-generated validators for ${filePath}
// DO NOT EDIT - This file is generated automatically

import { ValidationError } from 'typescript-runtime-validator';

${validatorCode}

// Export all validators
export {
${interfaces.map((iface) => `  validate${iface.name},`).join("\n")}
${generateTypeGuards ? interfaces.map((iface) => `  is${iface.name},`).join("\n") : ""}
};

// Export interface info for runtime use
export const interfaceInfo = {
${interfaces.map((iface) => `  ${iface.name}: ${JSON.stringify(iface, null, 2)},`).join("\n")}
};
`.trim();

      return moduleCode;
    } catch (error) {
      console.warn(`Failed to generate validators for ${filePath}:`, error);
      return null;
    }
  }

  function writeValidatorFile(
    sourceFile: string,
    validatorCode: string,
  ): string {
    const sourceBasename = basename(sourceFile, extname(sourceFile));
    const validatorFilename = `${sourceBasename}.validators.ts`;
    const validatorPath = resolve(resolvedOutputDir, validatorFilename);

    const outputDirPath = dirname(validatorPath);
    if (!existsSync(outputDirPath)) {
      mkdirSync(outputDirPath, { recursive: true });
    }

    writeFileSync(validatorPath, validatorCode, "utf-8");
    return validatorPath;
  }

  function generateIndexFile(): void {
    const indexPath = resolve(resolvedOutputDir, "index.ts");

    const exports = Array.from(generatedValidators.keys())
      .map((sourceFile) => {
        const sourceBasename = basename(sourceFile, extname(sourceFile));
        return `export * from './${sourceBasename}.validators.js';`;
      })
      .join("\n");

    const indexContent = `
// Auto-generated validator index
// DO NOT EDIT - This file is generated automatically

${exports}
`.trim();

    writeFileSync(indexPath, indexContent, "utf-8");
  }

  return {
    name: "typescript-validator",

    configResolved(config: ResolvedConfig) {
      configRoot = config.root;
      if (!isAbsolutePath(outputDir)) {
        resolvedOutputDir = resolve(config.root, outputDir);
      } else {
        resolvedOutputDir = outputDir;
      }
      console.log("🔍 TypeScript Validator: Scanning for interfaces...");
    },

    buildStart() {
      processedFiles.clear();
      generatedValidators.clear();
    },

    transform(code: string, id: string) {
      if (!id.endsWith(".ts") && !id.endsWith(".tsx")) {
        return null;
      }

      if (!shouldProcessFile(id)) {
        return null;
      }

      if (processedFiles.has(id)) {
        return null;
      }

      processedFiles.add(id);

      try {
        const interfaces = extractor.extractFromSource(code, id);

        if (interfaces.length === 0) {
          return null;
        }

        console.log(
          `✅ Found ${interfaces.length} interface(s) in ${basename(id)}: ${interfaces.map((i) => i.name).join(", ")}`,
        );

        const validatorCode = generator.generateValidatorBundle(interfaces);

        const moduleCode = `
// Auto-generated validators for ${id}
// DO NOT EDIT - This file is generated automatically

import { ValidationError } from 'typescript-runtime-validator';

${validatorCode}

// Export all validators
export {
${interfaces.map((iface) => `  validate${iface.name},`).join("\n")}
${generateTypeGuards ? interfaces.map((iface) => `  is${iface.name},`).join("\n") : ""}
};

// Export interface info for runtime use
export const interfaceInfo = {
${interfaces.map((iface) => `  ${iface.name}: ${JSON.stringify(iface, null, 2)},`).join("\n")}
};
`.trim();

        if (moduleCode) {
          generatedValidators.set(id, moduleCode);
          const validatorPath = writeValidatorFile(id, moduleCode);
          console.log(`📝 Generated validators: ${basename(validatorPath)}`);
        }

        return null;
      } catch (error) {
        console.warn(`⚠️  Failed to process ${basename(id)}:`, error);
        return null;
      }
    },

    generateBundle() {
      if (generatedValidators.size > 0) {
        generateIndexFile();
        console.log(
          `🎯 Generated ${generatedValidators.size} validator files in ${basename(resolvedOutputDir)}`,
        );
      }
    },

    handleHotUpdate(ctx: HmrContext) {
      if (!watchMode) return;

      const { file } = ctx;

      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
        return;
      }

      if (!shouldProcessFile(file)) {
        return;
      }

      console.log(`🔄 Regenerating validators for ${basename(file)}...`);

      const validatorCode = generateValidatorsForFile(file);
      if (validatorCode) {
        generatedValidators.set(file, validatorCode);
        writeValidatorFile(file, validatorCode);
        generateIndexFile();
      }
    },
  };
}
