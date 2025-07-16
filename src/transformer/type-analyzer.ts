import { TypeInfo, PropertyInfo } from "../types";

export class TypeAnalyzer {
  analyzeInterfaceDependencies(properties: PropertyInfo[]): string[] {
    const dependencies = new Set<string>();

    properties.forEach((prop) => {
      this.collectTypeDependencies(prop.type, dependencies);
    });

    return Array.from(dependencies);
  }

  private collectTypeDependencies(
    type: TypeInfo,
    dependencies: Set<string>,
  ): void {
    switch (type.kind) {
      case "reference":
        if (type.name) {
          dependencies.add(type.name);
        }
        break;

      case "array":
        if (type.elementType) {
          this.collectTypeDependencies(type.elementType, dependencies);
        }
        break;

      case "union":
        if (type.types) {
          type.types.forEach((t) =>
            this.collectTypeDependencies(t, dependencies),
          );
        }
        break;

      case "object":
        if (type.properties) {
          type.properties.forEach((prop) =>
            this.collectTypeDependencies(prop.type, dependencies),
          );
        }
        break;
    }
  }

  getValidationComplexity(type: TypeInfo): number {
    switch (type.kind) {
      case "string":
      case "number":
      case "boolean":
      case "literal":
        return 1;

      case "date":
        return 2;

      case "array":
        return (
          3 +
          (type.elementType
            ? this.getValidationComplexity(type.elementType)
            : 0)
        );

      case "union":
        return (
          2 +
          (type.types
            ? Math.max(
                ...type.types.map((t) => this.getValidationComplexity(t)),
              )
            : 0)
        );

      case "object":
        return (
          3 +
          (type.properties
            ? type.properties.reduce(
                (sum, prop) => sum + this.getValidationComplexity(prop.type),
                0,
              )
            : 0)
        );

      case "reference":
        return 5;

      default:
        return 10;
    }
  }

  isNullableType(type: TypeInfo): boolean {
    if (type.nullable) return true;

    if (type.kind === "union" && type.types) {
      return type.types.some((t) => t.kind === "literal" && t.value === null);
    }

    return false;
  }
}
