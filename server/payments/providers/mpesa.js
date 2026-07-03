function timestampString(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${now.getUTCDate()}`.padStart(2, "0");
  const hour = `${now.getUTCHours()}`.padStart(2, "0");
  const minute = `${now.getUTCMinutes()}`.padStart(2, "0");
  const second = `${now.getUTCSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function normalizeKenyaPhoneNumber(phone) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  throw new Error("Enter a valid Kenyan phone number");
}

export function buildStkPushPayload({
  accountReference,
  amountKes,
  callbackUrl,
  config,
  phone,
  transactionDesc,
}) {
  const timestamp = timestampString();
  const password = Buffer.from(`${config.shortCode}${config.passkey}${timestamp}`).toString("base64");

  return {
    AccountReference: accountReference,
    Amount: amountKes,
    BusinessShortCode: config.shortCode,
    CallBackURL: callbackUrl,
    PartyA: phone,
    PartyB: config.shortCode,
    Password: password,
    PhoneNumber: phone,
    Timestamp: timestamp,
    TransactionDesc: transactionDesc,
    TransactionType: config.transactionType,
  };
}

export function parseMpesaCallback(payload) {
  const callback = payload?.Body?.stkCallback;
  const metadataItems = callback?.CallbackMetadata?.Item ?? [];
  const metadata = Object.fromEntries(
    metadataItems.map((item) => [item.Name, item.Value]),
  );

  return {
    amountKes: Number(metadata.Amount ?? 0),
    checkoutRequestId: callback?.CheckoutRequestID ?? null,
    merchantRequestId: callback?.MerchantRequestID ?? null,
    mpesaReceiptNumber: metadata.MpesaReceiptNumber ?? null,
    phoneNumber: metadata.PhoneNumber ? String(metadata.PhoneNumber) : null,
    resultCode: Number(callback?.ResultCode ?? -1),
    resultDesc: callback?.ResultDesc ?? "Unknown result",
  };
}

export function createMpesaClient(config) {
  return {
    async getAccessToken() {
      console.log("[M-Pesa] Getting access token");
      try {
        const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`,
          },
        });

        const json = await response.json();
        console.log("[M-Pesa] Access token response:", json);
        if (!response.ok || !json?.access_token) {
          throw new Error("Unable to authenticate with M-Pesa");
        }

        return json.access_token;
      } catch (err) {
        console.error("[M-Pesa] Failed to get access token:", err);
        throw err;
      }
    },

    async initiateStkPush({
      accountReference,
      amountKes,
      callbackUrl,
      phone,
      transactionDesc,
    }) {
      console.log("[M-Pesa] Initiating STK push with params:", { accountReference, amountKes, callbackUrl, phone, transactionDesc });
      try {
        const accessToken = await this.getAccessToken();
        console.log("[M-Pesa] Got access token");
        const payload = buildStkPushPayload({
          accountReference,
          amountKes,
          callbackUrl,
          config,
          phone,
          transactionDesc,
        });
        console.log("[M-Pesa] STK push payload:", payload);

        const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
          body: JSON.stringify(payload),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        const json = await response.json();
        console.log("[M-Pesa] STK push response:", json, "status:", response.status);
        if (!response.ok) {
          throw new Error(`Unable to start M-Pesa payment: ${json.errorMessage || json.ResponseDescription || 'Unknown error'}`);
        }

        return {
          checkoutRequestId: json.CheckoutRequestID ?? null,
          customerMessage: json.CustomerMessage ?? "Check your phone to authorize the M-Pesa payment.",
          merchantRequestId: json.MerchantRequestID ?? null,
          raw: json,
        };
      } catch (err) {
        console.error("[M-Pesa] STK push failed:", err);
        throw err;
      }
    },
  };
}
