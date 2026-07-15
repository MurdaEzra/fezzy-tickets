import { describe, expect, it } from "vitest";
import { getTicketStatusDisplay } from "../eventsApi";

describe("getTicketStatusDisplay", () => {
  it("returns a red invalid badge for invalid tickets", () => {
    expect(getTicketStatusDisplay("invalid")).toEqual({
      label: "Invalid",
      className: "bg-destructive/15 text-destructive",
    });
  });

  it("returns a green valid badge for valid tickets", () => {
    expect(getTicketStatusDisplay("valid")).toEqual({
      label: "Valid",
      className: "bg-primary/15 text-primary",
    });
  });

  it("falls back to a title-cased label for unknown states", () => {
    expect(getTicketStatusDisplay("pending_verification")).toEqual({
      label: "Pending Verification",
      className: "bg-secondary text-muted-foreground",
    });
  });
});
