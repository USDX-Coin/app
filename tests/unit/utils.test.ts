import { describe, test, expect } from "vitest";
import { formatAmount, formatUSD, truncateAddress, parseAmount } from "@/lib/utils";

describe("formatAmount", () => {
  describe("positive", () => {
    test("formats integer correctly", () => {
      expect(formatAmount(1000)).toBe("1,000");
    });
    test("formats decimal correctly", () => {
      expect(formatAmount(1234.56)).toBe("1,234.56");
    });
    test("formats large number with commas", () => {
      expect(formatAmount(1000000)).toBe("1,000,000");
    });
  });

  describe("negative", () => {
    test("formats zero", () => {
      expect(formatAmount(0)).toBe("0");
    });
    test("formats negative number", () => {
      expect(formatAmount(-500)).toBe("-500");
    });
  });

  describe("edge cases", () => {
    test("formats small decimal", () => {
      expect(formatAmount(0.1)).toBe("0.1");
    });
    test("truncates beyond 2 decimal places", () => {
      expect(formatAmount(1.999)).toBe("2");
    });
  });
});

describe("formatUSD", () => {
  describe("positive", () => {
    test("formats as USD currency", () => {
      expect(formatUSD(1000)).toBe("$1,000.00");
    });
    test("formats with cents", () => {
      expect(formatUSD(99.99)).toBe("$99.99");
    });
  });

  describe("edge cases", () => {
    test("formats zero", () => {
      expect(formatUSD(0)).toBe("$0.00");
    });
  });
});

describe("truncateAddress", () => {
  describe("positive", () => {
    test("truncates long EVM address", () => {
      expect(
        truncateAddress("0x1234567890abcdef1234567890abcdef12345678")
      ).toBe("0x1234...5678");
    });
    test("truncates with custom chars", () => {
      expect(
        truncateAddress("0x1234567890abcdef1234567890abcdef12345678", 6)
      ).toBe("0x123456...345678");
    });
  });

  describe("negative", () => {
    test("returns short address unchanged", () => {
      expect(truncateAddress("0x1234")).toBe("0x1234");
    });
  });

  describe("edge cases", () => {
    test("handles empty string", () => {
      expect(truncateAddress("")).toBe("");
    });
  });
});

describe("parseAmount", () => {
  describe("positive", () => {
    test("parses simple number", () => {
      expect(parseAmount("1000")).toBe(1000);
    });
    test("parses number with commas", () => {
      expect(parseAmount("1,000,000")).toBe(1000000);
    });
    test("parses decimal", () => {
      expect(parseAmount("99.99")).toBe(99.99);
    });
  });

  describe("negative", () => {
    test("returns 0 for non-numeric string", () => {
      expect(parseAmount("abc")).toBe(0);
    });
    test("returns 0 for empty string", () => {
      expect(parseAmount("")).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("parses zero", () => {
      expect(parseAmount("0")).toBe(0);
    });
  });
});
