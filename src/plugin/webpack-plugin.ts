import { resolve, basename, isAbsolute, relative } from 'path';
import { minimatch } from 'minimatch';
import { InterfaceExtractor } from '../transformer/interface-extractor.js';
import { ValidatorGenerator } from '../generator/validator-generator.js';
import { fileSystem, FileSystemOperations } from '../utils/filesystem.js';
import { InterfaceInfo } from '../types.js';

/**
 * Simple webpack error class
 */
class WebpackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebpackValidationError';
  }
}

/**
 * Simple RawSource implementation
 */
class RawSource {
  constructor(public source: string) {}

  size(): number {
    return this.source.length;
  }

  map(): null {
    return null;
  }
}

/**
 * Webpack compiler interface (minimal required properties)
 */
interface WebpackCompiler {
  options?: {
    context?: string;
    mode?: string;
  };
  hooks?: {
    initialize?: {
      tap: (pluginName: string, callback: () => void) => void;
    };
    watchRun?: {
      tap: (pluginName: string, callback: () => void) => void;
    };
    compilation?: {
      tap: (pluginName: string, callback: (compilation: WebpackCompilation) => void) => void;
    };
    invalid?: {
      tap: (pluginName: string, callback: (filename: string, changeTime: number) => void) => void;
    };
    done?: {
      tap: (pluginName: string, callback: (stats: WebpackStats) => void) => void;
    };
  };
}

/**
 * Webpack compilation interface (minimal required properties)
 */
interface WebpackCompilation {
  hooks?: {
    buildModule?: {
      tap: (pluginName: string, callback: (module: WebpackModule) => void) => void;
    };
    afterOptimizeModules?: {
      tap: (pluginName: string, callback: () => void) => void;
    };
    additionalAssets?: {
      tapAsync: (pluginName: string, callback: (callback: () => void) => void) => void;
    };
  };
  errors?: unknown[];
  warnings?: unknown[];
  emitAsset?: (filename: string, source: RawSource, assetInfo?: Record<string, unknown>) => void;
  options?: {
    mode?: string;
  };
}

/**
 * Webpack module interface (minimal required properties)
 */
interface WebpackModule {
  resource?: string;
}

/**
 * Webpack stats interface (minimal required properties)
 */
interface WebpackStats {
  hasErrors?: () => boolean;
  compilation?: {
    errors?: unknown[];
  };
}

/**
 * Configuration options for the ts-auto-validator Webpack plugin
 */
export interface WebpackValidatorPluginOptions {
  /**
   * File patterns to include for processing
   * @default ["**\/*.ts", "**\/*.tsx"]
   */
  include?: string[];

  /**
   * File patterns to exclude from processing
   * @default ["node_modules/**", "**\/*.test.ts", "**\/*.spec.ts", "**\/*.d.ts"]
   */
  exclude?: string[];

  /**
   * Output directory for generated validators
   * @default "src/generated"
   */
  outputDir?: string;

  /**
   * Whether to generate type guard functions
   * @default true
   */
  generateTypeGuards?: boolean;

  /**
   * Enable watch mode for development
   * @default true
   */
  watchMode?: boolean;

  /**
   * Enable logging output
   * @default true
   */
  enableLogging?: boolean;

  /**
   * Generate auto validators that auto-register
   * @default true
   */
  generateAutoValidators?: boolean;

  /**
   * File system operations (for testing/mocking)
   */
  fileSystem?: FileSystemOperations;

  /**
   * Emit validators as separate files instead of inline
   * @default true
   */
  emitFiles?: boolean;

  /**
   * Cache processed interfaces for performance
   * @default true
   */
  enableCaching?: boolean;

  /**
   * Custom transformer options
   */
  transformerOptions?: {
    /**
     * Include source maps in generated validators
     * @default true
     */
    sourceMap?: boolean;

    /**
     * Minify generated validator code
     * @default false
     */
    minify?: boolean;

    /**
     * Target ECMAScript version for generated code
     * @default "ES2020"
     */
    target?: 'ES5' | 'ES2015' | 'ES2017' | 'ES2018' | 'ES2019' | 'ES2020' | 'ES2021' | 'ES2022';
  };
}

/**
 * Internal interface for tracking file processing
 */
interface ProcessedFile {
  filePath: string;
  interfaces: InterfaceInfo[];
  lastModified: number;
  hash: string;
}

