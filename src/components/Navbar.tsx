import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Moon, Search, Shield, Sun, Ticket, X, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { useHomepageSettings } from "@/hooks/useEvents";
import { defaultLiveBarItems } from "@/lib/homepageSettings";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/events", label: "Events" },
  { to: "/resale", label: "Resale" },
  { to: "/events#venues", label: "Venues" },
  { to: "/events", label: "Artists" },
  { to: "/lpp", label: "LPP" },
  { to: "/start-selling", label: "Sell" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const { user, signOut } = useAuth();
  const { resetConsent } = useCookieConsent();
  const { data: homepageSettings } = useHomepageSettings();
  const navigate = useNavigate();
  const liveBarItems = homepageSettings?.live_bar_items?.length ? homepageSettings.live_bar_items : defaultLiveBarItems;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("fezzy-theme");
    const shouldUseLight = savedTheme === "light";
    setIsLightMode(shouldUseLight);
    document.documentElement.classList.toggle("fezzy-light", shouldUseLight);
  }, []);

  const toggleTheme = () => {
    setIsLightMode((current) => {
      const next = !current;
      document.documentElement.classList.toggle("fezzy-light", next);
      window.localStorage.setItem("fezzy-theme", next ? "light" : "dark");
      return next;
    });
  };

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsOrganizer(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((role) => role.role);
        setIsAdmin(roles.includes("super_admin") || roles.includes("admin"));
      });

    getOrganizerAccessStatus(user.id).then((status) => {
      setIsOrganizer(status === "approved");
    });
  }, [user]);

  return (
    <>
      <div className="overflow-hidden whitespace-nowrap border-b-2 border-ink bg-fezzy py-2 text-ink">
        <div className="inline-flex animate-marquee">
          {[...liveBarItems, ...liveBarItems].map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center font-mono-label text-ink">
              <span className="px-6">{item}</span>
              <span className="ticker-dot" />
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-cream/10 bg-ink/95 backdrop-blur-md">
        <div className="mx-auto max-w-1440 px-5 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-6">
            <Link to="/" className="group flex shrink-0 items-center gap-2" aria-label="Fezzy home">
              <img src="/uploads/fezzy-logo-header.png" alt="FEZZY" className="h-9 w-auto lg:h-11" />
              <span className="hidden font-mono-label text-fezzy sm:inline">.KE</span>
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-lime transition-transform group-hover:scale-150" />
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="editorial-link font-mono-label text-cream-dim transition-colors hover:text-cream"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button className="hidden items-center gap-1.5 font-mono-label text-cream-dim transition-colors hover:text-cream md:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fezzy" />
                Nairobi
                <ChevronDown className="h-3 w-3" />
              </button>

              <Link
                to="/events"
                className="hidden h-9 w-9 items-center justify-center border border-cream/20 transition-colors hover:border-fezzy hover:text-fezzy md:inline-flex"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 w-9 items-center justify-center border border-cream/20 transition-colors hover:border-fezzy hover:text-fezzy"
                aria-label={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
                title={isLightMode ? "Dark mode" : "Light mode"}
              >
                {isLightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden transition hover:ring-2 hover:ring-fezzy/35 md:inline-flex" aria-label="Account menu">
                      <UserAvatar className="h-9 w-9" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/account")}>
                      <Ticket className="mr-2 h-4 w-4" /> My account
                    </DropdownMenuItem>
                    {isOrganizer && (
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        <Ticket className="mr-2 h-4 w-4" /> Organizer dashboard
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Shield className="mr-2 h-4 w-4" /> Super admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => resetConsent()}>
                      <Settings className="mr-2 h-4 w-4" /> Cookie settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => signOut().then(() => navigate("/"))}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  to="/auth?mode=signin"
                  className="hidden px-3 font-mono-label text-cream-dim transition-colors hover:text-cream md:inline-flex"
                >
                  Sign in
                </Link>
              )}

              <Link to="/start-selling" className="btn-ember hidden sm:inline-flex">
                Sell tickets
                <span className="text-base leading-none">-&gt;</span>
              </Link>

              <button
                className="inline-flex h-9 w-9 items-center justify-center border border-cream/20 lg:hidden"
                onClick={() => setOpen((value) => !value)}
                aria-label="Menu"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {open && (
            <div className="lg:hidden">
              <nav className="mt-2 flex flex-col gap-4 border-t border-cream/10 pb-6 pt-4">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="font-mono-label text-cream-dim hover:text-cream"
                  >
                    {item.label}
                  </Link>
                ))}
                {user ? (
                  <>
                    <Link
                      to="/account"
                      onClick={() => setOpen(false)}
                      className="font-mono-label text-cream-dim hover:text-cream"
                    >
                      My account
                    </Link>
                    {(isOrganizer || isAdmin) && (
                      <button
                        className="text-left font-mono-label text-cream-dim hover:text-cream"
                        onClick={() => {
                          navigate(isOrganizer ? "/dashboard" : "/admin");
                          setOpen(false);
                        }}
                      >
                        Dashboard
                      </button>
                    )}
                    <button
                      className="text-left font-mono-label text-cream-dim hover:text-cream"
                      onClick={() => {
                        resetConsent();
                        setOpen(false);
                      }}
                    >
                      Cookie settings
                    </button>
                    <button
                      className="text-left font-mono-label text-cream-dim hover:text-cream"
                      onClick={() => {
                        signOut();
                        setOpen(false);
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth?mode=signin"
                    onClick={() => setOpen(false)}
                    className="font-mono-label text-cream-dim hover:text-cream"
                  >
                    Sign in
                  </Link>
                )}
                <Link to="/start-selling" onClick={() => setOpen(false)} className="btn-ember justify-center">
                  Sell tickets -&gt;
                </Link>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
