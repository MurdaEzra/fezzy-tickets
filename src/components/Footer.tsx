import { Link } from "react-router-dom";
import { Facebook, Instagram, Music2, Ticket, Wallet } from "lucide-react";
import { FEZZY_LOGO_URL } from "@/lib/brand";

const cols = [
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

const Footer = () => {
  return (
    <footer className="border-t border-[#1f2230] bg-[#0c0d12]">
      <div className="mx-auto max-w-[1400px] px-5 pb-10 pt-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link to="/" className="mb-5 flex items-center gap-2">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl">
                <img src={FEZZY_LOGO_URL} alt="Fezzy Tickets" className="h-8 w-auto object-contain" />
              </span>
            </Link>
            <p className="max-w-sm leading-relaxed text-[#8a8fa3]">
              Kenya's ticketing platform for concerts, festivals, matches, theatre and unforgettable weekends.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[Instagram, Music2, Facebook].map((Icon, index) => (
                <a
                  key={index}
                  href="https://instagram.com/fezzytickets"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Fezzy social link"
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#2a2e3f] text-[#8a8fa3] transition hover:border-[#10ff8a] hover:text-[#10ff8a]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#8a8fa3]">{col.title}</p>
              <ul className="space-y-3 text-sm">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-[#cfd2dc] transition hover:text-[#10ff8a]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-2">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#8a8fa3]">Payments</p>
            <div className="space-y-2 text-sm text-[#cfd2dc]">
              <span className="flex items-center gap-2 rounded border border-[#2a2e3f] px-3 py-2">
                <Wallet className="h-4 w-4 text-[#10ff8a]" /> M-Pesa
              </span>
              <span className="flex items-center gap-2 rounded border border-[#2a2e3f] px-3 py-2">
                <Ticket className="h-4 w-4 text-[#10ff8a]" /> Visa
              </span>
              <span className="flex items-center gap-2 rounded border border-[#2a2e3f] px-3 py-2">
                <Ticket className="h-4 w-4 text-[#10ff8a]" /> Mastercard
              </span>
            </div>
          </div>
        </div>

        <div className="my-10 h-px bg-gradient-to-r from-transparent via-[#2a2e3f] to-transparent" />

        <div className="flex flex-col items-center justify-between gap-5 text-xs text-[#8a8fa3] md:flex-row">
          <p>© {new Date().getFullYear()} Fezzy Tickets Ltd - Nairobi, Kenya</p>
          <p>Verified tickets - Secure checkout - Local support</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
