import { describe, test, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateAmount,
  validateAddress,
  validateConfirmPassword,
  validateFullName,
  validatePhone,
  validateBankAccountNumber,
  validateBankAccountName,
  parseScannedAddress,
  passwordScore,
  translateValidation,
} from "@/lib/validations";

// The contract these tests hold to: a validator returns an **i18n key**, never a
// sentence. A sentence coming back out of this file is the D1 regression — that
// is how "Email is required" ended up under an Indonesian label.

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
      expect(validateEmail("")).toBe("validation.email.required");
    });
    test("rejects missing @ symbol", () => {
      expect(validateEmail("userexample.com")).toBe("validation.email.format");
    });
    test("rejects missing domain", () => {
      expect(validateEmail("user@")).toBe("validation.email.format");
    });
  });

  describe("edge cases", () => {
    test("rejects email with spaces", () => {
      expect(validateEmail("user @example.com")).toBe("validation.email.format");
    });
    test("rejects double @ symbol", () => {
      expect(validateEmail("user@@example.com")).toBe("validation.email.format");
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
      expect(validatePassword("")).toBe("validation.password.required");
    });
    test("rejects short password", () => {
      expect(validatePassword("Ab1")).toBe("validation.password.minLength");
    });
    test("rejects password without uppercase", () => {
      expect(validatePassword("abcdef1234")).toBe("validation.password.uppercase");
    });
    test("rejects password without lowercase", () => {
      expect(validatePassword("ABCDEF1234")).toBe("validation.password.lowercase");
    });
    test("rejects password without number", () => {
      expect(validatePassword("Abcdefghij")).toBe("validation.password.number");
    });
  });

  describe("edge cases", () => {
    test("accepts exactly 8 characters meeting all rules", () => {
      expect(validatePassword("Abcdef12")).toBeNull();
    });
  });
});

describe("passwordScore", () => {
  test("counts the rules met, in step with validatePassword", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBe(1); // lowercase only
    expect(passwordScore("abcdefgh")).toBe(2); // length + lowercase
    expect(passwordScore("Abcdefgh")).toBe(3); // length + upper + lower
    expect(passwordScore("Abcdef12")).toBe(4);
  });

  test("a full score is exactly the set validatePassword accepts", () => {
    expect(validatePassword("Abcdef12")).toBeNull();
    expect(passwordScore("Abcdef12")).toBe(4);
    expect(validatePassword("abcdefgh")).not.toBeNull();
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
      expect(validateAmount("", "mint")).toBe("validation.amount.required");
    });
    test("rejects non-numeric string", () => {
      expect(validateAmount("abc", "mint")).toBe("validation.amount.invalid");
    });
    test("rejects zero", () => {
      expect(validateAmount("0", "mint")).toBe("validation.amount.positive");
    });
    test("rejects negative amount", () => {
      expect(validateAmount("-100", "mint")).toBe("validation.amount.positive");
    });
    test("rejects amount below minimum", () => {
      expect(validateAmount("5", "mint")).toBe("validation.amount.minMint");
      expect(validateAmount("5", "redeem")).toBe("validation.amount.minRedeem");
    });
    test("rejects amount above maximum", () => {
      expect(validateAmount("2000000", "mint")).toBe("validation.amount.maxMint");
      expect(validateAmount("2000000", "redeem")).toBe("validation.amount.maxRedeem");
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
      expect(validateAmount("   ", "mint")).toBe("validation.amount.required");
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
      expect(validateAddress("")).toBe("validation.address.required");
    });
    test("rejects EVM address with wrong length", () => {
      expect(validateAddress("0x1234")).toBe("validation.address.evmLength");
    });
    test("rejects EVM address with invalid characters", () => {
      expect(
        validateAddress("0xGGGG567890abcdef1234567890abcdef12345678")
      ).toBe("validation.address.evmFormat");
    });
    test("rejects short Solana address", () => {
      expect(validateAddress("abc")).toBe("validation.address.solanaLength");
    });
  });

  describe("edge cases", () => {
    test("accepts EVM address with mixed case", () => {
      expect(
        validateAddress("0xAbCdEf7890AbCdEf1234567890AbCdEf12345678")
      ).toBeNull();
    });
    test("rejects plain text too short for Solana", () => {
      expect(validateAddress("notanaddress")).toBe("validation.address.solanaLength");
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
        "validation.confirmPassword.required"
      );
    });
    test("rejects mismatched passwords", () => {
      expect(validateConfirmPassword("Password1", "Password2")).toBe(
        "validation.confirmPassword.mismatch"
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
      expect(validateFullName("")).toBe("validation.fullName.required");
    });
    test("rejects single character", () => {
      expect(validateFullName("J")).toBe("validation.fullName.minLength");
    });
  });

  describe("edge cases", () => {
    test("rejects whitespace-only name", () => {
      expect(validateFullName("   ")).toBe("validation.fullName.required");
    });
    test("accepts exactly 2 characters", () => {
      expect(validateFullName("Jo")).toBeNull();
    });
  });
});

describe("validatePhone", () => {
  test("accepts Indonesian mobile numbers in every accepted prefix", () => {
    expect(validatePhone("081234567890")).toBeNull();
    expect(validatePhone("+6281234567890")).toBeNull();
    expect(validatePhone("0812 3456 7890")).toBeNull();
  });

  test("rejects an empty or non-Indonesian number", () => {
    expect(validatePhone("")).toBe("validation.phone.required");
    expect(validatePhone("   ")).toBe("validation.phone.required");
    expect(validatePhone("+15551234567")).toBe("validation.phone.format");
  });
});

