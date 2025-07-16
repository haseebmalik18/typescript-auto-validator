import {
  Project,
  SourceFile,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  PropertySignature,
  TypeNode,
  SyntaxKind,
} from "ts-morph";
import { TypeInfo, PropertyInfo, InterfaceInfo } from "../types";

export class InterfaceExtractor {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
    });
  }

  extractFromFile(filePath: string): InterfaceInfo[] {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    return this.extractFromSourceFile(sourceFile);
  }

  extractFromSource(sourceCode: string, fileName = "temp.ts"): InterfaceInfo[] {
    const sourceFile = this.project.createSourceFile(fileName, sourceCode);
    return this.extractFromSourceFile(sourceFile);
  }

  private extractFromSourceFile(sourceFile: SourceFile): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];

    sourceFile.getInterfaces().forEach((interfaceDecl) => {
      const interfaceInfo = this.extractInterface(interfaceDecl);
      if (interfaceInfo) {
        interfaces.push(interfaceInfo);
      }
    });

    sourceFile.getTypeAliases().forEach((typeAlias) => {
      const interfaceInfo = this.extractTypeAlias(typeAlias);
      if (interfaceInfo) {
        interfaces.push(interfaceInfo);
      }
    });

    return interfaces;
  }

  private extractInterface(
    interfaceDecl: InterfaceDeclaration,
  ): InterfaceInfo | null {
    const name = interfaceDecl.getName();
    if (!name) return null;

    const properties: PropertyInfo[] = [];

    interfaceDecl.getProperties().forEach((prop) => {
      const propertyInfo = this.extractProperty(prop);
      if (propertyInfo) {
        properties.push(propertyInfo);
      }
    });

    return {
      name,
      properties,
      filePath: interfaceDecl.getSourceFile().getFilePath(),
      exported: interfaceDecl.isExported(),
    };
  }

  private extractTypeAlias(
    typeAlias: TypeAliasDeclaration,
  ): InterfaceInfo | null {
    const name = typeAlias.getName();
    if (!name) return null;

    const typeNode = typeAlias.getTypeNode();
    if (!typeNode) return null;

    const typeInfo = this.analyzeType(typeNode);

    if (typeInfo.kind === "union") {
      return {
        name,
        properties: [
          {
            name: "value",
            type: typeInfo,
            optional: false,
            readonly: false,
          },
        ],
        filePath: typeAlias.getSourceFile().getFilePath(),
        exported: typeAlias.isExported(),
      };
    }

    if (typeInfo.kind === "object" && typeInfo.properties) {
      return {
        name,
        properties: typeInfo.properties,
        filePath: typeAlias.getSourceFile().getFilePath(),
        exported: typeAlias.isExported(),
      };
    }

    return {
      name,
      properties: [
        {
          name: "value",
          type: typeInfo,
          optional: false,
          readonly: false,
        },
      ],
      filePath: typeAlias.getSourceFile().getFilePath(),
      exported: typeAlias.isExported(),
    };
  }

  private extractProperty(prop: PropertySignature): PropertyInfo | null {
    const name = prop.getName();
    if (!name) return null;

    const typeNode = prop.getTypeNode();
    const typeInfo = typeNode
      ? this.analyzeType(typeNode)
      : { kind: "unknown" as const, nullable: false };

    return {
      name,
      type: typeInfo,
      optional: prop.hasQuestionToken(),
      readonly: prop.isReadonly(),
    };
  }

  private analyzeType(typeNode: TypeNode): TypeInfo {
    switch (typeNode.getKind()) {
      case SyntaxKind.StringKeyword:
        return { kind: "string" as const, nullable: false };

      case SyntaxKind.NumberKeyword:
        return { kind: "number" as const, nullable: false };

      case SyntaxKind.BooleanKeyword:
        return { kind: "boolean" as const, nullable: false };

      case SyntaxKind.ArrayType:
        const arrayType = typeNode.asKindOrThrow(SyntaxKind.ArrayType);
        const elementType = this.analyzeType(arrayType.getElementTypeNode());
        return { kind: "array" as const, elementType, nullable: false };

      case SyntaxKind.UnionType:
        const unionType = typeNode.asKindOrThrow(SyntaxKind.UnionType);
        const types = unionType.getTypeNodes().map((t) => this.analyzeType(t));
        return { kind: "union" as const, types, nullable: false };

      case SyntaxKind.LiteralType:
        const literalType = typeNode.asKindOrThrow(SyntaxKind.LiteralType);
        const literal = literalType.getLiteral();
        if (literal.getKind() === SyntaxKind.StringLiteral) {
          return {
            kind: "literal" as const,
            value: literal.getText().slice(1, -1),
            literalType: "string" as const,
            nullable: false,
          };
        }
        if (literal.getKind() === SyntaxKind.NumericLiteral) {
          return {
            kind: "literal" as const,
            value: Number(literal.getText()),
            literalType: "number" as const,
            nullable: false,
          };
        }
        return { kind: "unknown" as const, nullable: false };

      case SyntaxKind.TypeReference:
        const typeRef = typeNode.asKindOrThrow(SyntaxKind.TypeReference);
        const typeName = typeRef.getTypeName().getText();

        if (typeName === "Date") {
          return { kind: "date" as const, nullable: false };
        }

        return { kind: "reference" as const, name: typeName, nullable: false };

      case SyntaxKind.TypeLiteral:
        const typeLiteral = typeNode.asKindOrThrow(SyntaxKind.TypeLiteral);
        const properties: PropertyInfo[] = [];

        typeLiteral.getProperties().forEach((prop) => {
          if (prop.getKind() === SyntaxKind.PropertySignature) {
            const propertyInfo = this.extractProperty(
              prop as PropertySignature,
            );
            if (propertyInfo) {
              properties.push(propertyInfo);
            }
          }
        });

        return { kind: "object" as const, properties, nullable: false };

      default:
        return { kind: "unknown" as const, nullable: false };
    }
  }
}
