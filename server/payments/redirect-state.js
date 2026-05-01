import { constantTimeHexEqual, signWithHmacSha256 } from "../security/signing.js";

const DELIMITER = ".";

export function signRedirectState({ attemptId, checkoutToken, secret }) {
  const payload = `${attemptId}${DELIMITER}${checkoutToken}`;
  const signature = signWithHmacSha256({
    payload,
    secret,
  });

  return `${payload}${DELIMITER}${signature}`;
}

export function verifyRedirectState({ token, secret }) {
  const pieces = token.split(DELIMITER);
  if (pieces.length !== 3) {
    throw new Error("Invalid redirect state");
  }

  const [attemptId, checkoutToken, signature] = pieces;
  const payload = `${attemptId}${DELIMITER}${checkoutToken}`;
  const expectedSignature = signWithHmacSha256({
    payload,
    secret,
  });

  if (!constantTimeHexEqual(signature, expectedSignature)) {
    throw new Error("Invalid redirect state");
  }

  return {
    attemptId,
    checkoutToken,
  };
}
