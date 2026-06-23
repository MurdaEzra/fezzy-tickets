import { describe, expect, it, vi } from "vitest";
import { acceptOrganizerAdminInvite, createOrganizerAdminInvite } from "../organizerInvites";

describe("createOrganizerAdminInvite", () => {
  it("uses the organizer invite RPC instead of a direct table insert", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ token: "abc123", expires_at: "2026-06-17T00:00:00.000Z" }], error: null });

    await createOrganizerAdminInvite({ rpc } as never, "org_123", "  teammate@example.com  ");

    expect(rpc).toHaveBeenCalledWith("create_organizer_admin_invite", {
      _organizer_id: "org_123",
      _invited_email: "teammate@example.com",
      _expires_in_hours: 168,
    });
  });
});

describe("acceptOrganizerAdminInvite", () => {
  it("uses the accept organizer invite RPC instead of a direct table insert", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "org_123", error: null });

    await acceptOrganizerAdminInvite({ rpc } as never, "invite_token_123");

    expect(rpc).toHaveBeenCalledWith("accept_organizer_admin_invite", {
      _token: "invite_token_123",
    });
  });
});
