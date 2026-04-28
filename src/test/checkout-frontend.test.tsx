import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Checkout from "../pages/Checkout";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock fetch and toast
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));
vi.mock("../lib/eventsApi", () => ({
  fetchEventBySlug: vi.fn(async (slug) => ({
    id: "evt1",
    title: "Test Event",
    slug: "test-event",
    cover_image_url: "",
    starts_at: new Date().toISOString(),
    venue_name: "Test Venue",
    city: "Test City",
  })),
  fetchTiers: vi.fn(async () => ([{ id: "tier1", name: "VIP", price_kes: 1000 }]))
}));

// Minimal user context mock
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user1", email: "test@example.com", user_metadata: { full_name: "Test User" } } }) }));

// Silence supabase import
vi.mock("../integrations/supabase/client", () => ({}));

describe("Checkout page (frontend)", () => {
  it("renders event and form fields", async () => {
    render(
      <MemoryRouter initialEntries={["/events/test-event/checkout?tier=0&qty=1"]}>
        <Routes>
          <Route path="/events/:slug/checkout" element={<Checkout />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/Test Event/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
  });

  it("shows error if payment flow not implemented", async () => {
    render(
      <MemoryRouter initialEntries={["/events/test-event/checkout?tier=0&qty=1"]}>
        <Routes>
          <Route path="/events/:slug/checkout" element={<Checkout />} />
        </Routes>
      </MemoryRouter>
    );
    const payBtn = await screen.findByRole("button", { name: /pay/i });
    fireEvent.click(payBtn);
    expect(require("sonner").toast.info).toHaveBeenCalledWith("Payment flow not yet implemented. Secure backend required.");
  });
});
