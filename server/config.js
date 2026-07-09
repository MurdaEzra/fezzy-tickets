import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function splitCsv(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvFile(filePath) {
  const parsed = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadFileEnv(env) {
  const fromFiles = {};

  for (const name of [".env", ".env.local"]) {
    const filePath = path.join(ROOT_DIR, name);
    if (existsSync(filePath)) {
      Object.assign(fromFiles, parseEnvFile(filePath));
    }
  }

  return {
    ...fromFiles,
    ...env,
  };
}

export function loadConfig(env = process.env) {
  const resolvedEnv = env === process.env ? loadFileEnv(env) : env;
  const port = numberFromEnv(resolvedEnv.PORT, 3001);
  const renderApiBaseUrl = resolvedEnv.RENDER_API_BASE_URL ?? `http://localhost:${port}`;

  return {
    allowedBrowserOrigins: splitCsv(resolvedEnv.ALLOWED_BROWSER_ORIGINS ?? "https://fezzytickets.com"),
    enabledPaymentMethods: splitCsv(resolvedEnv.ENABLED_PAYMENT_METHODS ?? "mpesa,card"),
    mpesa: {
      baseUrl: resolvedEnv.MPESA_BASE_URL ?? "https://sandbox.safaricom.co.ke",
      callbackUrl: resolvedEnv.MPESA_CALLBACK_URL ?? `${renderApiBaseUrl}/api/webhooks/mpesa`,
      consumerKey: resolvedEnv.MPESA_CONSUMER_KEY ?? "",
      consumerSecret: resolvedEnv.MPESA_CONSUMER_SECRET ?? "",
      passkey: resolvedEnv.MPESA_PASSKEY ?? "",
      shortCode: resolvedEnv.MPESA_SHORT_CODE ?? "",
      transactionType: resolvedEnv.MPESA_TRANSACTION_TYPE ?? "CustomerPayBillOnline",
    },
    passwordResetRedirectUrl: resolvedEnv.PASSWORD_RESET_REDIRECT_URL ?? `${resolvedEnv.PUBLIC_WEB_BASE_URL ?? "http://localhost:8080"}/auth`,
    port,
    publicWebBaseUrl: resolvedEnv.PUBLIC_WEB_BASE_URL ?? "http://localhost:8080",
    rateLimits: {
      checkoutCreate: {
        capacity: numberFromEnv(resolvedEnv.RATE_LIMIT_CHECKOUT_CAPACITY, 10),
        refillPerSecond: numberFromEnv(resolvedEnv.RATE_LIMIT_CHECKOUT_REFILL_PER_SECOND, 0.1),
      },
      checkoutPoll: {
        capacity: numberFromEnv(resolvedEnv.RATE_LIMIT_POLL_CAPACITY, 30),
        refillPerSecond: numberFromEnv(resolvedEnv.RATE_LIMIT_POLL_REFILL_PER_SECOND, 1),
      },
      passwordReset: {
        capacity: numberFromEnv(resolvedEnv.RATE_LIMIT_RESET_CAPACITY, 5),
        refillPerSecond: numberFromEnv(resolvedEnv.RATE_LIMIT_RESET_REFILL_PER_SECOND, 0.02),
      },
      paymentStart: {
        capacity: numberFromEnv(resolvedEnv.RATE_LIMIT_PAYMENT_CAPACITY, 6),
        refillPerSecond: numberFromEnv(resolvedEnv.RATE_LIMIT_PAYMENT_REFILL_PER_SECOND, 0.05),
      },
    },
    redirectStateSecret: resolvedEnv.REDIRECT_STATE_SECRET ?? "dev-only-redirect-secret",
    renderApiBaseUrl,
    supabase: {
      serviceRoleKey: resolvedEnv.SUPABASE_SERVICE_ROLE_KEY ?? "",
      url: resolvedEnv.SUPABASE_URL ?? "",
    },
    brevoApiKey: resolvedEnv.BREVO_API_KEY ?? "",
    ticketDeliverySecret: resolvedEnv.INTERNAL_TICKET_DELIVERY_SECRET ?? "dev-only-ticket-secret",
  };
}
