import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "../safeJson";

describe("parseJsonResponse", () => {
  it("returns null for empty bodies", async () => {
    const response = new Response("", { status: 502 });

    await expect(parseJsonResponse(response)).resolves.toEqual(null);
  });

  it("parses valid JSON payloads", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parseJsonResponse(response)).resolves.toEqual({ ok: true });
  });

  it("returns a fallback error payload for invalid JSON", async () => {
    const response = new Response("not-json", { status: 502 });

    await expect(parseJsonResponse(response)).resolves.toEqual({
      error: "The server returned an empty or invalid response.",
    });
  });
});
