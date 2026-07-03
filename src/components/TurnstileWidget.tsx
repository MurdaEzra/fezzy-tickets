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
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onVerify, onExpire, onError]);

  const clearChallengeTimeout = useCallback(() => {
    if (challengeTimeoutRef.current) {
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = null;
    }
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey) {
      setHasError(true);
      return;
    }
    if (!scriptLoaded || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

    clearChallengeTimeout();
    challengeTimeoutRef.current = setTimeout(() => {
      setHasError(true);
      onExpireRef.current?.();
      onErrorRef.current?.("challenge-timeout");
    }, 30000);

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => {
        clearChallengeTimeout();
        setHasError(false);
        onVerifyRef.current?.(token);
      },
      "expired-callback": () => {
        clearChallengeTimeout();
        onExpireRef.current?.();
      },
      "error-callback": (errorCode) => {
        clearChallengeTimeout();
        setHasError(true);
        onExpireRef.current?.();
        onErrorRef.current?.(errorCode);
      },
    });
  }, [scriptLoaded, siteKey, action, clearChallengeTimeout]);

  const handleRetry = () => {
    clearChallengeTimeout();
    onExpireRef.current?.();
    setHasError(false);

    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    setScriptLoaded(Boolean(window.turnstile));
    setRetryCount((count) => count + 1);
  };

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
        if (scriptTimeoutRef.current) {
          clearTimeout(scriptTimeoutRef.current);
          scriptTimeoutRef.current = null;
        }
      }
    }, 100); // Check every 100ms

    scriptTimeoutRef.current = setTimeout(() => {
      if (!window.turnstile) {
        setHasError(true);
        onErrorRef.current?.("script-load-timeout");
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 10000);

    // Clean up poll interval
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (scriptTimeoutRef.current) {
        clearTimeout(scriptTimeoutRef.current);
        scriptTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    renderWidget();
  }, [renderWidget, retryCount]);

  useEffect(() => {
    return () => {
      clearChallengeTimeout();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, clearChallengeTimeout]);

  return (
    <div>
      <div ref={containerRef} />
      {hasError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p>Unable to load security check. Please check your internet connection and try again.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 font-semibold underline underline-offset-2"
          >
            Retry security check
          </button>
        </div>
      )}
    </div>
  );
}