/**
 * ts-auto-validator Webpack Plugin
 */
export class TypeScriptRuntimeValidatorPlugin {
  private readonly options: Required<Omit<WebpackValidatorPluginOptions, 'fileSystem'>> & {
    fileSystem: FileSystemOperations;
  };
  private readonly extractor: InterfaceExtractor;
  private readonly generator: ValidatorGenerator;
  private readonly processedFiles = new Map<string, ProcessedFile>();
  private readonly allInterfaces = new Map<string, InterfaceInfo>();
  private readonly fileCache = new Map<string, string>();

  private configRoot: string = process.cwd();
  private resolvedOutputDir: string;
  private compilation?: WebpackCompilation;
  private isWatching = false;

  constructor(options: WebpackValidatorPluginOptions = {}) {
    this.options = {
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts', '**/*.d.ts'],
      outputDir: 'src/generated',
      generateTypeGuards: true,
      watchMode: true,
      enableLogging: true,
      generateAutoValidators: true,
      emitFiles: true,
      enableCaching: true,
      fileSystem: fileSystem,
      transformerOptions: {
        sourceMap: true,
        minify: false,
        target: 'ES2020',
        ...options.transformerOptions,
      },
      ...options,
    };

    this.extractor = new InterfaceExtractor();
    this.generator = new ValidatorGenerator();
    this.resolvedOutputDir = this.options.outputDir;

    if (this.options.enableLogging) {
      this.log('info', 'ts-auto-validator Plugin initialized', this.options);
    }
  }

  /**
   * Required method for Webpack plugin interface
   */
  apply(compiler: WebpackCompiler): void {
    const pluginName = 'TypeScriptRuntimeValidatorPlugin';

    // Set up configuration
    this.configRoot = compiler.options?.context || process.cwd();
    this.resolvedOutputDir = isAbsolute(this.options.outputDir)
      ? this.options.outputDir
      : resolve(this.configRoot, this.options.outputDir);

    // Initialize plugin
    if (compiler.hooks?.initialize) {
      compiler.hooks.initialize.tap(pluginName, () => {
        this.log('info', 'ts-auto-validator starting...');
        this.clearCaches();
      });
    }

    // Check if we're in watch mode
    if (compiler.hooks?.watchRun) {
      compiler.hooks.watchRun.tap(pluginName, () => {
        this.isWatching = true;
      });
    }

    // Process files during compilation
    if (compiler.hooks?.compilation) {
      compiler.hooks.compilation.tap(pluginName, (compilation: WebpackCompilation) => {
        this.compilation = compilation;

        // Hook into the build process to analyze TypeScript files
        if (compilation.hooks?.buildModule) {
          compilation.hooks.buildModule.tap(pluginName, (module: WebpackModule) => {
            this.processModule(module, compilation);
          });
        }

        // Generate validators after all modules are processed
        if (compilation.hooks?.afterOptimizeModules) {
          compilation.hooks.afterOptimizeModules.tap(pluginName, () => {
            this.generateAllValidators(compilation);
          });
        }

        // Add generated files to compilation
        if (compilation.hooks?.additionalAssets) {
          compilation.hooks.additionalAssets.tapAsync(pluginName, (callback: () => void) => {
            this.emitGeneratedAssets(compilation)
              .then(() => callback())
              .catch(error => {
                if (compilation.errors) {
                  compilation.errors.push(
                    new WebpackValidationError(`ts-auto-validator: ${error.message}`)
                  );
                }
                callback();
              });
          });
        }
      });
    }

    // Handle file changes in watch mode
    if (compiler.hooks?.invalid) {
      compiler.hooks.invalid.tap(pluginName, (filename: string, changeTime: number) => {
        if (this.isWatching && filename && this.shouldProcessFile(filename)) {
          this.handleFileChange(filename, changeTime);
        }
      });
    }

    // Final cleanup
    if (compiler.hooks?.done) {
      compiler.hooks.done.tap(pluginName, (stats: WebpackStats) => {
        if (!stats.hasErrors?.() || !stats.compilation?.errors?.length) {
          this.log(
            'info',
            `ts-auto-validator generation complete! Processed ${this.allInterfaces.size} interfaces`
          );
        }
      });
    }
  }

  /**
   * Process a Webpack module if it's a TypeScript file
   */
  private processModule(module: WebpackModule, compilation: WebpackCompilation): void {
    if (!this.isTypeScriptModule(module)) {
      return;
    }

    const filePath = this.getModuleFilePath(module);
    if (!filePath || !this.shouldProcessFile(filePath)) {
      return;
    }

    try {
      this.processTypeScriptFile(filePath, compilation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Failed to process ${filePath}: ${message}`);

      if (compilation.warnings) {
        compilation.warnings.push(
          new WebpackValidationError(`ts-auto-validator: Failed to process ${filePath}: ${message}`)
        );
      }
    }
  }

  /**
   * Process a TypeScript file and extract interfaces
   */
  private processTypeScriptFile(filePath: string, _compilation: WebpackCompilation): void {
    const normalizedPath = this.normalizeFilePath(filePath);

    // Check cache if enabled
    if (this.options.enableCaching) {
      const cached = this.getCachedFile(normalizedPath);
      if (cached) {
        cached.interfaces.forEach(iface => {
          this.allInterfaces.set(iface.name, iface);
        });
        return;
      }
    }

    try {
      const interfaces = this.extractor.extractFromFile(normalizedPath);

      if (interfaces.length > 0) {
        // Cache the results
        const processedFile: ProcessedFile = {
          filePath: normalizedPath,
          interfaces,
          lastModified: Date.now(),
          hash: this.getFileHash(normalizedPath),
        };

        this.processedFiles.set(normalizedPath, processedFile);

        // Add interfaces to global registry
        interfaces.forEach(iface => {
          this.allInterfaces.set(iface.name, iface);
        });

        this.log(
          'info',
          `Found ${interfaces.length} interface(s) in ${basename(filePath)}: ${interfaces.map(i => i.name).join(', ')}`
        );
      }
    } catch (error) {
      throw new Error(
        `Interface extraction failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate all validators after processing
   */
  private generateAllValidators(compilation: WebpackCompilation): void {
    if (this.allInterfaces.size === 0) {
      this.log('info', 'No interfaces found, skipping validator generation');
      return;
    }

    try {
      this.generateAutoValidatorModule();

      if (this.options.generateTypeGuards) {
        this.generateTypeGuards();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (compilation.errors) {
        compilation.errors.push(
          new WebpackValidationError(`Validator generation failed: ${message}`)
        );
      }
    }
  }

  /**
   * Generate the auto validator module
   */
  private generateAutoValidatorModule(): void {
    if (!this.options.generateAutoValidators) {
      return;
    }

    const allInterfaceList = Array.from(this.allInterfaces.values());
    if (allInterfaceList.length === 0) {
      return;
    }

    try {
      this.ensureOutputDirectory();

      const moduleCode = this.generator.generateValidatorModule(allInterfaceList);
      const outputPath = resolve(this.resolvedOutputDir, 'auto-validators.ts');

      this.writeGeneratedFile(outputPath, moduleCode);

      this.log('info', `Generated auto validators for ${allInterfaceList.length} interfaces`);
    } catch (error) {
      throw new Error(
        `Auto validator generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate individual type guards
   */
  private generateTypeGuards(): void {
    this.allInterfaces.forEach(interfaceInfo => {
      try {
        const typeGuardCode = this.generator.generateTypeGuard(interfaceInfo);
        const outputPath = resolve(this.resolvedOutputDir, `${interfaceInfo.name}.guard.ts`);

        this.writeGeneratedFile(outputPath, typeGuardCode);
      } catch (error) {
        this.log(
          'error',
          `Failed to generate type guard for ${interfaceInfo.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * Emit generated assets to Webpack compilation
   */
  private async emitGeneratedAssets(compilation: WebpackCompilation): Promise<void> {
    if (!this.options.emitFiles) {
      return;
    }

    try {
      const generatedFiles = this.getGeneratedFiles();

      for (const [relativePath, content] of generatedFiles) {
        if (compilation.emitAsset) {
          compilation.emitAsset(relativePath, new RawSource(content), {
            development: !compilation.options?.mode || compilation.options.mode === 'development',
          });
        }
      }
    } catch (error) {
      throw new Error(
        `Asset emission failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle file changes in watch mode
   */
  private handleFileChange(filename: string, _changeTime: number): void {
    this.log('info', `File changed: ${filename}`);

    const normalizedPath = this.normalizeFilePath(filename);

    // Remove from caches
    this.processedFiles.delete(normalizedPath);
    this.fileCache.delete(normalizedPath);

    // Reprocess the file
    try {
      if (this.compilation) {
        this.processTypeScriptFile(normalizedPath, this.compilation);
        this.generateAutoValidatorModule();

        this.log('info', 'Validators regenerated');
      }
    } catch (error) {
      this.log(
        'error',
        `Hot reload failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Utility methods
   */

  private shouldProcessFile(filePath: string): boolean {
    const relativePath = relative(this.configRoot, filePath);

    // Check includes
    const included = this.options.include.some(pattern => minimatch(relativePath, pattern));
    if (!included) {
      return false;
    }

    // Check excludes
    const excluded = this.options.exclude.some(pattern => minimatch(relativePath, pattern));
    return !excluded;
  }

  private normalizeFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    if (filePath.startsWith('/')) {
      return resolve(this.configRoot, filePath.slice(1));
    }

    return resolve(this.configRoot, filePath);
  }

  private isTypeScriptModule(module: WebpackModule): boolean {
    const resource = module?.resource;
    return resource ? resource.endsWith('.ts') || resource.endsWith('.tsx') : false;
  }

  private getModuleFilePath(module: WebpackModule): string | null {
    return module?.resource || null;
  }

  private getCachedFile(filePath: string): ProcessedFile | null {
    if (!this.options.enableCaching) {
      return null;
    }

    const cached = this.processedFiles.get(filePath);
    if (!cached) {
      return null;
    }

    // Check if file has been modified
    const currentHash = this.getFileHash(filePath);
    if (cached.hash !== currentHash) {
      this.processedFiles.delete(filePath);
      return null;
    }

    return cached;
  }

  private getFileHash(filePath: string): string {
    try {
      const content = this.options.fileSystem.readFile(filePath);
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch {
      return Date.now().toString(36);
    }
  }

  private ensureOutputDirectory(): void {
    this.options.fileSystem.ensureDir(this.resolvedOutputDir);
  }

  private writeGeneratedFile(filePath: string, content: string): void {
    try {
      this.options.fileSystem.writeFile(filePath, content);
    } catch (error) {
      throw new Error(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getGeneratedFiles(): Map<string, string> {
    const files = new Map<string, string>();

    if (!this.options.fileSystem.exists(this.resolvedOutputDir)) {
      return files;
    }

    try {
      // Add auto validators
      const autoValidatorsPath = resolve(this.resolvedOutputDir, 'auto-validators.ts');
      if (this.options.fileSystem.exists(autoValidatorsPath)) {
        const content = this.options.fileSystem.readFile(autoValidatorsPath);
        const relativePath = relative(this.configRoot, autoValidatorsPath);
        files.set(relativePath, content);
      }

      // Add type guards if enabled
      if (this.options.generateTypeGuards) {
        this.allInterfaces.forEach(interfaceInfo => {
          const guardPath = resolve(this.resolvedOutputDir, `${interfaceInfo.name}.guard.ts`);
          if (this.options.fileSystem.exists(guardPath)) {
            const content = this.options.fileSystem.readFile(guardPath);
            const relativePath = relative(this.configRoot, guardPath);
            files.set(relativePath, content);
          }
        });
      }
    } catch (error) {
      this.log(
        'error',
        `Failed to read generated files: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return files;
  }

  private clearCaches(): void {
    this.processedFiles.clear();
    this.allInterfaces.clear();
    this.fileCache.clear();
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    if (!this.options.enableLogging) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ts-auto-validator] [${level.toUpperCase()}]`;

    switch (level) {
      case 'info':
        console.info(`${prefix} ${message}`, data ? data : '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data ? data : '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data ? data : '');
        break;
    }
  }
}

/**
 * Factory function for creating the plugin (for CommonJS compatibility)
 */
export function createTypeScriptRuntimeValidatorPlugin(
  options?: WebpackValidatorPluginOptions
): TypeScriptRuntimeValidatorPlugin {
  return new TypeScriptRuntimeValidatorPlugin(options);
}

/**
 * Default export for convenience
 */
export default TypeScriptRuntimeValidatorPlugin;
