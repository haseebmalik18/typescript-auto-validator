/**
 * ts-auto-validator - Webpack Plugin Entry Point
 * 
 * CommonJS entry point for webpack users who need require() syntax.
 * 
 * @example
 * ```javascript
 * // webpack.config.js
 * const { TypeScriptRuntimeValidatorPlugin } = require('ts-auto-validator/webpack');
 * 
 * module.exports = {
 *   plugins: [
 *     new TypeScriptRuntimeValidatorPlugin({
 *       outputDir: 'src/generated',
 *       enableLogging: true,
 *       generateAutoValidators: true
 *     })
 *   ]
 * };
 * ```
 */

// ESM-to-CJS bridge for backward compatibility
const plugin = require('./dist/plugin/webpack-plugin.js');

module.exports = {
  TypeScriptRuntimeValidatorPlugin: plugin.TypeScriptRuntimeValidatorPlugin,
  createTypeScriptRuntimeValidatorPlugin: plugin.createTypeScriptRuntimeValidatorPlugin,
  default: plugin.default
}; 