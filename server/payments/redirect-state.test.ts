import { describe, expect, it } from "vitest";
import { signRedirectState, verifyRedirectState } from "./redirect-state.js";

describe("redirect state", () => {
  it("round-trips a signed state token", () => {
    const token = signRedirectState({
      attemptId: "attempt-1",
      checkoutToken: "checkout-token",
      secret: "super-secret",
    });

    expect(
      verifyRedirectState({
        token,
        secret: "super-secret",
      }),
    ).toEqual({
      attemptId: "attempt-1",
      checkoutToken: "checkout-token",
    });
  });

  it("rejects tampered tokens", () => {
    const token = signRedirectState({
      attemptId: "attempt-1",
      checkoutToken: "checkout-token",
      secret: "super-secret",
    });

    expect(() =>
      verifyRedirectState({
        token: `${token}x`,
        secret: "super-secret",
      }),
    ).toThrow(/invalid redirect state/i);
  });
});
