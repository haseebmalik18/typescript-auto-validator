module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended", 
    "plugin:@typescript-eslint/recommended"
  ],
  ignorePatterns: ["webpack.js"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { 
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^(_|InterfaceInfo|PropertyInfo|TransformationError|validateObjectWithPropertyInfo|validatePartialObject|validateDiscriminatedUnion|validateBrandedType)"
    }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "no-case-declarations": "off", // Allow lexical declarations in case blocks
    "no-useless-escape": "off", // Allow escape characters in regex patterns
  },
  env: {
    node: true,
    jest: true,
  },
};
