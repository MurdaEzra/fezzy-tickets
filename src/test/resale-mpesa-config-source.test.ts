import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("resale M-Pesa configuration source guards", () => {
  it("supports explicit M-Pesa base URL config and requires an environment selector otherwise", () => {
    const fn = read("supabase/functions/resale-initiate-purchase/index.ts");

    expect(fn).toContain("function getMpesaBaseUrl()");
    expect(fn).toContain('Deno.env.get("MPESA_BASE_URL")');
    expect(fn).toContain("MPESA_ENV or MPESA_BASE_URL");
    expect(fn).not.toContain('Deno.env.get("MPESA_ENV") ?? "sandbox"');
  });

  it("does not duplicate the generic M-Pesa auth failure message", () => {
    const fn = read("supabase/functions/resale-initiate-purchase/index.ts");

    expect(fn).toContain('getMpesaErrorMessage(tokenData, "Unable to authenticate")');
    expect(fn).not.toContain('getMpesaErrorMessage(tokenData, "M-Pesa auth failed")');
  });
});

