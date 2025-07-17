// Simple test for magic validation system
// This tests our implementation without relying on the complex build system

import {
  validate,
  validateAs,
  isValid,
  tryValidate,
  ValidationError,
} from "./src/index.js";
import { registerValidator } from "./src/validator/magic-validator.js";

// Define a simple interface for testing
interface TestUser {
  id: number;
  name: string;
  email: string;
  active?: boolean;
}

// Manually register a validator to simulate what the build plugin would do
function createTestUserValidator() {
  return function validateTestUser(data: unknown): TestUser {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw ValidationError.create("data", "object", typeof data, data);
    }

    const obj = data as Record<string, unknown>;

    // Validate id
    if (obj.id === undefined) {
      throw ValidationError.missing("id");
    }
    if (typeof obj.id !== "number") {
      throw ValidationError.create("id", "number", typeof obj.id, obj.id);
    }

    // Validate name
    if (obj.name === undefined) {
      throw ValidationError.missing("name");
    }
    if (typeof obj.name !== "string") {
      throw ValidationError.create("name", "string", typeof obj.name, obj.name);
    }

    // Validate email
    if (obj.email === undefined) {
      throw ValidationError.missing("email");
    }
    if (typeof obj.email !== "string") {
      throw ValidationError.create(
        "email",
        "string",
        typeof obj.email,
        obj.email,
      );
    }

    // Validate optional active
    if (obj.active !== undefined && typeof obj.active !== "boolean") {
      throw ValidationError.create(
        "active",
        "boolean",
        typeof obj.active,
        obj.active,
      );
    }

    return data as TestUser;
  };
}

// Register the validator
registerValidator("TestUser", createTestUserValidator());

// Test the magic validation
console.log("🎯 Testing Magic Validation System...\n");

// Test 1: Valid data
console.log("Test 1: Valid data");
const validData = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  active: true,
};
try {
  const result = validateAs<TestUser>("TestUser", validData);
  console.log("✅ Success:", result);
} catch (error) {
  console.log("❌ Failed:", error);
}

// Test 2: isValid check (using explicit function)
console.log("\nTest 2: isValid check");
function isValidTestUser(data: unknown): boolean {
  try {
    validateAs<TestUser>("TestUser", data);
    return true;
  } catch {
    return false;
  }
}
console.log("Valid data isValid:", isValidTestUser(validData));
console.log("Invalid data isValid:", isValidTestUser({ id: "invalid" }));

// Test 3: tryValidate (using explicit function)
console.log("\nTest 3: tryValidate");
function tryValidateTestUser(data: unknown) {
  try {
    const validData = validateAs<TestUser>("TestUser", data);
    return { success: true as const, data: validData };
  } catch (error) {
    const validationError =
      error instanceof ValidationError
        ? error
        : new ValidationError(
            `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
          );
    return { success: false as const, error: validationError };
  }
}

const result = tryValidateTestUser(validData);
if (result.success) {
  console.log("✅ tryValidate success:", result.data);
} else {
  console.log("❌ tryValidate failed:", result.error.message);
}

// Test 4: Invalid data
console.log("\nTest 4: Invalid data");
const invalidData = {
  id: "not-a-number",
  name: "John",
  email: "john@example.com",
};
try {
  validateAs<TestUser>("TestUser", invalidData);
  console.log("❌ Should have failed");
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("✅ Correctly failed with ValidationError:", error.message);
  } else {
    console.log("❌ Wrong error type:", error);
  }
}

// Test 5: Missing data
console.log("\nTest 5: Missing required field");
const missingData = { id: 1, name: "John" };
try {
  validateAs<TestUser>("TestUser", missingData);
  console.log("❌ Should have failed");
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("✅ Correctly failed with ValidationError:", error.message);
  } else {
    console.log("❌ Wrong error type:", error);
  }
}
