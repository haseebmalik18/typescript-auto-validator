import { TypeInfo, PropertyInfo, InterfaceInfo } from "../types.js";
import {
  validateString,
  validateNumber,
  validateBoolean,
  validateDate,
  validateLiteral,
} from "./primitive-validator.js";
import { validateObject, validateProperty, validateObjectWithProperties } from "./object-validator.js";
import { validateArrayElements } from "./array-validator.js";
import { validateUnion, validateLiteralUnion } from "./union-validator.js";
import { ValidationError } from "./error-handler.js";

export type ValidatorFunction<T = unknown> = (
  value: unknown,
  path?: string,
) => T;

export class ValidatorFactory {
  private validatorCache = new Map<string, ValidatorFunction>();
  private interfaceRegistry = new Map<string, InterfaceInfo>();

  registerInterface(interfaceInfo: InterfaceInfo): void {
    this.interfaceRegistry.set(interfaceInfo.name, interfaceInfo);
  }

  registerInterfaces(interfaces: InterfaceInfo[]): void {
    for (const interfaceInfo of interfaces) {
      this.registerInterface(interfaceInfo);
    }
  }

  getInterface(name: string): InterfaceInfo | undefined {
    return this.interfaceRegistry.get(name);
  }

  private isTypeAlias(interfaceInfo: InterfaceInfo): boolean {
    return (
      interfaceInfo.properties.length === 1 &&
      interfaceInfo.properties[0].name === "value"
    );
  }

  createValidator<T>(interfaceInfo: InterfaceInfo): ValidatorFunction<T> {
    this.registerInterface(interfaceInfo);
    
    const cacheKey = interfaceInfo.name;

    if (this.validatorCache.has(cacheKey)) {
      return this.validatorCache.get(cacheKey) as ValidatorFunction<T>;
    }

    const validator = this.createValidatorForInterface<T>(interfaceInfo);
    this.validatorCache.set(cacheKey, validator);

    return validator;
  }

  createValidatorWithRegistry<T>(
    targetInterface: InterfaceInfo,
    allInterfaces: InterfaceInfo[]
  ): ValidatorFunction<T> {
    this.registerInterfaces(allInterfaces);
    return this.createValidator<T>(targetInterface);
  }

  private createValidatorForInterface<T>(
    interfaceInfo: InterfaceInfo,
  ): ValidatorFunction<T> {
    if (this.isTypeAlias(interfaceInfo)) {
      const valueProperty = interfaceInfo.properties[0];
      return (value: unknown, path: string = interfaceInfo.name): T => {
        return this.validateTypeInfo(value, valueProperty.type, path) as T;
      };
    }

    return (value: unknown, path: string = interfaceInfo.name): T => {
      const obj = validateObject(value, path);
      const result: Record<string, unknown> = {};

      for (const property of interfaceInfo.properties) {
        const propPath = `${path}.${property.name}`;
        const propValue = validateProperty(
          obj,
          property.name,
          path,
          property.optional,
        );

        if (propValue !== undefined) {
          result[property.name] = this.validateTypeInfo(
            propValue,
            property.type,
            propPath,
          );
        } else if (!property.optional) {
          throw ValidationError.missing(propPath);
        }
      }

      return result as T;
    };
  }

  createTypeValidator<T>(typeInfo: TypeInfo): ValidatorFunction<T> {
    return (value: unknown, path: string = "value"): T => {
      return this.validateTypeInfo(value, typeInfo, path) as T;
    };
  }

  private validateTypeInfo(
    value: unknown,
    typeInfo: TypeInfo,
    path: string,
  ): unknown {
    switch (typeInfo.kind) {
      case "string":
        return validateString(value, path);

      case "number":
        return validateNumber(value, path);

      case "boolean":
        return validateBoolean(value, path);

      case "date":
        return validateDate(value, path);

      case "literal":
        return validateLiteral(
          value,
          typeInfo.value as string | number | boolean,
          path,
        );

      case "array":
        if (!typeInfo.elementType) {
          throw new Error(`Array type missing elementType at ${path}`);
        }
        return validateArrayElements(value, path, (item, itemPath) =>
          this.validateTypeInfo(item, typeInfo.elementType!, itemPath),
        );

      case "object":
        if (!typeInfo.properties) {
          return validateObject(value, path);
        }

        const propertyValidators: Record<
          string,
          (val: unknown, propPath: string) => unknown
        > = {};

        for (const prop of typeInfo.properties) {
          if (prop.optional) {
            propertyValidators[prop.name] = (
              val: unknown,
              propPath: string,
            ) => {
              if (val === undefined) return undefined;
              return this.validateTypeInfo(val, prop.type, propPath);
            };
          } else {
            propertyValidators[prop.name] = (
              val: unknown,
              propPath: string,
            ) => {
              return this.validateTypeInfo(val, prop.type, propPath);
            };
          }
        }

        return validateObjectWithProperties(value, path, propertyValidators);

      case "union":
        if (!typeInfo.types) {
          throw new Error(`Union type missing types at ${path}`);
        }

        const validators = typeInfo.types.map(
          (unionType) => (val: unknown, unionPath: string) =>
            this.validateTypeInfo(val, unionType, unionPath),
        );

        return validateUnion(value, path, validators);

      case "reference":
        if (!typeInfo.name) {
          throw new Error(`Reference type missing name at ${path}`);
        }

        const referencedInterface = this.interfaceRegistry.get(typeInfo.name);
        if (!referencedInterface) {
          throw new Error(
            `Reference type '${typeInfo.name}' not found in registry at ${path}. ` +
            `Available types: [${Array.from(this.interfaceRegistry.keys()).join(', ')}]`
          );
        }

        if (this.isTypeAlias(referencedInterface)) {
          const valueProperty = referencedInterface.properties[0];
          return this.validateTypeInfo(value, valueProperty.type, path);
        }

        const refValidator = this.createValidator(referencedInterface);
        return refValidator(value, path);

      default:
        throw new Error(`Unknown type kind '${typeInfo.kind}' at ${path}`);
    }
  }

  clearCache(): void {
    this.validatorCache.clear();
  }

  clearRegistry(): void {
    this.interfaceRegistry.clear();
  }

  clear(): void {
    this.clearCache();
    this.clearRegistry();
  }
}
