import { PublicHttpError } from "../http/errors.js";

const ALLOWED_HEADERS = "content-type, authorization";
const ALLOWED_METHODS = "GET,POST,OPTIONS";

export function assertAllowedBrowserOrigin(origin, allowedOrigins) {
  console.log(`[CORS] Checking origin: ${origin}, allowed:`, allowedOrigins);

  // Null/missing origin: same-origin request, redirect, or privacy-stripped.
  // Allow these through; CORS response headers are only added when origin is present.
  if (!origin) {
    return null;
  }

  if (!allowedOrigins.includes(origin)) {
    console.warn(`[CORS] Rejecting origin: ${origin}`);
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
