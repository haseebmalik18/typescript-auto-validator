import { TypeInfo } from "../types";

export function isPrimitiveType(type: TypeInfo): boolean {
  return ["string", "number", "boolean"].includes(type.kind);
}

export function isComplexType(type: TypeInfo): boolean {
  return ["array", "object", "union"].includes(type.kind);
}

export function isLiteralType(type: TypeInfo): boolean {
  return type.kind === "literal";
}

export function isReferenceType(type: TypeInfo): boolean {
  return type.kind === "reference";
}

export function isArrayType(
  type: TypeInfo,
): type is TypeInfo & { kind: "array" } {
  return type.kind === "array";
}

export function isUnionType(
  type: TypeInfo,
): type is TypeInfo & { kind: "union" } {
  return type.kind === "union";
}

export function isObjectType(
  type: TypeInfo,
): type is TypeInfo & { kind: "object" } {
  return type.kind === "object";
}
