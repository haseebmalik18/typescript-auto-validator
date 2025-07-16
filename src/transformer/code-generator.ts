import { InterfaceInfo, PropertyInfo, TypeInfo } from "../types";
import { TypeAnalyzer } from "./type-analyzer";

export class CodeGenerator {
  private typeAnalyzer = new TypeAnalyzer();

  generateValidator(interfaceInfo: InterfaceInfo): string {
    const { name, properties } = interfaceInfo;

    const validatorName = `validate${name}`;
    const validationChecks = properties
      .map((prop) => this.generatePropertyValidation(prop))
      .join("\n");

    return `
export function ${validatorName}(value: unknown): ${name} {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError('Expected object, got ' + typeof value);
  }
  
  const obj = value as Record<string, unknown>;
${validationChecks}
  
  return obj as ${name};
}`.trim();
  }

  generateValidatorBundle(interfaces: InterfaceInfo[]): string {
    const validatorFunctions = interfaces.map((iface) =>
      this.generateValidator(iface),
    );

    const typeGuards = interfaces.map((iface) =>
      this.generateTypeGuard(iface),
    );

    return [...validatorFunctions, ...typeGuards].join("\n\n");
  }

  generateTypeGuard(interfaceInfo: InterfaceInfo): string {
    const { name } = interfaceInfo;
    const validatorName = `validate${name}`;
    const guardName = `is${name}`;

    return `
export function ${guardName}(value: unknown): value is ${name} {
  try {
    ${validatorName}(value);
    return true;
  } catch {
    return false;
  }
}`.trim();
  }

  private generatePropertyValidation(property: PropertyInfo): string {
    const { name, type, optional } = property;

    if (optional) {
      return `
  if ('${name}' in obj && obj.${name} !== void 0) {
${this.generateTypeCheck(`obj.${name}`, type, name, "    ")}
  }`;
    }

    return `
  if (!('${name}' in obj) || obj.${name} === void 0) {
    throw new ValidationError('Missing required property: ${name}');
  }
${this.generateTypeCheck(`obj.${name}`, type, name, "  ")}`;
  }

  private generateTypeCheck(
    valueExpr: string,
    type: TypeInfo,
    propertyPath: string,
    indent: string = "  ",
  ): string {
    switch (type.kind) {
      case "string":
        return `${indent}if (typeof ${valueExpr} !== 'string') {
${indent}  throw new ValidationError('Expected ${propertyPath} to be string, got ' + typeof ${valueExpr});
${indent}}`;

      case "number":
        return `${indent}if (typeof ${valueExpr} !== 'number') {
${indent}  throw new ValidationError('Expected ${propertyPath} to be number, got ' + typeof ${valueExpr});
${indent}}`;

      case "boolean":
        return `${indent}if (typeof ${valueExpr} !== 'boolean') {
${indent}  throw new ValidationError('Expected ${propertyPath} to be boolean, got ' + typeof ${valueExpr});
${indent}}`;

      case "date":
        return `${indent}if (!(${valueExpr} instanceof Date)) {
${indent}  throw new ValidationError('Expected ${propertyPath} to be Date, got ' + typeof ${valueExpr});
${indent}}`;

      case "array":
        const elementValidation = type.elementType
          ? `${indent}  ${valueExpr}.forEach((item, index) => {
${this.generateTypeCheck("item", type.elementType!, `${propertyPath}[index]`, `${indent}    `)}
${indent}  });`
          : "";

        return `${indent}if (!Array.isArray(${valueExpr})) {
${indent}  throw new ValidationError('Expected ${propertyPath} to be array, got ' + typeof ${valueExpr});
${indent}}
${elementValidation}`;

      case "object":
        if (!type.properties) {
          return `${indent}if (typeof ${valueExpr} !== 'object' || ${valueExpr} === null) {
${indent}  throw new ValidationError('Expected ${propertyPath} to be object, got ' + typeof ${valueExpr});
${indent}}`;
        }

        const objectValidations = type.properties
          .map((prop) => {
            const propCheck = this.generateTypeCheck(
              `${valueExpr}.${prop.name}`,
              prop.type,
              `${propertyPath}.${prop.name}`,
              `${indent}  `,
            );
            
            if (prop.optional) {
              return `${indent}  if (${valueExpr}.${prop.name} !== void 0) {
${propCheck}
${indent}  }`;
            } else {
              return `${indent}  if (${valueExpr}.${prop.name} === void 0) {
${indent}    throw new ValidationError('Missing required property: ${propertyPath}.${prop.name}');
${indent}  }
${propCheck}`;
            }
          })
          .join("\n");

        return `${indent}if (typeof ${valueExpr} !== 'object' || ${valueExpr} === null) {
${indent}  throw new ValidationError('Expected ${propertyPath} to be object, got ' + typeof ${valueExpr});
${indent}}
${objectValidations}`;

      case "union":
        if (!type.types || type.types.length === 0) {
          return `${indent}throw new ValidationError('Union type has no valid options for ${propertyPath}');`;
        }

        const unionChecks = type.types
          .map((unionType, index) => {
            return `${indent}  try {
${this.generateTypeCheck(valueExpr, unionType, propertyPath, `${indent}    `)}
${indent}    validUnion = true;
${indent}  } catch {
${indent}  }`;
          })
          .join("\n");

        return `${indent}let validUnion = false;
${unionChecks}
${indent}if (!validUnion) {
${indent}  throw new ValidationError('Value does not match any union type for ${propertyPath}');
${indent}}`;

      case "literal":
        const literalValue = typeof type.value === "string" 
          ? `'${type.value}'` 
          : String(type.value);
        
        return `${indent}if (${valueExpr} !== ${literalValue}) {
${indent}  throw new ValidationError('Expected ${propertyPath} to be ${literalValue}, got ' + JSON.stringify(${valueExpr}));
${indent}}`;

      case "reference":
        const referenceName = type.name || "Unknown";
        return `${indent}validate${referenceName}(${valueExpr});`;

      default:
        return `${indent}`;
    }
  }

  generateImports(): string {
    return `import { ValidationError } from 'typescript-runtime-validator';`;
  }
}
