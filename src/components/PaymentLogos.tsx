/**
 * Payment provider logos.
 */

type BadgeProps = { className?: string };

export const MpesaBadge = ({ className = "" }: BadgeProps) => (
  <img 
    src="https://res.cloudinary.com/dgfmhyebp/image/upload/v1783157049/mpesa_yew9uz.png" 
    alt="M-Pesa" 
    className={className}
  />
);

export const VisaBadge = ({ className = "" }: BadgeProps) => (
  <img 
    src="https://res.cloudinary.com/dgfmhyebp/image/upload/v1783157050/Visa_yyimq5.png" 
    alt="Visa" 
    className={className}
  />
);

export const PaystackBadge = ({ className = "" }: BadgeProps) => (
  <img 
    src="https://res.cloudinary.com/dgfmhyebp/image/upload/v1783157049/Paystack_sn4azz.png" 
    alt="Paystack" 
    className={className}
  />
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
