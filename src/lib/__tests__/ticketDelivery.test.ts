import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentStore } from "../../../server/payments/store.js";

describe("createPaymentStore ticket delivery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to direct Brevo delivery when the edge function fails", async () => {
    const order = {
      id: "order_123",
      guest_email: "buyer@example.com",
      events: {
        title: "Launch Night",
        starts_at: "2026-06-20T18:00:00.000Z",
        venue_name: "Main Hall",
        city: "Nairobi",
        ticket_design: { accent: "#123456" },
      },
      tickets: [
        {
          qr_token: "qr-token",
          holder_name: "Jane Doe",
          ticket_tiers: { name: "VIP" },
        },
      ],
    };

    const from = vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: order, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const functions = {
      invoke: vi.fn().mockRejectedValue(new Error("edge function unavailable")),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "sent" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const store = createPaymentStore(
      { from, functions } as never,
      { ticketDeliverySecret: "secret", brevoApiKey: "test-key" },
    );

    await expect(store.sendTicketDelivery("order_123")).resolves.toBeUndefined();

    expect(functions.invoke).toHaveBeenCalledWith("send-ticket-email", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "api-key": "test-key" }),
    }));
  });
});
