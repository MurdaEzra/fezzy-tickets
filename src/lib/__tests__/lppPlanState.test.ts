import { describe, expect, it } from "vitest";
import { buildLppCallbackUrl, decodeLppInitPayload, encodeLppInitPayload } from "../../../supabase/functions/_shared/lppPlanState.ts";

describe("LPP plan state", () => {
  it("round-trips the init payload for the deposit callback", () => {
    const payload = {
      eventId: "evt_123",
      tierId: "tier_123",
      quantity: 2,
      planKey: "basic",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "0712345678",
      holders: [{ name: "Jane Doe", email: "jane@example.com", phone: "0712345678" }],
    };

    const encoded = encodeLppInitPayload(payload);
    const decoded = decodeLppInitPayload(encoded);
    const callbackUrl = buildLppCallbackUrl("https://example.com/functions/v1/lpp-mpesa-callback", "FZABC1234", payload);

    expect(decoded).toEqual(payload);
    expect(callbackUrl).toContain("state=");
    expect(callbackUrl).toContain("ref=FZABC1234");
  });
});
