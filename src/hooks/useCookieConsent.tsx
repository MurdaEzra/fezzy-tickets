import { createContext, useContext, useEffect, useState } from "react";

// Cookie categories
export type CookieConsentCategories = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_CONSENT: CookieConsentCategories = {
  necessary: true,
  analytics: false,
  marketing: false,
};

// Storage key
const CONSENT_KEY = "fezzy_cookie_consent";

interface CookieConsentContextType {
  consent: CookieConsentCategories;
  hasConsented: boolean;
  acceptAll: () => void;
  rejectNonNecessary: () => void;
  updateConsent: (categories: Partial<CookieConsentCategories>) => void;
  resetConsent: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const CookieConsentProvider = ({ children }: { children: React.ReactNode }) => {
  const [consent, setConsent] = useState<CookieConsentCategories>(DEFAULT_CONSENT);
  const [hasConsented, setHasConsented] = useState<boolean>(false);

  // Load consent from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConsent({ ...DEFAULT_CONSENT, ...parsed });
        setHasConsented(true);
      } catch {
        // Invalid JSON, reset to default
        setHasConsented(false);
      }
    }
  }, []);

  // Save consent to storage
  const saveConsent = (newConsent: CookieConsentCategories) => {
    setConsent(newConsent);
    localStorage.setItem(CONSENT_KEY, JSON.stringify(newConsent));
    setHasConsented(true);
  };

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true });
  };

  const rejectNonNecessary = () => {
    saveConsent(DEFAULT_CONSENT);
  };

  const updateConsent = (categories: Partial<CookieConsentCategories>) => {
    saveConsent({ ...consent, ...categories });
  };

  const resetConsent = () => {
    localStorage.removeItem(CONSENT_KEY);
    setConsent(DEFAULT_CONSENT);
    setHasConsented(false);
  };

  return (
    <CookieConsentContext.Provider
      value={{ consent, hasConsented, acceptAll, rejectNonNecessary, updateConsent, resetConsent }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
};
