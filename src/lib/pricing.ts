export const PLATFORM_FEE_RATE = 0.10;
export const PLATFORM_FEE_PCT = 10;
export const PLATFORM_FEE_LABEL = "Platform fee";

export const BUYER_FEE_RATE = 0.035;
export const BUYER_FEE_PCT = 3.5;
export const BUYER_FEE_LABEL = "Buyer service fee";

export function calculatePlatformFee(subtotalKes: number, feeWaived = false) {
  if (feeWaived) return 0;
  return Math.round(subtotalKes * PLATFORM_FEE_RATE);
}

export function calculateBuyerFee(subtotalKes: number) {
  return Math.round(subtotalKes * BUYER_FEE_RATE);
}

export function calculateBuyerTotal(subtotalKes: number) {
  return subtotalKes + calculateBuyerFee(subtotalKes);
}

export function isEventDue(startsAt: string, now = new Date()) {
  return new Date(startsAt).getTime() <= now.getTime();
}
