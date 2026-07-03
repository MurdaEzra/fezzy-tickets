// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "info" | "warn" | "error";

export async function logActivity(
  action: string,
  opts: {
    level?: LogLevel;
    message?: string;
    metadata?: Record<string, unknown>;
    userId?: string | null;
  } = {},
) {
  try {
    await supabase.from("platform_logs").insert({
      action,
      level: opts.level ?? "info",
      message: opts.message ?? null,
      metadata: (opts.metadata ?? {}) as never,
      user_id: opts.userId ?? undefined,
    });
  } catch {
    // Logging must never break user flows.
  }
}

export function installGlobalErrorLogging(userId?: string | null) {
  if ((window as Window & { __fezzyLogsInstalled?: boolean }).__fezzyLogsInstalled) return;
  (window as Window & { __fezzyLogsInstalled?: boolean }).__fezzyLogsInstalled = true;

  const report = (action: string, message: string, metadata?: Record<string, unknown>) => {
    void logActivity(action, { level: "error", message, metadata, userId });
  };

  window.addEventListener("error", (event) => {
    report("client.error", event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report(
      "client.unhandled_rejection",
      reason instanceof Error ? reason.message : String(reason),
      { stack: reason instanceof Error ? reason.stack : undefined },
    );
  });
}
