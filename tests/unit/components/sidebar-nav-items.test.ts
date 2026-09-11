import { describe, test, expect } from "vitest";
import { navItemsFor, transactionItems } from "@/components/layout/Sidebar";

// The Send teaser pill (PM, 13 Aug) comes off only for a user who owns a
// custodial wallet — /send is a real transfer form for them (USDX-567).
describe("navItemsFor", () => {
  describe("positive", () => {
    test("custodial owner: Send loses the Coming Soon pill, Bridge keeps it", () => {
      const items = navItemsFor(transactionItems, true);
      expect(items.find((i) => i.href === "/send")?.comingSoon).toBe(false);
      expect(items.find((i) => i.href === "/bridge")?.comingSoon).toBe(true);
    });
  });

  describe("negative", () => {
    test("no custodial wallet: the list is untouched", () => {
      expect(navItemsFor(transactionItems, false)).toBe(transactionItems);
      expect(transactionItems.find((i) => i.href === "/send")?.comingSoon).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("never mutates the shared list", () => {
      navItemsFor(transactionItems, true);
      expect(transactionItems.find((i) => i.href === "/send")?.comingSoon).toBe(true);
    });
  });
});
