import { describe, test, expect } from "vitest";
import {
  SUPPORTED_CHAINS,
  getChainById,
  DEFAULT_CHAIN_ID,
} from "@/lib/chains";

describe("SUPPORTED_CHAINS", () => {
  test("contains exactly 8 chains", () => {
    expect(SUPPORTED_CHAINS).toHaveLength(8);
  });

  test("each chain has all required fields", () => {
    for (const chain of SUPPORTED_CHAINS) {
      expect(chain.id).toBeTruthy();
      expect(chain.name).toBeTruthy();
      expect(chain.shortName).toBeTruthy();
      expect(chain.icon).toBeTruthy();
      expect(chain.contractAddress).toBeTruthy();
      expect(chain.explorerUrl).toBeTruthy();
    }
  });

  test("contains Solana as UI-only chain", () => {
    const ids = SUPPORTED_CHAINS.map((c) => c.id);
    expect(ids).toContain("solana");
  });

  test("each chain icon points to /icon/ directory", () => {
    for (const chain of SUPPORTED_CHAINS) {
      expect(chain.icon).toMatch(/^\/icon\/.+\.svg$/);
    }
  });

  test("DEFAULT_CHAIN_ID is base", () => {
    expect(DEFAULT_CHAIN_ID).toBe("base");
  });
});

describe("getChainById", () => {
  describe("positive", () => {
    test("returns chain for valid ID 'base'", () => {
      const chain = getChainById("base");
      expect(chain).toBeDefined();
      expect(chain?.name).toBe("Base");
    });

    test("returns chain for each supported chain", () => {
      for (const expected of SUPPORTED_CHAINS) {
        const chain = getChainById(expected.id);
        expect(chain).toBeDefined();
        expect(chain?.id).toBe(expected.id);
      }
    });
  });

  describe("negative", () => {
    test("returns undefined for invalid ID", () => {
      expect(getChainById("invalid")).toBeUndefined();
    });

    test("returns undefined for empty string", () => {
      expect(getChainById("")).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("chain IDs are case-sensitive", () => {
      expect(getChainById("Base")).toBeUndefined();
      expect(getChainById("BASE")).toBeUndefined();
    });
  });
});
