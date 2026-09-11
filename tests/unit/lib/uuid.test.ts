import { describe, test, expect } from "vitest";
import { uuidv7 } from "@/lib/uuid";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  describe("positive", () => {
    test("produces an RFC 9562 v7 UUID (version 7, variant 10xx)", () => {
      expect(uuidv7()).toMatch(UUID_V7);
    });

    test("the first 48 bits are the millisecond timestamp", () => {
      const now = 0x0193abcd2c4d; // arbitrary epoch ms
      const id = uuidv7(now);
      expect(id.slice(0, 8) + id.slice(9, 13)).toBe("0193abcd2c4d");
    });
  });

  describe("negative", () => {
    test("two keys are never identical", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 1_000; i++) seen.add(uuidv7());
      expect(seen.size).toBe(1_000);
    });
  });

  describe("edge cases", () => {
    test("later timestamps sort after earlier ones (time-ordered prefix)", () => {
      expect(uuidv7(1_000) < uuidv7(2_000)).toBe(true);
    });
  });
});
