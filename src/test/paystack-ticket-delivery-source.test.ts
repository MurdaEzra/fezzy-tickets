import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Paystack ticket delivery source guard", () => {
  it("delegates paid order ticket delivery to the canonical send-ticket-email function", () => {
    const paystackVerify = read("supabase/functions/paystack-verify/index.ts");

    expect(paystackVerify).toContain('admin.functions.invoke("send-ticket-email"');
    expect(paystackVerify).toContain("x-internal-ticket-secret");
    expect(paystackVerify).not.toContain("async function sendBrevoEmail");
    expect(paystackVerify).not.toContain("async function sendBrevoSMS");
    expect(paystackVerify).not.toContain("renderEmailHtml");
    expect(paystackVerify).not.toContain("Your tickets are ready.");
  });
});

