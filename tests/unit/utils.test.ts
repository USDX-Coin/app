import { describe, test, expect } from "vitest";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTokenAmount,
  formatUSD,
  truncateAddress,
  parseAmount,
} from "@/lib/utils";

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

describe("formatDuration", () => {
  describe("positive", () => {
    test("renders seconds up to 60 as exact seconds", () => {
      expect(formatDuration(60, "id")).toBe("60 detik");
      expect(formatDuration(59, "id")).toBe("59 detik");
      expect(formatDuration(60, "en")).toBe("60s");
      expect(formatDuration(1, "en")).toBe("1s");
    });

    test("renders minutes between a minute and an hour", () => {
      expect(formatDuration(300, "id")).toBe("5 menit");
      expect(formatDuration(300, "en")).toBe("5 minutes");
    });

    test("renders hours with an 'about' qualifier when rounded", () => {
      // 76451s = 21h14m — forgot-password daily limit (sot/conventions.md
      // § Rate Limiting, 3x/hari). Rounds UP: never promise a shorter wait.
      expect(formatDuration(76451, "id")).toBe("sekitar 22 jam");
      expect(formatDuration(76451, "en")).toBe("about 22 hours");
    });
  });

  describe("negative", () => {
    test("rounds partial minutes up, not down", () => {
      expect(formatDuration(61, "id")).toBe("2 menit");
      expect(formatDuration(3599, "id")).toBe("60 menit");
    });
  });

  describe("edge cases", () => {
    test("exact hours drop the qualifier and stay in hours", () => {
      expect(formatDuration(3600, "id")).toBe("1 jam");
      expect(formatDuration(3600, "en")).toBe("1 hour");
      expect(formatDuration(7200, "id")).toBe("2 jam");
      expect(formatDuration(7200, "en")).toBe("2 hours");
    });

    test("clamps zero and negatives to 0 seconds", () => {
      expect(formatDuration(0, "id")).toBe("0 detik");
      expect(formatDuration(-5, "en")).toBe("0s");
    });
  });
});

/**
 * D3 — Riwayat rendered "Sep 05, 2026 - 01:06" on an Indonesian page because
 * the date was assembled by hand from `toLocaleString("en-US")`. Figma papan 27
 * writes "3 Sep 2026, 11.13"; the dot between hours and minutes is what `id-ID`
 * produces, and these tests are what stop an en-US month name coming back.
 */
describe("formatDateTime", () => {
  const iso = "2026-09-03T11:13:00";

  describe("positive", () => {
    test("Indonesian is the default and matches Figma", () => {
      expect(formatDateTime(iso)).toBe("3 Sep 2026, 11.13");
    });
    test("abbreviates August the Indonesian way", () => {
      expect(formatDateTime("2026-08-29T13:20:00", "id")).toBe("29 Agu 2026, 13.20");
    });
    test("English keeps day-month-year order and a colon", () => {
      expect(formatDateTime(iso, "en")).toBe("3 Sept 2026, 11:13");
    });
    test("pads a single-digit hour", () => {
      expect(formatDateTime("2026-08-27T08:55:00", "id")).toBe("27 Agu 2026, 08.55");
    });
  });

  describe("negative", () => {
    test("an unparseable timestamp renders an em dash, never 'Invalid Date'", () => {
      expect(formatDateTime("not-a-date")).toBe("—");
    });
  });
});

describe("formatDate", () => {
  describe("positive", () => {
    test("uses the Indonesian month name by default", () => {
      expect(formatDate("2026-09-03T11:13:00")).toBe("3 September 2026");
    });
    test("English spells the month out too", () => {
      expect(formatDate("2026-09-03T11:13:00", "en")).toBe("3 September 2026");
    });
  });

  describe("negative", () => {
    test("an unparseable date renders an em dash", () => {
      expect(formatDate("")).toBe("—");
    });
  });
});

describe("formatTokenAmount", () => {
  describe("positive", () => {
    test("a whole number still shows two decimals, Indonesian comma", () => {
      expect(formatTokenAmount(10)).toBe("10,00");
    });
    test("accepts the decimal string the API sends", () => {
      expect(formatTokenAmount("60")).toBe("60,00");
    });
    test("thousands separator is a dot in Indonesian", () => {
      expect(formatTokenAmount(1000)).toBe("1.000,00");
    });
  });

  describe("edge cases", () => {
    test("keeps backend precision instead of rounding it away", () => {
      expect(formatTokenAmount("62.092307")).toBe("62,092307");
    });
    test("English uses a dot decimal and a comma for thousands", () => {
      expect(formatTokenAmount(1000, "en")).toBe("1,000.00");
    });
    test("a non-numeric amount renders an em dash", () => {
      expect(formatTokenAmount("abc")).toBe("—");
    });
  });
});
