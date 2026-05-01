const PAYHERO_BANKS = [
  { code: "01", name: "KCB" },
  { code: "02", name: "Standard Chartered Bank KE" },
  { code: "03", name: "Absa Bank" },
  { code: "07", name: "NCBA" },
  { code: "10", name: "Prime Bank" },
  { code: "11", name: "Cooperative Bank" },
  { code: "12", name: "National Bank" },
  { code: "14", name: "M-Oriental" },
  { code: "16", name: "Citibank" },
  { code: "18", name: "Middle East Bank" },
  { code: "19", name: "Bank of Africa" },
  { code: "23", name: "Consolidated Bank" },
  { code: "25", name: "Credit Bank" },
  { code: "31", name: "Stanbic Bank" },
  { code: "35", name: "ABC Bank" },
  { code: "36", name: "Choice Microfinance Bank" },
  { code: "43", name: "Eco Bank" },
  { code: "50", name: "Paramount Universal Bank" },
  { code: "51", name: "Kingdom Bank" },
  { code: "53", name: "Guaranty Bank" },
  { code: "54", name: "Victoria Commercial Bank" },
  { code: "55", name: "Guardian Bank" },
  { code: "57", name: "I&M Bank" },
  { code: "61", name: "HFC Bank" },
  { code: "63", name: "DTB" },
  { code: "65", name: "Mayfair Bank" },
  { code: "66", name: "Sidian Bank" },
  { code: "68", name: "Equity Bank" },
  { code: "70", name: "Family Bank" },
  { code: "72", name: "Gulf African Bank" },
  { code: "74", name: "First Community Bank" },
  { code: "75", name: "DIB Bank" },
  { code: "76", name: "UBA" },
  { code: "78", name: "KWFT Bank" },
  { code: "89", name: "Stima Sacco" },
  { code: "97", name: "Telcom Kenya" },
];

function parseJsonResponse(response, fallbackMessage) {
  return response
    .json()
    .catch(() => {
      throw new Error(fallbackMessage);
    });
}

export function getPayheroBanks() {
  return PAYHERO_BANKS;
}

export function getPayheroBankByCode(code) {
  return PAYHERO_BANKS.find((bank) => bank.code === code) ?? null;
}

export function createPayheroClient(config) {
  return {
    getBankOptions() {
      return PAYHERO_BANKS;
    },

    isConfiguredFor(method) {
      if (!config.basicAuthToken || !config.callbackUrl) {
        return false;
      }

      const channelId = method === "bank" ? config.bankChannelId : config.mobileChannelId;
      return Number.isFinite(channelId) && channelId > 0;
    },

    async createWithdrawal({
      amountKes,
      bankAccountName,
      bankCode,
      bankAccountNumber,
      externalReference,
      method,
      phoneNumber,
    }) {
      const channelId = method === "bank" ? config.bankChannelId : config.mobileChannelId;

      if (!this.isConfiguredFor(method)) {
        throw new Error("PayHero withdrawals are not configured.");
      }

      const payload = {
        amount: amountKes,
        callback_url: config.callbackUrl,
        channel: method === "bank" ? "bank" : "mobile",
        channel_id: channelId,
        external_reference: externalReference,
        network_code: method === "bank" ? bankCode : "63902",
        payment_service: "b2c",
      };

      if (method === "bank") {
        payload.account_number = bankAccountNumber;
        payload.bank_account_name = bankAccountName;
      } else {
        payload.phone_number = phoneNumber;
      }

      const response = await fetch(`${config.baseUrl}/withdraw`, {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Basic ${config.basicAuthToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const json = await parseJsonResponse(response, "Unable to start PayHero withdrawal");
      if (!response.ok) {
        throw new Error("Unable to start PayHero withdrawal");
      }

      return {
        checkoutRequestId: json.checkout_request_id ?? null,
        conversationId: json.conversation_id ?? null,
        merchantReference: json.merchant_reference ?? null,
        raw: json,
        responseCode: json.response_code ?? null,
        status: json.status ?? null,
      };
    },

    async getTransactionStatus(reference) {
      const url = new URL(`${config.baseUrl}/transaction-status`);
      url.searchParams.set("reference", reference);

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${config.basicAuthToken}`,
        },
      });

      const json = await parseJsonResponse(response, "Unable to load PayHero transaction status");
      if (!response.ok) {
        throw new Error("Unable to load PayHero transaction status");
      }

      const payload = json?.transaction_date ? json : json?.data ?? json;
      const status = payload?.status ?? "";

      return {
        raw: json,
        reference: payload?.reference ?? reference,
        status,
        success: status === "SUCCESS",
      };
    },
  };
}
