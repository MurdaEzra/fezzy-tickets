import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("LPP workflow source guards", () => {
  it("uses a dedicated deposit STK phone from checkout", () => {
    const checkout = read("src/pages/Checkout.tsx");
    const lppClient = read("src/lib/lpp.ts");
    const initPlan = read("supabase/functions/lpp-init-plan/index.ts");

    expect(checkout).toContain("lppDepositPhone");
    expect(checkout).toContain("depositPhone: lppDepositPhone.trim()");
    expect(lppClient).toContain("depositPhone: string");
    expect(initPlan).toContain("depositPhone");
    expect(initPlan).toContain("phone: normalizedDepositPhone");
  });

  it("does not create an LPP plan until the deposit callback succeeds", () => {
    const initPlan = read("supabase/functions/lpp-init-plan/index.ts");
    const callback = read("supabase/functions/lpp-mpesa-callback/index.ts");

    expect(initPlan).toContain("plan: null");
    expect(initPlan).not.toContain('admin.from("payment_plans").insert');
    expect(callback).toContain("if (!plan) {");
    expect(callback).toContain("resultCode !== 0 || seq !== 0 || !initPayload");
    expect(callback).toContain('status: "reserved"');
  });

  it("only pays installments after a plan exists", () => {
    const payInstallment = read("supabase/functions/lpp-pay-installment/index.ts");

    expect(payInstallment).toContain('admin.from("payment_plans").select("*").eq("ref_no", refNo).maybeSingle()');
    expect(payInstallment).toContain('if (!plan) return json({ error: "No plan found for that ref no." }, 404)');
    expect(payInstallment).toContain('.eq("status", "pending")');
  });

  it("links final ticket issuance to the LPP plan so callbacks are idempotent", () => {
    const callback = read("supabase/functions/lpp-mpesa-callback/index.ts");
    const migration = read("supabase/migrations/20260720110000_lpp_order_id_and_admin_role_cleanup.sql");

    expect(callback).toContain("if (isFinal && plan.order_id)");
    expect(callback).toContain("order_id: order.id");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS order_id uuid");
  });

  it("normalizes app-level role checks to admin instead of super_admin", () => {
    const navbar = read("src/components/Navbar.tsx");
    const adminPage = read("src/pages/SuperAdminDashboard.tsx");
    const resaleAdminAction = read("supabase/functions/resale-admin-action/index.ts");
    const migration = read("supabase/migrations/20260720110000_lpp_order_id_and_admin_role_cleanup.sql");
    const types = read("src/integrations/supabase/types.ts");

    expect(navbar).not.toContain("super_admin");
    expect(adminPage).not.toContain("super_admin");
    expect(adminPage).not.toContain("Super admin");
    expect(resaleAdminAction).not.toContain("super_admin");
    expect(migration).toContain("role = 'super_admin'");
    expect(migration).toContain("role = 'admin'");
    expect(types).toContain('app_role: "admin" | "organizer" | "attendee"');
    expect(types).not.toContain('"super_admin"');
  });
});

