import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Checkout from "../pages/Checkout";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

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
  fetchTiers: vi.fn(async () => ([{ id: "tier1", name: "VIP", price_kes: 1000 }])),
  formatEventDateLong: vi.fn(() => "Monday, 1 June 2026"),
  formatPrice: vi.fn((value: number) => `KES ${value}`),
}));

// Minimal user context mock
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user1", email: "test@example.com", user_metadata: { full_name: "Test User" } } }) }));

// Cookie consent mock
vi.mock("../hooks/useCookieConsent", () => ({
  useCookieConsent: () => ({
    consent: { necessary: true, analytics: false, marketing: false },
    hasConsented: true,
    showManage: false,
    setShowManage: vi.fn(),
    acceptAll: vi.fn(),
    rejectNonNecessary: vi.fn(),
    updateConsent: vi.fn(),
    resetConsent: vi.fn(),
  }),
}));

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    functions: {
      invoke: invokeMock,
    },
  },
}));

describe("Checkout page (frontend)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (name: string) => {
      if (name === "calculate-order") {
        return { data: { subtotal: 1000, fee: 35, total: 1035, feePct: 3.5 }, error: null };
      }
      return { data: { error: "Payment unavailable" }, error: null };
    });
  });

  it("renders event and form fields", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/events/test-event/checkout?tier=0&qty=1"]}>
          <Routes>
            <Route path="/events/:slug/checkout" element={<Checkout />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Test Event/)).toBeInTheDocument();
    expect(await screen.findByText("KES 35")).toBeInTheDocument();
    expect(screen.getByText("KES 1035")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/M-Pesa phone/)).toBeInTheDocument();
  });

  it("shows an error when M-Pesa checkout fails", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/events/test-event/checkout?tier=0&qty=1"]}>
          <Routes>
            <Route path="/events/:slug/checkout" element={<Checkout />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const payBtn = await screen.findByRole("button", { name: /pay/i });
    fireEvent.change(screen.getByLabelText(/M-Pesa phone/), { target: { value: "0712345678" } });
    fireEvent.click(payBtn);
    const { toast } = await import("sonner");
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Payment failed", { description: "Payment unavailable" });
    });
  });
});
