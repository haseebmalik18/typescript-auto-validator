import { InterfaceInfo, PropertyInfo, TypeInfo } from "../types.js";

export class ValidatorGenerator {
  generateValidatorModule(interfaces: InterfaceInfo[]): string {
    const imports = this.generateImports();
    const validators = interfaces.map(iface => this.generateValidatorFunction(iface)).join('\n\n');
    const registrations = this.generateRegistrations(interfaces);
    
    return `${imports}\n\n${validators}\n\n${registrations}`;
  }

  generateValidatorFunction(interfaceInfo: InterfaceInfo): string {
    const { name, properties } = interfaceInfo;
    const functionName = `validate${name}`;
    
    const validationCode = this.generateValidationLogic(properties, 'data', 'data');
    
    return `
/**
 * Generated validator for ${name} interface
 */
function ${functionName}(data: unknown, config?: ValidatorConfig): ${name} {
  ${validationCode}
  
  return data as ${name};
}`.trim();
  }

  /**
   * Generate validation logic for a set of properties
   */
  private generateValidationLogic(
    properties: PropertyInfo[], 
    dataPath: string, 
    errorPath: string
  ): string {
    // First, ensure we have an object
    const objectCheck = `
  if (typeof ${dataPath} !== 'object' || ${dataPath} === null || Array.isArray(${dataPath})) {
    throw ValidationError.create('${errorPath}', 'object', typeof ${dataPath}, ${dataPath});
  }
  
  const obj = ${dataPath} as Record<string, unknown>;`;

    // Generate validation for each property
    const propertyValidations = properties.map(prop => 
      this.generatePropertyValidation(prop, 'obj', errorPath)
    ).join('\n');

    // Check for unknown properties (optional - could be configurable)
    const unknownPropertyCheck = this.generateUnknownPropertyCheck(properties, 'obj', errorPath);

    return `${objectCheck}\n${propertyValidations}\n${unknownPropertyCheck}`;
  }

  /**
   * Generate validation code for a single property
   */
  private generatePropertyValidation(
    property: PropertyInfo, 
    objName: string, 
    basePath: string
  ): string {
    const { name, type, optional } = property;
    const propPath = `${basePath}.${name}`;
    const propValue = `${objName}.${name}`;
    
    if (optional) {
      return `
  // Validate optional property: ${name}
  if (${propValue} !== undefined) {
${this.generateTypeValidation(type, propValue, propPath, '    ')}
  }`;
    } else {
      return `
  // Validate required property: ${name}
  if (${propValue} === undefined) {
    throw ValidationError.missing('${propPath}');
  }
${this.generateTypeValidation(type, propValue, propPath, '  ')}`;
    }
  }

