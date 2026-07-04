import { useState } from "react";
import { Settings, Shield, BarChart3, Megaphone, X } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export const CookieConsent = () => {
  const { consent, hasConsented, acceptAll, rejectNonNecessary, updateConsent, resetConsent } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);

  // Show manage sheet even after consent is given
  const ManageCookieConsent = () => (
    <Sheet open={showManageSheet} onOpenChange={setShowManageSheet}>
      <SheetTrigger asChild>
        <button 
          className="font-mono-label text-cream-dim hover:text-cream text-left w-full"
        >
          Cookie settings
        </button>
      </SheetTrigger>
      <SheetContent className="bg-ink border-cream/10">
        <SheetHeader>
          <SheetTitle className="text-cream">Cookie Preferences</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-fezzy" />
              <div>
                <p className="font-medium text-cream">Necessary</p>
                <p className="text-xs text-cream-dim">Required for basic functionality</p>
              </div>
            </div>
            <Switch checked={true} disabled className="data-[state=checked]:bg-fezzy" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cream" />
              <div>
                <p className="font-medium text-cream">Analytics</p>
                <p className="text-xs text-cream-dim">Help us improve our website</p>
              </div>
            </div>
            <Switch 
              checked={consent.analytics} 
              onCheckedChange={(checked) => updateConsent({ analytics: checked })} 
              className="data-[state=checked]:bg-fezzy"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-cream" />
              <div>
                <p className="font-medium text-cream">Marketing</p>
                <p className="text-xs text-cream-dim">Personalized ads and offers</p>
              </div>
            </div>
            <Switch 
              checked={consent.marketing} 
              onCheckedChange={(checked) => updateConsent({ marketing: checked })} 
              className="data-[state=checked]:bg-fezzy"
            />
          </div>

          <div className="pt-4 border-t border-cream/10 space-y-2">
            <Button 
              variant="destructive" 
              onClick={() => {
                resetConsent();
                setShowManageSheet(false);
              }}
              className="w-full"
            >
              Reset consent
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // If user has consented, only render the ManageCookieConsent (invisible unless triggered)
  if (hasConsented) {
    return <ManageCookieConsent />;
  }

  return (
    <>
      <ManageCookieConsent />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-ink border-t border-cream/10 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-fezzy" />
                <h3 className="text-lg font-semibold text-cream">Cookie Consent</h3>
              </div>
              <p className="text-cream-dim text-sm">
                We use cookies to enhance your experience, analyze site traffic, and serve personalized content.
                You can manage your preferences below.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowSettings(!showSettings)} className="border-cream/20 text-cream hover:bg-ink-soft">
                <Settings className="w-4 h-4 mr-2" />
                Preferences
              </Button>
              <Button variant="outline" onClick={rejectNonNecessary} className="border-cream/20 text-cream hover:bg-ink-soft">
                Reject Non-Necessary
              </Button>
              <Button onClick={acceptAll} className="bg-fezzy hover:bg-fezzy/90 text-ink">
                Accept All
              </Button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-cream/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-fezzy" />
                  <div>
                    <p className="font-medium text-cream">Necessary</p>
                    <p className="text-xs text-cream-dim">Required for basic functionality</p>
                  </div>
                </div>
                <Switch checked={true} disabled className="data-[state=checked]:bg-fezzy" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cream" />
                  <div>
                    <p className="font-medium text-cream">Analytics</p>
                    <p className="text-xs text-cream-dim">Help us improve our website</p>
                  </div>
                </div>
                <Switch 
                  checked={consent.analytics} 
                  onCheckedChange={(checked) => updateConsent({ analytics: checked })} 
                  className="data-[state=checked]:bg-fezzy"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-cream" />
                  <div>
                    <p className="font-medium text-cream">Marketing</p>
                    <p className="text-xs text-cream-dim">Personalized ads and offers</p>
                  </div>
                </div>
                <Switch 
                  checked={consent.marketing} 
                  onCheckedChange={(checked) => updateConsent({ marketing: checked })} 
                  className="data-[state=checked]:bg-fezzy"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
