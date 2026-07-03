import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onVerify?: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export default function TurnstileWidget({
  siteKey,
  action = "turnstile-spin-v1",
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check immediately if Turnstile is already available
    if (window.turnstile) {
      setScriptLoaded(true);
      return;
    }

    // Poll for Turnstile availability
    pollIntervalRef.current = setInterval(() => {
      if (window.turnstile) {
        setScriptLoaded(true);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 100); // Check every 100ms

    // Clean up poll interval
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) return; // Prevent double rendering

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => {
        onVerify?.(token);
      },
      "expired-callback": () => {
        onExpire?.();
      },
      "error-callback": () => {
        onError?.();
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, siteKey, action, onVerify, onExpire, onError]);

  return <div ref={containerRef} />;
}