  /**
   * Generate type validation code for a specific TypeScript type
   */
  private generateTypeValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string = '  '
  ): string {
    switch (type.kind) {
      case 'string':
        return this.generateStringValidation(type, valueName, errorPath, indent);
      
      case 'number':
        return this.generateNumberValidation(type, valueName, errorPath, indent);
      
      case 'boolean':
        return `${indent}if (typeof ${valueName} !== 'boolean') {
${indent}  throw ValidationError.create('${errorPath}', 'boolean', typeof ${valueName}, ${valueName});
${indent}}`;
      
      case 'date':
        return `${indent}if (!(${valueName} instanceof Date) || isNaN(${valueName}.getTime())) {
${indent}  throw ValidationError.create('${errorPath}', 'Date', typeof ${valueName}, ${valueName});
${indent}}`;
      
      case 'array':
        return this.generateArrayValidation(type, valueName, errorPath, indent);
      
      case 'object':
        return this.generateObjectValidation(type, valueName, errorPath, indent);
      
      case 'union':
        return this.generateUnionValidation(type, valueName, errorPath, indent);
      
      case 'literal':
        return this.generateLiteralValidation(type, valueName, errorPath, indent);
      
      case 'null':
        return `${indent}if (${valueName} !== null) {
${indent}  throw ValidationError.create('${errorPath}', 'null', typeof ${valueName}, ${valueName});
${indent}}`;
      
      case 'undefined':
        return `${indent}if (${valueName} !== undefined) {
${indent}  throw ValidationError.create('${errorPath}', 'undefined', typeof ${valueName}, ${valueName});
${indent}}`;
      
      case 'reference':
        if (!type.name) {
          throw new Error(`Reference type missing name at ${errorPath}`);
        }
        return `${indent}// Reference type '${type.name}' - handled by registry`;
      
      default:
        throw new Error(`Unsupported type kind '${type.kind}' at ${errorPath}. Please add support for this type.`);
    }
  }

  /**
   * Generate string validation with constraint checking
   */
  private generateStringValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    let validation = `${indent}if (typeof ${valueName} !== 'string') {
${indent}  throw ValidationError.create('${errorPath}', 'string', typeof ${valueName}, ${valueName});
${indent}}`;

    // Add constraint validations if present
    if (type.constraints) {
      const { minLength, maxLength, pattern } = type.constraints;
      
      if (minLength !== undefined) {
        validation += `\n${indent}if (${valueName}.length < ${minLength}) {
${indent}  throw ValidationError.create('${errorPath}', 'string with minimum length ${minLength}', \`string with length \${${valueName}.length}\`, ${valueName});
${indent}}`;
      }
      
      if (maxLength !== undefined) {
        validation += `\n${indent}if (${valueName}.length > ${maxLength}) {
${indent}  throw ValidationError.create('${errorPath}', 'string with maximum length ${maxLength}', \`string with length \${${valueName}.length}\`, ${valueName});
${indent}}`;
      }
      
      if (pattern) {
        validation += `\n${indent}if (!/${pattern}/.test(${valueName})) {
${indent}  throw ValidationError.create('${errorPath}', 'string matching pattern ${pattern}', ${valueName}, ${valueName});
${indent}}`;
      }
    }

    return validation;
  }

  /**
   * Generate number validation with constraint checking
   */
  private generateNumberValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    let validation = `${indent}if (typeof ${valueName} !== 'number' || isNaN(${valueName})) {
${indent}  throw ValidationError.create('${errorPath}', 'number', typeof ${valueName}, ${valueName});
${indent}}`;

    // Add constraint validations if present
    if (type.constraints) {
      const { min, max } = type.constraints;
      
      if (min !== undefined) {
        validation += `\n${indent}if (${valueName} < ${min}) {
${indent}  throw ValidationError.create('${errorPath}', 'number >= ${min}', \`number \${${valueName}}\`, ${valueName});
${indent}}`;
      }
      
      if (max !== undefined) {
        validation += `\n${indent}if (${valueName} > ${max}) {
${indent}  throw ValidationError.create('${errorPath}', 'number <= ${max}', \`number \${${valueName}}\`, ${valueName});
${indent}}`;
      }
    }

    return validation;
  }

  /**
   * Generate array validation code
   */
  private generateArrayValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    let validation = `${indent}if (!Array.isArray(${valueName})) {
${indent}  throw ValidationError.create('${errorPath}', 'array', typeof ${valueName}, ${valueName});
${indent}}`;

    // Validate array elements if element type is specified
    if (type.elementType) {
      validation += `\n${indent}for (let i = 0; i < ${valueName}.length; i++) {
${indent}  const element = ${valueName}[i];
${indent}  const elementPath = \`${errorPath}[\${i}]\`;
${this.generateTypeValidation(type.elementType, 'element', '${elementPath}', indent + '  ')}
${indent}}`;
    }

    return validation;
  }

  /**
   * Generate object validation code
   */
  private generateObjectValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    if (!type.properties || type.properties.length === 0) {
      // Simple object validation
      return `${indent}if (typeof ${valueName} !== 'object' || ${valueName} === null || Array.isArray(${valueName})) {
${indent}  throw ValidationError.create('${errorPath}', 'object', typeof ${valueName}, ${valueName});
${indent}}`;
    }

    // Complex object with properties
    let validation = `${indent}if (typeof ${valueName} !== 'object' || ${valueName} === null || Array.isArray(${valueName})) {
${indent}  throw ValidationError.create('${errorPath}', 'object', typeof ${valueName}, ${valueName});
${indent}}`;

    // Validate each property
    const nestedValidation = this.generateValidationLogic(type.properties, valueName, errorPath);
    validation += `\n${nestedValidation.split('\n').map(line => indent + line).join('\n')}`;

    return validation;
  }

  /**
   * Generate union type validation code
   */
  private generateUnionValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    if (!type.types || type.types.length === 0) {
      return `${indent}// Empty union type - this should not happen`;
    }

    if (type.types.every(t => t.kind === 'literal')) {
      const literalValues = type.types.map(t => {
        if (typeof t.value === 'string') {
          return `'${t.value}'`;
        }
        return String(t.value);
      });
      
      return `
        if (![${literalValues.join(', ')}].includes(${valueName})) {
          throw ValidationError.create('${errorPath}', 'one of [${literalValues.join(', ')}]', typeof ${valueName}, ${valueName});
        }`;
    }
    
    const validationCases = type.types.map((unionType, index) => {
      const caseValidation = this.generateTypeValidation(unionType, valueName, errorPath, indent + '    ');
      return `
        try {
          ${caseValidation}
          return; // Success - exit union validation
        } catch (error${index}) {
          // Continue to next union case
        }`;
    }).join('\n');
    
    return `
      ${validationCases}
      throw ValidationError.create('${errorPath}', 'union type', typeof ${valueName}, ${valueName});`;
  }

  /**
   * Generate literal type validation code
   */
  private generateLiteralValidation(
    type: TypeInfo, 
    valueName: string, 
    errorPath: string, 
    indent: string
  ): string {
    const literalValue = typeof type.value === 'string' ? `'${type.value}'` : String(type.value);
    const comparison = typeof type.value === 'string' 
      ? `${valueName} !== '${type.value}'`
      : `${valueName} !== ${type.value}`;

    return `${indent}if (${comparison}) {
${indent}  throw ValidationError.create('${errorPath}', ${literalValue}, String(${valueName}), ${valueName});
${indent}}`;
  }

  /**
   * Generate code to check for unknown properties
   */
  private generateUnknownPropertyCheck(
    properties: PropertyInfo[], 
    objName: string, 
    errorPath: string
  ): string {
    const knownProps = properties.map(p => `'${p.name}'`).join(', ');
    
    return `
  // Check for unknown properties
  const knownProps = new Set([${knownProps}]);
  const unknownProps = Object.keys(${objName}).filter(key => !knownProps.has(key));
  if (unknownProps.length > 0) {
    throw ValidationError.create('${errorPath}', 'object with known properties', \`object with unknown properties: \${unknownProps.join(', ')}\`, ${objName});
  }`;
  }

  /**
   * Generate import statements for the validator module
   */
  private generateImports(): string {
    return `
// Auto-generated validator module
// This file is automatically generated by TypeScript Runtime Validator
import { ValidationError } from '../validator/error-handler.js';
import { ValidatorConfig } from '../types.js';
import { registerValidator } from '../validator/magic-validator.js';`.trim();
  }

  /**
   * Generate validator registration code
   */
  private generateRegistrations(interfaces: InterfaceInfo[]): string {
    const registrations = interfaces.map(iface => 
      `registerValidator('${iface.name}', validate${iface.name});`
    ).join('\n');

    return `
// Register all generated validators
${registrations}`;
  }
} 