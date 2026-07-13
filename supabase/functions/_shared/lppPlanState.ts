export type LppInitPayload = {
  eventId: string;
  tierId: string;
  quantity: number;
  planKey: string;
  name: string;
  email: string;
  phone: string;
  holders?: Array<{ name: string; email: string; phone: string }>;
};

function encodeBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64url");
  }
  if (typeof btoa === "function") {
    return btoa(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, p1) => String.fromCharCode(Number.parseInt(p1, 16))));
  }
  throw new Error("Base64 encoding is not available");
}

function decodeBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64url").toString("utf8");
  }
  if (typeof atob === "function") {
    const binary = atob(value);
    return decodeURIComponent(binary.split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  }
  throw new Error("Base64 decoding is not available");
}

export function encodeLppInitPayload(payload: LppInitPayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeLppInitPayload(state: string | null | undefined): LppInitPayload | null {
  if (!state) return null;
  try {
    return JSON.parse(decodeBase64Url(state)) as LppInitPayload;
  } catch {
    return null;
  }
}

export function buildLppCallbackUrl(baseUrl: string, refNo: string, payload: LppInitPayload): string {
  const url = new URL(baseUrl);
  url.searchParams.set("ref", refNo);
  url.searchParams.set("seq", "0");
  url.searchParams.set("state", encodeLppInitPayload(payload));
  return url.toString();
}
