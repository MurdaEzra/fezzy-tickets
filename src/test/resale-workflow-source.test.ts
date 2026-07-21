import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("resale workflow source guards", () => {
  it("requires seller payout phone before creating a resale listing", () => {
    const fn = read("supabase/functions/resale-initiate-listing/index.ts");

    expect(fn).toContain("sellerPayoutPhone");
    expect(fn).toContain("seller_payout_phone");
    expect(fn).toContain("normalizeKenyanPhone");
  });

  it("routes B2C payout results away from the buyer STK callback", () => {
    const adminAction = read("supabase/functions/resale-admin-action/index.ts");

    expect(adminAction).toContain("resale-b2c-result-callback");
    expect(adminAction).not.toContain("ResultURL: `${supabaseUrl}/functions/v1/resale-mpesa-callback`");
  });

  it("does not mark a seller payout paid immediately after initiating B2C", () => {
    const adminAction = read("supabase/functions/resale-admin-action/index.ts");

    expect(adminAction).toContain('payout_status: "processing"');
    expect(adminAction).not.toContain('update({ payout_status: "paid" })');
  });

  it("keeps resale approval service-role gated while validating the acting admin", () => {
    const adminAction = read("supabase/functions/resale-admin-action/index.ts");
    const migration = read("supabase/migrations/20260720090000_harden_resale_payout_workflow.sql");

    expect(adminAction).toContain("_admin_user_id: userRes.user.id");
    expect(migration).toContain("IF NOT public.has_role(_admin_user_id, 'admin')");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.approve_resale_transfer(uuid, uuid, text) TO service_role");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.approve_resale_transfer(uuid, uuid, text) TO authenticated");
  });

  it("allows unauthenticated browser polling for resale check status preflight", () => {
    const config = read("supabase/config.toml");
    const marketplace = read("src/pages/ResaleMarketplace.tsx");

    expect(marketplace).toContain("/functions/v1/resale-check-status");
    expect(marketplace).toContain("headers: { \"Content-Type\": \"application/json\" }");
    expect(config).toContain("[functions.resale-check-status]");
    expect(config).toContain("verify_jwt = false");
  });

  it("rolls back the listing when callback finalization fails", () => {
    const callback = read("supabase/functions/resale-mpesa-callback/index.ts");

    expect(callback).toContain("complete_resale_transfer");
    expect(callback).toContain("status: \"active\"");
    expect(callback).toContain("buyer_user_id: null");
    expect(callback).toContain("payment_ref: null");
  });
});
