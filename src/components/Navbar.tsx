import { Link, NavLink } from "react-router-dom";
import { Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-amber shadow-amber transition-transform duration-500 group-hover:rotate-12">
            <Ticket className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Fezzy<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            { to: "/events", label: "Browse" },
            { to: "/events?cat=Music", label: "Music" },
            { to: "/events?cat=Festival", label: "Festivals" },
            { to: "/events?cat=Sports", label: "Sports" },
            { to: "/organizer", label: "For Organizers" },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm transition-colors duration-200 ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button variant="hero" size="sm" className="rounded-full">
            Get tickets
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
