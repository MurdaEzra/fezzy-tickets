import { describe, expect, it } from "vitest";
import {
  calculateAvailablePayoutAmount,
  createPayoutRequestRecord,
  normalizeBankAccountNumber,
} from "./service.js";

describe("payout service", () => {
  it("calculates available payout after reserving existing payout requests", () => {
    const available = calculateAvailablePayoutAmount({
      orders: [
        { organizer_fee_kes: 250, total_kes: 2500 },
        { organizer_fee_kes: 500, total_kes: 5000 },
      ],
      payoutRequests: [
        { amount_kes: 2000, status: "queued" },
        { amount_kes: 500, status: "failed" },
      ],
    });

    expect(available).toBe(4750);
  });

  it("builds a bank payout request record from organizer settings", () => {
    const record = createPayoutRequestRecord({
      amountKes: 3500,
      method: "bank",
      organizerProfile: {
        id: "org-1",
        payout_bank_account_name: "Fezzy Events",
        payout_bank_account_number: "00123456789",
        payout_bank_network_code: "68",
      },
      requestedByUserId: "user-1",
    });

    expect(record.destination_bank_name).toBe("Equity Bank");
    expect(record.destination_bank_network_code).toBe("68");
    expect(record.destination_bank_account_number).toBe("00123456789");
  });

  it("rejects invalid bank account numbers", () => {
    expect(() => normalizeBankAccountNumber("12")).toThrow(/valid bank account/i);
  });
});
