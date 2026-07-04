import { Link } from "react-router-dom";
import { Headphones, Lock, RefreshCcw, ShieldCheck } from "lucide-react";
import { PaymentLogos } from "@/components/PaymentLogos";

const columns = [
  {
    title: "Discover",
    links: [
      ["All events", "/events"],
      ["Concerts", "/events"],
      ["Sports", "/events"],
      ["Festivals", "/events"],
      ["Theatre", "/events"],
      ["Comedy", "/events"],
    ],
  },
  {
    title: "For you",
    links: [
      ["My tickets", "/auth?mode=signin"],
      ["Sell tickets", "/start-selling"],
      ["Streams", "/streams"],
      ["Mobile app", "/events"],
      ["Fezzy Rewards", "/events"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help centre", "/help"],
      ["Terms of use", "/terms"],
      ["Privacy", "/privacy"],
      ["Report fraud", "/help"],
      ["Contact", "/help"],
    ],
  },
];



const marqueeItems = ["Live moments", "Unforgettable nights", "M-Pesa ready", "NBO - MBA - KIS - NAK - ELD", "Tickets in 30s", "FEZZY - KE"];

const Footer = () => {
  return (
    <footer className="border-t border-cream/10 bg-ink">
      <div className="border-b border-cream/10">
        <div className="mx-auto max-w-1440 px-5 py-10 lg:px-8">
        </div>
      </div>

      <div className="overflow-hidden whitespace-nowrap border-b border-cream/10 py-6">
        <div className="inline-flex animate-marquee-slow font-display text-5xl text-cream lg:text-7xl">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center">
              <span className="px-6">{item}</span>
              <span className="ticker-dot" />
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-1440 px-5 py-16 lg:px-8">
        <div className="grid grid-cols-12 gap-8 lg:gap-12">
          <div className="col-span-12 lg:col-span-5">
            <Link to="/" className="mb-4 flex items-baseline gap-2">
              <img src="/uploads/fezzy-logo.png" alt="FEZZY" className="h-12 w-auto lg:h-16" />
              <span className="font-mono-label text-fezzy">.KE</span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-cream-dim">
              Kenya's ticketing platform for concerts, festivals, matches, theatre and unforgettable weekends. Verified tickets, secure
              checkout, local support - built in Nairobi for the moments that matter.
            </p>

            <div className="mt-6">
              <PaymentLogos tone="dark" label="Accepted payment methods" />
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title} className="col-span-6 lg:col-span-2">
              <div className="mb-4 font-mono-label text-fezzy">{column.title}</div>
              <ul className="space-y-2.5">
                {column.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="editorial-link text-sm text-cream-dim transition-colors hover:text-cream">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-12 lg:col-span-1">
            <div className="mb-4 font-mono-label text-fezzy">Contact</div>
            <a href="mailto:hello@fezzytickets.com" className="break-all text-xs font-mono-label text-cream-dim transition-colors hover:text-fezzy">
              hello@fezzytickets.com
            </a>
            <div className="mt-3 text-[10px] font-mono-label text-ash">
              Nairobi - Kenya
              <br />
              <a href="tel:+254728135200">+254 728135200</a>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-cream/10 pt-6 md:flex-row md:items-center">
          <div className="text-[10px] font-mono-label text-ash">
            (c) {new Date().getFullYear()} Fezzy Tickets Ltd - Nairobi, Kenya - All rights reserved
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono-label text-ash">
            <span>Verified tickets</span>
            <span className="ticker-dot bg-ash" />
            <span>Secure checkout</span>
            <span className="ticker-dot bg-ash" />
            <span>Local support</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
