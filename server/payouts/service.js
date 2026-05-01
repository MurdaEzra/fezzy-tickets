import { randomBytes } from "node:crypto";
import { getPayheroBankByCode } from "./payhero.js";
import { normalizeKenyaPhoneNumber } from "../payments/providers/mpesa.js";

const RESERVED_PAYOUT_STATUSES = new Set(["created", "queued", "processing", "paid"]);

function randomReference(size = 10) {
  return randomBytes(size).toString("hex");
}

export function normalizePayoutPhoneNumber(phone) {
  return normalizeKenyaPhoneNumber(phone);
}

export function normalizeBankAccountNumber(value) {
  const trimmed = value.replace(/\s+/g, "").trim();
  if (!/^[a-zA-Z0-9]{6,32}$/.test(trimmed)) {
    throw new Error("Enter a valid bank account number.");
  }

  return trimmed;
}

export function calculateAvailablePayoutAmount({ orders, payoutRequests }) {
  const netRevenue = orders.reduce((sum, order) => sum + Math.max(0, order.total_kes - order.organizer_fee_kes), 0);
  const reservedAmount = payoutRequests.reduce((sum, request) => (
    RESERVED_PAYOUT_STATUSES.has(request.status) ? sum + request.amount_kes : sum
  ), 0);

  return Math.max(0, netRevenue - reservedAmount);
}

export function createPayoutRequestRecord({
  amountKes,
  method,
  organizerProfile,
  requestedByUserId,
}) {
  const record = {
    amount_kes: amountKes,
    destination_bank_account_name: null,
    destination_bank_account_number: null,
    destination_bank_name: null,
    destination_bank_network_code: null,
    destination_phone: null,
    external_reference: `payout_${randomReference(8)}`,
    organizer_profile_id: organizerProfile.id,
    payout_method: method,
    provider: "payhero",
    requested_by_user_id: requestedByUserId,
    status: "created",
  };

  if (method === "bank") {
    const bank = getPayheroBankByCode(organizerProfile.payout_bank_network_code ?? "");
    if (!bank) {
      throw new Error("Bank payout details are incomplete.");
    }

    record.destination_bank_account_name = organizerProfile.payout_bank_account_name;
    record.destination_bank_account_number = normalizeBankAccountNumber(organizerProfile.payout_bank_account_number ?? "");
    record.destination_bank_name = bank.name;
    record.destination_bank_network_code = bank.code;
    return record;
  }

  record.destination_phone = normalizePayoutPhoneNumber(
    organizerProfile.payout_phone ?? organizerProfile.contact_phone ?? "",
  );
  return record;
}

export function parsePayheroWithdrawalCallback(payload) {
  const response = payload?.response ?? {};

  return {
    amountKes: Number(response.Amount ?? 0),
    checkoutRequestId: response.CheckoutRequestID ?? null,
    externalReference: response.ExternalReference ?? null,
    merchantRequestId: response.MerchantRequestID ?? null,
    recipientAccountNumber: response.RecipientAccountNumber ? String(response.RecipientAccountNumber) : null,
    resultCode: Number(response.ResultCode ?? -1),
    resultDesc: response.ResultDesc ?? "Unknown result",
    status: response.Status ?? null,
    transactionId: response.TransactionID ?? null,
  };
}
