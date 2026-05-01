import { createHmac, timingSafeEqual } from "node:crypto";

export function signWithHmacSha256({ payload, secret }) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function constantTimeHexEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
