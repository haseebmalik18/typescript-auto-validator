import {
  Node,
  SyntaxKind,
  InterfaceDeclaration,
  ClassDeclaration,
} from "ts-morph";

export function isExportedNode(node: Node): boolean {
  if (
    node instanceof InterfaceDeclaration ||
    node instanceof ClassDeclaration
  ) {
    return node
      .getModifiers()
      .some((modifier) => modifier.getKind() === SyntaxKind.ExportKeyword);
  }
  return false;
}

export function getNodeText(node: Node): string {
  return node.getText().trim();
}

export function findNodesByKind<T extends Node>(
  node: Node,
  kind: SyntaxKind,
): T[] {
  return node.getDescendantsOfKind(kind) as T[];
}

export function hasModifier(node: Node, kind: SyntaxKind): boolean {
  if (
    node instanceof InterfaceDeclaration ||
    node instanceof ClassDeclaration
  ) {
    return node.getModifiers().some((modifier) => modifier.getKind() === kind);
  }
  return false;
}
