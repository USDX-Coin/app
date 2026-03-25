import { describe, test, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateAmount,
  validateAddress,
  validateConfirmPassword,
  validateFullName,
} from "@/lib/validations";

describe("validateEmail", () => {
  describe("positive", () => {
    test("accepts valid email", () => {
      expect(validateEmail("user@example.com")).toBeNull();
    });
    test("accepts email with subdomain", () => {
      expect(validateEmail("user@mail.example.com")).toBeNull();
    });
    test("accepts email with plus sign", () => {
      expect(validateEmail("user+tag@example.com")).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty string", () => {
      expect(validateEmail("")).toBe("Email is required");
    });
    test("rejects missing @ symbol", () => {
      expect(validateEmail("userexample.com")).toBe("Invalid email format");
    });
    test("rejects missing domain", () => {
      expect(validateEmail("user@")).toBe("Invalid email format");
    });
  });

  describe("edge cases", () => {
    test("rejects email with spaces", () => {
      expect(validateEmail("user @example.com")).toBe("Invalid email format");
    });
    test("rejects double @ symbol", () => {
      expect(validateEmail("user@@example.com")).toBe("Invalid email format");
    });
  });
});

describe("validatePassword", () => {
  describe("positive", () => {
    test("accepts valid password with all requirements", () => {
      expect(validatePassword("Abcdef1234")).toBeNull();
    });
    test("accepts password with special characters", () => {
      expect(validatePassword("P@ssw0rd!")).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty password", () => {
      expect(validatePassword("")).toBe("Password is required");
    });
    test("rejects short password", () => {
      expect(validatePassword("Ab1")).toBe(
        "Password must be at least 8 characters"
      );
    });
    test("rejects password without uppercase", () => {
      expect(validatePassword("abcdef1234")).toBe(
        "Password must contain an uppercase letter"
      );
    });
    test("rejects password without lowercase", () => {
      expect(validatePassword("ABCDEF1234")).toBe(
        "Password must contain a lowercase letter"
      );
    });
    test("rejects password without number", () => {
      expect(validatePassword("Abcdefghij")).toBe(
        "Password must contain a number"
      );
    });
  });

  describe("edge cases", () => {
    test("accepts exactly 8 characters meeting all rules", () => {
      expect(validatePassword("Abcdef12")).toBeNull();
    });
  });
});

describe("validateAmount", () => {
  describe("positive", () => {
    test("accepts valid mint amount", () => {
      expect(validateAmount("100", "mint")).toBeNull();
    });
    test("accepts valid redeem amount", () => {
      expect(validateAmount("500", "redeem")).toBeNull();
    });
    test("accepts amount with commas", () => {
      expect(validateAmount("1,000", "mint")).toBeNull();
    });
    test("accepts decimal amount", () => {
      expect(validateAmount("100.50", "mint")).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty amount", () => {
      expect(validateAmount("", "mint")).toBe("Amount is required");
    });
    test("rejects non-numeric string", () => {
      expect(validateAmount("abc", "mint")).toBe("Invalid amount");
    });
    test("rejects zero", () => {
      expect(validateAmount("0", "mint")).toBe(
        "Amount must be greater than 0"
      );
    });
    test("rejects negative amount", () => {
      expect(validateAmount("-100", "mint")).toBe(
        "Amount must be greater than 0"
      );
    });
    test("rejects amount below minimum", () => {
      expect(validateAmount("5", "mint")).toBe("Minimum amount is 10 USDX");
    });
    test("rejects amount above maximum", () => {
      expect(validateAmount("2000000", "mint")).toBe(
        "Maximum amount is 1,000,000 USDX"
      );
    });
  });

  describe("edge cases", () => {
    test("accepts minimum boundary amount", () => {
      expect(validateAmount("10", "mint")).toBeNull();
    });
    test("accepts maximum boundary amount", () => {
      expect(validateAmount("1000000", "mint")).toBeNull();
    });
    test("rejects whitespace-only string", () => {
      expect(validateAmount("   ", "mint")).toBe("Amount is required");
    });
  });
});

describe("validateAddress", () => {
  describe("positive", () => {
    test("accepts valid EVM address", () => {
      expect(
        validateAddress("0x1234567890abcdef1234567890abcdef12345678")
      ).toBeNull();
    });
    test("accepts valid Solana address", () => {
      expect(
        validateAddress("7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV")
      ).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty address", () => {
      expect(validateAddress("")).toBe("Destination address is required");
    });
    test("rejects EVM address with wrong length", () => {
      expect(validateAddress("0x1234")).toBe(
        "Invalid EVM address (must be 42 chars)"
      );
    });
    test("rejects EVM address with invalid characters", () => {
      expect(
        validateAddress("0xGGGG567890abcdef1234567890abcdef12345678")
      ).toBe("Invalid EVM address format");
    });
  });

  describe("edge cases", () => {
    test("accepts EVM address with mixed case", () => {
      expect(
        validateAddress("0xAbCdEf7890AbCdEf1234567890AbCdEf12345678")
      ).toBeNull();
    });
  });
});

describe("validateConfirmPassword", () => {
  describe("positive", () => {
    test("accepts matching passwords", () => {
      expect(validateConfirmPassword("Password1", "Password1")).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty confirm password", () => {
      expect(validateConfirmPassword("Password1", "")).toBe(
        "Please confirm your password"
      );
    });
    test("rejects mismatched passwords", () => {
      expect(validateConfirmPassword("Password1", "Password2")).toBe(
        "Passwords do not match"
      );
    });
  });
});

describe("validateFullName", () => {
  describe("positive", () => {
    test("accepts valid full name", () => {
      expect(validateFullName("John Doe")).toBeNull();
    });
  });

  describe("negative", () => {
    test("rejects empty name", () => {
      expect(validateFullName("")).toBe("Full name is required");
    });
    test("rejects single character", () => {
      expect(validateFullName("J")).toBe(
        "Name must be at least 2 characters"
      );
    });
  });

  describe("edge cases", () => {
    test("rejects whitespace-only name", () => {
      expect(validateFullName("   ")).toBe("Full name is required");
    });
    test("accepts exactly 2 characters", () => {
      expect(validateFullName("Jo")).toBeNull();
    });
  });
});
