import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { OutboundLockNotice } from "@/components/shared/OutboundLockNotice";
import { formatDateTime } from "@/lib/utils";

// Banner kunci 24 jam uang keluar custodial (custodial-wallet.md §6.1 no.6, USDX-717):
// "ditahan sampai [waktu lokal]" — satu komponen untuk /send dan redeem custodial,
// baik dari GET /wallet `outboundLockedUntil` maupun 409 `details.lockedUntil`.
const UNTIL = "2026-09-26T10:00:00.000Z";

function renderNotice(lockedUntil: string | null) {
  return render(
    <LanguageProvider>
      <OutboundLockNotice lockedUntil={lockedUntil} data-testid="lock" />
    </LanguageProvider>,
  );
}

describe("OutboundLockNotice", () => {
  describe("positive", () => {
    test("says money out is on hold until the local time, and why", () => {
      renderNotice(UNTIL);
      const notice = screen.getByTestId("lock");
      expect(notice).toHaveTextContent("Transfer & redeem ditahan");
      expect(notice).toHaveTextContent(`ditahan sampai ${formatDateTime(UNTIL, "id")}`);
      expect(notice).toHaveTextContent(/2FA baru dimatikan atau diganti/);
    });
  });

  describe("negative", () => {
    test("renders nothing when not locked", () => {
      renderNotice(null);
      expect(screen.queryByTestId("lock")).toBeNull();
    });
  });

  describe("edge case", () => {
    test("tells a stranger what to do (not you? contact support)", () => {
      renderNotice(UNTIL);
      expect(screen.getByTestId("lock")).toHaveTextContent(/hubungi support/);
    });
  });
});
