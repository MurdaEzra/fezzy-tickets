import { useState } from "react";
import { Cookie, Shield, BarChart3, Megaphone, Cog, X } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useCookieConsent } from "@/hooks/useCookieConsent";

/**
 * Industrial-design cookie consent — think shipping manifest meets control panel.
 * A blueprint frame, mono labels, riveted corners, precise switches. No fluff.
 */
export const CookieConsent = () => {
  const { consent, hasConsented, acceptAll, rejectNonNecessary, updateConsent, resetConsent } = useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const ManageCookieConsent = () => (
    <Sheet open={showManageSheet} onOpenChange={setShowManageSheet}>
      <SheetTrigger asChild>
        <button className="font-mono-label text-cream-dim hover:text-cream text-left w-full">
          Cookie settings
        </button>
      </SheetTrigger>
      <SheetContent className="bg-ink border-l border-cream/10 text-cream">
        <SheetHeader>
          <SheetTitle className="text-cream font-mono-label tracking-[0.2em] text-xs">CONSENT / PANEL 02</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <ConsentRow icon={Shield} title="Necessary" desc="Session, security, checkout" checked disabled />
          <ConsentRow
            icon={BarChart3}
            title="Analytics"
            desc="Anonymous usage insights"
            checked={consent.analytics}
            onChange={(v) => updateConsent({ analytics: v })}
          />
          <ConsentRow
            icon={Megaphone}
            title="Marketing"
            desc="Personalised offers"
            checked={consent.marketing}
            onChange={(v) => updateConsent({ marketing: v })}
          />
          <div className="pt-4 border-t border-cream/10">
            <Button
              variant="outline"
              onClick={() => {
                resetConsent();
                setShowManageSheet(false);
                setDismissed(false);
              }}
              className="w-full border-cream/20 bg-transparent text-cream hover:bg-cream/5"
            >
              Reset preferences
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (hasConsented || dismissed) return <ManageCookieConsent />;

  return (
    <>
      <ManageCookieConsent />

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" aria-hidden />

      {/* Industrial console */}
      <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-6 sm:bottom-6">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-cream/10 bg-ink text-cream shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
          {/* Blueprint grid backdrop */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, hsl(var(--cream)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--cream)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />
          {/* Corner rivets */}
          {[
            "left-2 top-2",
            "right-2 top-2",
            "left-2 bottom-2",
            "right-2 bottom-2",
          ].map((pos) => (
            <span
              key={pos}
              className={`absolute ${pos} h-2 w-2 rounded-full border border-cream/30 bg-cream/10`}
              aria-hidden
            />
          ))}

          {/* Header strip */}
          <div className="relative flex items-center justify-between border-b border-cream/10 px-5 py-3 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-fezzy/40 bg-fezzy/10 text-fezzy">
                <Cookie className="h-4 w-4" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-mono-label text-[10px] tracking-[0.25em] text-cream-dim">FEZZY / CONSENT MODULE</span>
                <span className="text-sm font-semibold">Data preferences · v1.0</span>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-fezzy shadow-[0_0_10px_hsl(var(--fezzy))]" />
              <span className="font-mono-label text-[10px] tracking-[0.2em] text-cream-dim">LIVE</span>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="ml-2 rounded p-1 text-cream-dim transition hover:bg-cream/5 hover:text-cream"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="relative grid gap-5 px-5 py-5 sm:px-7 sm:py-6 md:grid-cols-[1.4fr,1fr]">
            <div>
              <h3 className="font-display text-2xl leading-tight text-cream sm:text-3xl">
                Handled with care.
                <span className="block text-cream-dim">Cookies, calibrated.</span>
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-cream-dim">
                We run a tight ship. Only what's needed to keep the platform secure, plus optional signals you approve.
                No dark patterns, no third-party surprises.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 font-mono-label text-[10px] tracking-[0.2em] text-cream-dim">
                <span className="rounded-sm border border-cream/15 px-2 py-1">GDPR</span>
                <span className="rounded-sm border border-cream/15 px-2 py-1">DPA-KE</span>
                <span className="rounded-sm border border-cream/15 px-2 py-1">NO 3rd-PARTY SELL</span>
              </div>
            </div>

            {/* Action panel */}
            <div className="flex flex-col gap-3 rounded-xl border border-cream/10 bg-cream/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono-label text-[10px] tracking-[0.25em] text-cream-dim">DECISION</span>
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex items-center gap-1 font-mono-label text-[10px] tracking-[0.2em] text-fezzy hover:text-fezzy/80"
                >
                  <Cog className="h-3 w-3" /> {showDetails ? "HIDE" : "CUSTOMISE"}
                </button>
              </div>
              <Button
                onClick={acceptAll}
                className="h-11 bg-fezzy text-ink hover:bg-fezzy/90 font-semibold tracking-wide"
              >
                Accept everything
              </Button>
              <Button
                variant="outline"
                onClick={rejectNonNecessary}
                className="h-11 border-cream/20 bg-transparent text-cream hover:bg-cream/5"
              >
                Only necessary
              </Button>
            </div>
          </div>

          {/* Expandable detail rail */}
          {showDetails && (
            <div className="relative border-t border-cream/10 bg-cream/[0.02] px-5 py-4 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-3">
                <ConsentRow icon={Shield} title="Necessary" desc="Session, security" checked disabled compact />
                <ConsentRow
                  icon={BarChart3}
                  title="Analytics"
                  desc="Anonymous usage"
                  checked={consent.analytics}
                  onChange={(v) => updateConsent({ analytics: v })}
                  compact
                />
                <ConsentRow
                  icon={Megaphone}
                  title="Marketing"
                  desc="Personalised offers"
                  checked={consent.marketing}
                  onChange={(v) => updateConsent({ marketing: v })}
                  compact
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

interface RowProps {
  icon: typeof Shield;
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  compact?: boolean;
}

const ConsentRow = ({ icon: Icon, title, desc, checked, disabled, onChange, compact }: RowProps) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-lg border border-cream/10 bg-ink px-3 ${
      compact ? "py-2.5" : "py-3"
    }`}
  >
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cream/15 bg-cream/[0.03] text-fezzy">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-cream">{title}</p>
        <p className="truncate font-mono-label text-[10px] tracking-[0.15em] text-cream-dim">{desc}</p>
      </div>
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className="data-[state=checked]:bg-fezzy"
    />
  </div>
);
