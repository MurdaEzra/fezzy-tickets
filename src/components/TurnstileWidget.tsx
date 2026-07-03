import { useEffect, useRef, useState, useCallback } from "react";

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
          "error-callback"?: (errorCode?: string) => void;
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
  onError?: (errorCode?: string) => void;
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
  const [hasError, setHasError] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const renderWidget = useCallback(() => {
    if (!scriptLoaded || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      // Reset existing widget instead of rendering new one
      window.turnstile.reset(widgetIdRef.current);
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => {
        setHasError(false);
        onVerify?.(token);
      },
      "expired-callback": () => {
        onExpire?.();
      },
      "error-callback": (errorCode) => {
        setHasError(true);
        onError?.(errorCode);
      },
    });
  }, [scriptLoaded, siteKey, action, onVerify, onExpire, onError]);

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
    renderWidget();
  }, [renderWidget]);

  useEffect(() => {
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      {hasError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Unable to load security check. Please check your internet connection and try again.
        </div>
      )}
    </div>
  );
}
