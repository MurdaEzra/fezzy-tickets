import { PublicHttpError } from "../http/errors.js";

const ALLOWED_HEADERS = "content-type, authorization";
const ALLOWED_METHODS = "GET,POST,OPTIONS";

export function assertAllowedBrowserOrigin(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) {
    throw new PublicHttpError(403, "origin_not_allowed", "This request is not allowed.");
  }

  return origin;
}

export function createBrowserCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}
