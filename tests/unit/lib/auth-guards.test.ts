import { describe, test, expect } from "vitest";
import {
  emailVerificationGate,
  isEmailVerified,
  isKycVerified,
  canTransact,
} from "@/lib/auth/guards";
import type { User } from "@/types";

const verified: User = {
  id: "usr_1",
  name: "Test User",
  email: "test@example.com",
  phone: "+628123456789",
  entityType: "INDIVIDUAL",
  kycStatus: "VERIFIED",
  suspended: false,
  emailVerifiedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const unverified: User = { ...verified, emailVerifiedAt: null };

describe("auth guards", () => {
  describe("emailVerificationGate", () => {
    describe("positive", () => {
      test("a user with emailVerifiedAt is allowed", () => {
        expect(emailVerificationGate(verified)).toBe("allowed");
      });
    });

    describe("negative", () => {
      test("a user without emailVerifiedAt is blocked", () => {
        expect(emailVerificationGate(unverified)).toBe("blocked");
      });
    });

    describe("edge cases", () => {
      // THE regression this change exists to prevent: the user object is no longer
      // persisted, so on every cold load it is null until GET /auth/me answers. If
      // that window collapsed into "blocked", a legitimate verified customer would
      // be thrown at the email-verification gate on every reload.
      test("an unknown user (session still loading) is NEVER blocked", () => {
        expect(emailVerificationGate(null)).toBe("unknown");
        expect(emailVerificationGate(null)).not.toBe("blocked");
        expect(emailVerificationGate(undefined)).toBe("unknown");
        expect(emailVerificationGate(undefined)).not.toBe("blocked");
      });
    });
  });

  // The two-state predicates stay for display-only reads. They cannot tell
  // "not verified" from "not loaded yet", which is why nothing that redirects or
  // locks a customer out may call them directly.
  describe("boolean predicates", () => {
    describe("positive", () => {
      test("isEmailVerified / isKycVerified / canTransact hold for a verified user", () => {
        expect(isEmailVerified(verified)).toBe(true);
        expect(isKycVerified(verified)).toBe(true);
        expect(canTransact(verified)).toBe(true);
      });
    });

    describe("negative", () => {
      test("a suspended user cannot transact", () => {
        expect(canTransact({ ...verified, suspended: true })).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("null collapses to false — the ambiguity emailVerificationGate exists to remove", () => {
        expect(isEmailVerified(null)).toBe(false);
        expect(isKycVerified(null)).toBe(false);
        expect(canTransact(null)).toBe(false);
      });
    });
  });
});
