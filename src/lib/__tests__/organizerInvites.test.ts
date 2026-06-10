import { describe, expect, it, vi } from "vitest";
import { createOrganizerAdminInvite } from "../organizerInvites";

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
