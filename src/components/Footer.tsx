import { Link } from "react-router-dom";
import { Ticket, Instagram, Twitter, Facebook } from "lucide-react";

const cols = [
  { title: "Discover", links: [["Browse events", "/events"], ["This weekend", "/events"], ["Categories", "/events"]] },
  { title: "Organize", links: [["Pricing", "/pricing"], ["For Organizers", "/organizer"]] },
  { title: "Company", links: [["About", "/"], ["Help center", "/help"], ["Contact", "/help"]] },
];

const Footer = () => {
  return (
    <footer className="border-t border-border bg-cream-deep">
      <div className="container-px mx-auto max-w-7xl py-16">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-acacia shadow-acacia">
                <Ticket className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
              </span>
              <span className="font-display text-xl font-bold text-foreground">
                Fezzy<span className="script ml-0.5 text-2xl text-primary">tickets</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Born in <span className="text-foreground font-medium">Nairobi</span>. 
              Every concert, festival, match and gathering  one ticket away. Come let's experience the fun together!
            </p>
            <div className="mt-6 flex gap-2">
              {[Instagram, Twitter, Facebook].map((Icon, i) => (
                <a key={i} href="https://instagram.com/fezzytickets" aria-label="Social" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground hover:text-background">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-4">{col.title}</p>
              <ul className="space-y-2.5 text-sm">
                {col.links.map(([l, to]) => (
                  <li key={l}>
                    <Link to={to} className="text-muted-foreground transition-colors hover:text-foreground">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Fezzy Tickets · Nairobi, Kenya 🇰🇪</p>
          <p>M-Pesa · Visa · Apple Pay ·</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
