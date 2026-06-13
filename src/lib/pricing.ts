export const BUYER_FEE_RATE = 0.035;
export const BUYER_FEE_LABEL = "Buyer service fee";

export function calculateBuyerFee(subtotalKes: number) {
  return Math.round(subtotalKes * BUYER_FEE_RATE);
}

export function calculateBuyerTotal(subtotalKes: number) {
  return subtotalKes + calculateBuyerFee(subtotalKes);
}

export function isEventDue(startsAt: string, now = new Date()) {
  return new Date(startsAt).getTime() <= now.getTime();
}
