import {
  InterfaceExtractor,
  TypeAnalyzer,
  CodeGenerator,
} from "../../../src/transformer/index.js";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testExtraction() {
  console.log("🚀 Testing TypeScript Interface Extraction\n");

  const extractor = new InterfaceExtractor();
  const analyzer = new TypeAnalyzer();
  const generator = new CodeGenerator();

  const interfacesPath = join(__dirname, "test-interfaces.ts");

  try {
    console.log("📁 Extracting interfaces from:", interfacesPath);
    const interfaces = extractor.extractFromFile(interfacesPath);

    console.log(`\n✅ Found ${interfaces.length} interfaces:\n`);

    interfaces.forEach((iface, index) => {
      console.log(
        `${index + 1}. ${iface.name} (${iface.exported ? "exported" : "internal"})`,
      );
      console.log(`   📍 File: ${iface.filePath}`);
      console.log(`   🔧 Properties: ${iface.properties.length}`);

      iface.properties.forEach((prop) => {
        const optional = prop.optional ? "?" : "";
        const readonly = prop.readonly ? "readonly " : "";
        console.log(
          `      ${readonly}${prop.name}${optional}: ${formatType(prop.type)}`,
        );
      });

      const dependencies = analyzer.analyzeInterfaceDependencies(
        iface.properties,
      );
      if (dependencies.length > 0) {
        console.log(`   🔗 Dependencies: ${dependencies.join(", ")}`);
      }

      const complexity = iface.properties.reduce(
        (sum, prop) => sum + analyzer.getValidationComplexity(prop.type),
        0,
      );
      console.log(`   📊 Validation Complexity: ${complexity}`);

      console.log();
    });

    console.log("🔧 Generating validators...\n");

    const userInterface = interfaces.find((i) => i.name === "User");
    if (userInterface) {
      console.log("📄 Generated User validator:");
      console.log("─".repeat(80));
      const validator = generator.generateValidator(userInterface);
      console.log(validator);
      console.log("─".repeat(80));

      console.log("\n📄 Generated User type guard:");
      console.log("─".repeat(80));
      const typeGuard = generator.generateTypeGuard(userInterface);
      console.log(typeGuard);
      console.log("─".repeat(80));
    }

    console.log("\n🎯 Generating complete validator bundle...");
    const bundle = generator.generateValidatorBundle(interfaces);
    console.log(
      `✅ Bundle generated: ${bundle.split("\n").length} lines of code`,
    );
  } catch (error) {
    console.error("❌ Error during extraction:", error);
  }
}

function formatType(type: any): string {
  switch (type.kind) {
    case "string":
    case "number":
    case "boolean":
    case "date":
      return type.kind;

    case "array":
      return `${formatType(type.elementType)}[]`;

    case "union":
      return type.types.map(formatType).join(" | ");

    case "literal":
      return typeof type.value === "string"
        ? `'${type.value}'`
        : String(type.value);

    case "reference":
      return type.name;

    case "object":
      return `{ ${type.properties?.length || 0} props }`;

    default:
      return type.kind || "unknown";
  }
}

testExtraction().catch(console.error);
