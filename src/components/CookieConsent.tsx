import { useState } from "react";
import { X, Settings, Shield, BarChart3, Megaphone } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export const CookieConsent = () => {
  const {
    consent,
    hasConsented,
    showManage,
    setShowManage,
    acceptAll,
    rejectNonNecessary,
    updateConsent,
    resetConsent,
  } = useCookieConsent();
  const [dismissed, setDismissed] = useState(false);

  // If user has consented or dismissed, only show the sheet when triggered
  if (hasConsented || dismissed) {
    return (
      <Sheet open={showManage} onOpenChange={setShowManage}>
        <SheetContent className="bg-white">
          <SheetHeader>
            <SheetTitle>Privacy and Cookies</SheetTitle>
            <SheetDescription>
              Choose which cookies you want to allow.
            </SheetDescription>
          </SheetHeader>
          <ManageCookiePreferences
            consent={consent}
            updateConsent={updateConsent}
            onAcceptAll={acceptAll}
            onRejectAll={rejectNonNecessary}
            onReset={resetConsent}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      {/* Google-style cookie banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                Before you continue to FEZZY
              </p>
              <p className="text-sm text-gray-600 mt-1">
                We use cookies and other technologies to improve your experience on our site, analyze traffic, and personalize content and advertising. 
                You can learn more about how we use cookies and control your preferences by clicking "Manage preferences".
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowManage(true)}
              >
                Manage preferences
              </Button>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  rejectNonNecessary();
                  setDismissed(true);
                }}
              >
                Reject all
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  acceptAll();
                  setDismissed(true);
                }}
              >
                Accept all
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Manage preferences sheet */}
      <Sheet open={showManage} onOpenChange={setShowManage}>
        <SheetContent className="bg-white overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Privacy and Cookies</SheetTitle>
            <SheetDescription>
              Choose which cookies you want to allow.
            </SheetDescription>
          </SheetHeader>
          <ManageCookiePreferences
            consent={consent}
            updateConsent={updateConsent}
            onAcceptAll={acceptAll}
            onRejectAll={rejectNonNecessary}
            onReset={resetConsent}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};

// Reusable Manage Cookie Preferences component
const ManageCookiePreferences = ({
  consent,
  updateConsent,
  onAcceptAll,
  onRejectAll,
  onReset,
}: {
  consent: any;
  updateConsent: (categories: any) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onReset: () => void;
}) => (
  <div className="mt-6 space-y-6">
    {/* Necessary cookies */}
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
        <Shield className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">
            Necessary cookies
          </h3>
          <Switch checked disabled />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Always active because they're essential for the site to work properly
        </p>
      </div>
    </div>

    {/* Analytics cookies */}
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">
            Analytics cookies
          </h3>
          <Switch
            checked={consent.analytics}
            onCheckedChange={(v) => updateConsent({ analytics: v })}
          />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Help us understand how visitors interact with our site
        </p>
      </div>
    </div>

    {/* Marketing cookies */}
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        <Megaphone className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">
            Marketing cookies
          </h3>
          <Switch
            checked={consent.marketing}
            onCheckedChange={(v) => updateConsent({ marketing: v })}
          />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Help us personalize advertising and content for you
        </p>
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
      <Button
        variant="outline"
        className="border-gray-300 text-gray-700 hover:bg-gray-50"
        onClick={onReset}
      >
        Reset preferences
      </Button>
      <div className="flex-1" />
      <Button
        variant="outline"
        className="border-gray-300 text-gray-700 hover:bg-gray-50"
        onClick={onRejectAll}
      >
        Reject all
      </Button>
      <Button
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={onAcceptAll}
      >
        Accept all
      </Button>
    </div>
  </div>
);

export default CookieConsent;
