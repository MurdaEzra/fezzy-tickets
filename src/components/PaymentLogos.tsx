/**
 * Payment provider logos — inline SVG so they render everywhere (footer,
 * checkout, emails, mobile) at any scale with no network dependency.
 *
 * Wordmark set kept small on purpose. Colours track the brand refs but sit
 * on a neutral cream chip so they read against any background.
 */

type BadgeProps = { className?: string };

export const MpesaBadge = ({ className = "" }: BadgeProps) => (
  <svg viewBox="0 0 96 32" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="M-Pesa">
    <rect width="96" height="32" rx="6" fill="#ffffff" />
    <rect x="0.5" y="0.5" width="95" height="31" rx="5.5" fill="none" stroke="#e5e0d3" />
    <circle cx="16" cy="16" r="9" fill="#43B02A" />
    <path d="M12 16.5 L15 19.5 L20.5 12.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <text x="30" y="20.5" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="13" fill="#0f172a" letterSpacing="0.5">M-PESA</text>
  </svg>
);

export const VisaBadge = ({ className = "" }: BadgeProps) => (
  <svg viewBox="0 0 96 32" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Visa">
    <rect width="96" height="32" rx="6" fill="#ffffff" />
    <rect x="0.5" y="0.5" width="95" height="31" rx="5.5" fill="none" stroke="#e5e0d3" />
    <rect x="6" y="8" width="84" height="16" rx="2" fill="#1A1F71" />
    <text x="48" y="20.5" textAnchor="middle" fontFamily="'Helvetica Neue', Arial, sans-serif" fontStyle="italic" fontWeight="900" fontSize="14" fill="#F7B600" letterSpacing="2">VISA</text>
  </svg>
);

export const PaystackBadge = ({ className = "" }: BadgeProps) => (
  <svg viewBox="0 0 108 32" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Paystack">
    <rect width="108" height="32" rx="6" fill="#ffffff" />
    <rect x="0.5" y="0.5" width="107" height="31" rx="5.5" fill="none" stroke="#e5e0d3" />
    <g transform="translate(8 8)">
      <rect x="0" y="0" width="16" height="3" rx="1" fill="#00C3F7" />
      <rect x="0" y="5" width="16" height="3" rx="1" fill="#0BA4E0" />
      <rect x="0" y="10" width="10" height="3" rx="1" fill="#011B33" />
      <rect x="0" y="15" width="4" height="3" rx="1" fill="#011B33" />
    </g>
    <text x="32" y="20.5" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="12" fill="#011B33" letterSpacing="0.3">paystack</text>
  </svg>
);

interface PaymentLogosProps {
  variant?: "row" | "stack";
  tone?: "light" | "dark";
  className?: string;
  label?: string | false;
}

/**
 * Row of accepted-payment badges. Drop-in for checkout, footer, marketing.
 * `tone="dark"` inverts the surrounding label colour for use on dark surfaces.
 */
export const PaymentLogos = ({
  variant = "row",
  tone = "dark",
  className = "",
  label = "Accepted here",
}: PaymentLogosProps) => {
  const labelColor = tone === "dark" ? "text-cream-dim" : "text-ink/60";
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label !== false && (
        <span className={`font-mono-label text-[10px] tracking-[0.18em] uppercase ${labelColor}`}>{label}</span>
      )}
      <div className={variant === "row" ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-2"}>
        <MpesaBadge className="h-8 w-auto" />
        <VisaBadge className="h-8 w-auto" />
        <PaystackBadge className="h-8 w-auto" />
      </div>
    </div>
  );
};

export default PaymentLogos;
