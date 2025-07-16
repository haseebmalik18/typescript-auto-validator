import { InterfaceExtractor } from "../../../src/transformer/interface-extractor.js";

const extractor = new InterfaceExtractor();

const testCode = `
export interface SimpleUser {
  id: number;
  name: string;
  email?: string;
}

export interface ComplexData {
  users: SimpleUser[];
  metadata: {
    total: number;
    page: number;
  };
  status: 'loading' | 'success' | 'error';
}
`;

console.log("🧪 Testing inline extraction...\n");

const interfaces = extractor.extractFromSource(testCode);

interfaces.forEach((iface) => {
  console.log(`Interface: ${iface.name}`);
  iface.properties.forEach((prop) => {
    console.log(
      `  ${prop.name}${prop.optional ? "?" : ""}: ${JSON.stringify(prop.type, null, 2)}`,
    );
  });
  console.log();
});
