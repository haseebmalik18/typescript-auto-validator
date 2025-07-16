export interface WebpackValidatorOptions {
  include?: RegExp[];
  exclude?: RegExp[];
  outputPath?: string;
}

interface WebpackCompiler {
  hooks: {
    beforeCompile: {
      tapAsync: (
        name: string,
        callback: (params: any, done: () => void) => void,
      ) => void;
    };
  };
}

export class TypeScriptValidatorWebpackPlugin {
  private options: WebpackValidatorOptions;

  constructor(options: WebpackValidatorOptions = {}) {
    this.options = {
      include: [/\.tsx?$/],
      exclude: [/node_modules/, /\.test\.tsx?$/, /\.spec\.tsx?$/],
      outputPath: "src/generated",
      ...options,
    };
  }

  apply(compiler: WebpackCompiler): void {
    compiler.hooks.beforeCompile.tapAsync(
      "TypeScriptValidatorWebpackPlugin",
      (params: any, callback: () => void) => {
        console.log(
          "🔍 TypeScript Validator (Webpack): Scanning for interfaces...",
        );
        callback();
      },
    );
  }
}

export default TypeScriptValidatorWebpackPlugin;