describe("validateBankAccountNumber", () => {
  test("accepts 6–20 digits", () => {
    expect(validateBankAccountNumber("123456")).toBeNull();
    expect(validateBankAccountNumber("12345678901234567890")).toBeNull();
  });

  test("rejects empty, too short, and non-digits", () => {
    expect(validateBankAccountNumber("")).toBe("validation.bankAccountNumber.required");
    expect(validateBankAccountNumber("12345")).toBe("validation.bankAccountNumber.digits");
    expect(validateBankAccountNumber("12345a")).toBe("validation.bankAccountNumber.digits");
  });
});

describe("validateBankAccountName", () => {
  test("accepts a name of two characters or more", () => {
    expect(validateBankAccountName("Jo")).toBeNull();
  });

  test("rejects empty and single-character names", () => {
    expect(validateBankAccountName("  ")).toBe("validation.bankAccountName.required");
    expect(validateBankAccountName("J")).toBe("validation.bankAccountName.minLength");
  });
});

describe("translateValidation", () => {
  // Stands in for `useLang().t` — records what the component would ask for.
  const t = (key: string, vars?: Record<string, string>) =>
    vars ? `${key}|${JSON.stringify(vars)}` : key;

  test("passes a null key straight through", () => {
    expect(translateValidation(t, null)).toBeNull();
    expect(translateValidation(t, validateEmail("user@example.com"))).toBeNull();
  });

  test("translates a plain key without variables", () => {
    expect(translateValidation(t, validateEmail(""))).toBe("validation.email.required");
  });

  test("supplies the bound from constants.ts, not from the dictionary", () => {
    expect(translateValidation(t, validatePassword("Ab1"))).toBe(
      'validation.password.minLength|{"min":"8"}'
    );
    expect(translateValidation(t, validateAmount("5", "mint"))).toBe(
      'validation.amount.minMint|{"amount":"10"}'
    );
    expect(translateValidation(t, validateAmount("2000000", "redeem"))).toBe(
      'validation.amount.maxRedeem|{"amount":"1,000,000"}'
    );
  });
});

describe("parseScannedAddress", () => {
  const ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

  describe("positive", () => {
    test("returns a bare EVM address as-is (checksum-insensitive)", () => {
      expect(parseScannedAddress(ADDR)).toBe(ADDR);
      expect(parseScannedAddress(ADDR.toLowerCase())).toBe(ADDR.toLowerCase());
    });
    test("trims surrounding whitespace", () => {
      expect(parseScannedAddress(`  ${ADDR}  `)).toBe(ADDR);
    });
    test("extracts the address from an EIP-681 ethereum: URI", () => {
      expect(parseScannedAddress(`ethereum:${ADDR}`)).toBe(ADDR);
      expect(parseScannedAddress(`ethereum:${ADDR}@1`)).toBe(ADDR);
      expect(parseScannedAddress(`ethereum:${ADDR}@137/transfer?value=1`)).toBe(ADDR);
    });
  });

  describe("negative", () => {
    test("returns null for empty / non-address payloads", () => {
      expect(parseScannedAddress("")).toBeNull();
      expect(parseScannedAddress("https://example.com")).toBeNull();
      expect(parseScannedAddress("not an address")).toBeNull();
    });
    test("returns null for a malformed EVM address", () => {
      expect(parseScannedAddress("0x123")).toBeNull(); // too short
      expect(parseScannedAddress(ADDR + "ab")).toBeNull(); // too long
      expect(parseScannedAddress("0xZZZ" + ADDR.slice(5))).toBeNull(); // non-hex
    });
  });
});

describe("dictionary coverage", () => {
  test("every key a validator can return exists in both languages", async () => {
    const { dictionaries } = await import("@/lib/i18n/dictionaries");
    const returned = [
      validateEmail(""),
      validateEmail("nope"),
      validatePassword(""),
      validatePassword("Ab1"),
      validatePassword("abcdef1234"),
      validatePassword("ABCDEF1234"),
      validatePassword("Abcdefghij"),
      validateConfirmPassword("a", ""),
      validateConfirmPassword("a", "b"),
      validateAmount("", "mint"),
      validateAmount("abc", "mint"),
      validateAmount("0", "mint"),
      validateAmount("5", "mint"),
      validateAmount("2000000", "mint"),
      validateAmount("5", "redeem"),
      validateAmount("2000000", "redeem"),
      validateAddress(""),
      validateAddress("0x1234"),
      validateAddress("0xGGGG567890abcdef1234567890abcdef12345678"),
      validateAddress("abc"),
      validateAddress("0OIl".repeat(8)),
      validateFullName(""),
      validateFullName("J"),
      validatePhone(""),
      validatePhone("+15551234567"),
      validateBankAccountNumber(""),
      validateBankAccountNumber("1"),
      validateBankAccountName(""),
      validateBankAccountName("J"),
    ].filter((key): key is string => key !== null);

    expect(returned.length).toBeGreaterThan(0);
    for (const key of new Set(returned)) {
      expect(dictionaries.id[key], `missing id: ${key}`).toBeTruthy();
      expect(dictionaries.en[key], `missing en: ${key}`).toBeTruthy();
    }
  });
});
