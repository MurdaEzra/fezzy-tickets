import { Link } from "react-router-dom";
import { Ticket } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border/60 bg-navy-deep">
      <div className="container-px mx-auto max-w-7xl py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-amber">
                <Ticket className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
              </span>
              <span className="font-display text-xl font-semibold">Fezzy<span className="text-primary">.</span></span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The editorial home for live experiences. Every event. Every ticket. One place.
            </p>
          </div>
          {[
            { title: "Discover", links: ["Browse events", "This weekend", "Near you", "Categories"] },
            { title: "Organize", links: ["Sell tickets", "Pricing", "For venues", "API"] },
          ].map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-4">{col.title}</p>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Fezzy Tickets. All rights reserved.</p>
          <p>Built for live moments — Nairobi · Lagos · Cape Town · Kigali</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
