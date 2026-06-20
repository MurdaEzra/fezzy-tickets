import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bolt,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Search,
  Shield,
  Tag,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useHomepageSettings } from "@/hooks/useEvents";
import { supabase } from "@/integrations/supabase/client";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import { defaultLiveBarItems } from "@/lib/homepageSettings";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";

const navItems = [
  { to: "/events", label: "Events" },
  { to: "/events#venues", label: "Venues" },
  { to: "/start-selling", label: "Sell" },
];

const tickerIcons = [Bolt, Tag, MapPin];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const { user, signOut } = useAuth();
  const { data: homepageSettings } = useHomepageSettings();
  const navigate = useNavigate();
  const liveBarItems = homepageSettings?.live_bar_items?.length ? homepageSettings.live_bar_items : defaultLiveBarItems;

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
        const roles = (data ?? []).map((r) => r.role);
        setIsAdmin(roles.includes("super_admin") || roles.includes("admin"));
      });

    getOrganizerAccessStatus(user.id).then((status) => {
      setIsOrganizer(status === "approved");
    });
  }, [user]);

  return (
    <>
      <div className="overflow-hidden border-b border-[#1f2230] bg-[#0c0d12]">
        <div className="flex w-max animate-marquee gap-12 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a8fa3]">
          {[...liveBarItems, ...liveBarItems, ...liveBarItems].map((item, index) => {
            const Icon = tickerIcons[index % tickerIcons.length];
            return (
              <span key={`${item}-${index}`} className="flex items-center gap-3 whitespace-nowrap">
                <Icon className="h-3.5 w-3.5 text-[#10ff8a]" />
                {item}
              </span>
            );
          })}
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-[#1f2230] bg-[rgba(6,7,10,.78)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
          <div className="flex h-[72px] items-center gap-4 lg:gap-6">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl">
                <img src={FEZZY_LOGO_URL} alt="Fezzy Tickets" className="h-10 w-auto object-contain" />
              </span>
            </Link>

            <button className="hidden items-center gap-2 text-sm text-[#8a8fa3] transition hover:text-white md:flex">
              <MapPin className="h-4 w-4 text-[#10ff8a]" />
              Nairobi, KE
              <ChevronDown className="h-3 w-3" />
            </button>

            <div className="hidden max-w-2xl flex-1 lg:block">
              <label className="flex h-11 items-center gap-3 rounded-full border border-[#1f2230] bg-[#12141b] px-5 transition focus-within:border-[#10ff8a]">
                <Search className="h-4 w-4 text-[#8a8fa3]" />
                <input
                  type="search"
                  placeholder="Search artists, venues, sports, festivals..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#5e6377]"
                />
                <kbd className="hidden rounded border border-[#2a2e3f] bg-[#13151c] px-1.5 py-0.5 text-[10px] text-[#8a8fa3] xl:inline">
                  Ctrl K
                </kbd>
              </label>
            </div>

            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `text-sm font-medium transition ${isActive ? "text-white" : "text-[#8a8fa3] hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full ring-2 ring-transparent transition hover:ring-[#10ff8a]/35">
                      <UserAvatar />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                    <DropdownMenuSeparator />
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
                    <DropdownMenuItem onClick={() => signOut().then(() => navigate("/"))}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="border-[#2a2e3f] text-white hover:border-[#10ff8a]" asChild>
                    <Link to="/auth?mode=signin">
                      <User className="h-4 w-4" /> Sign in
                    </Link>
                  </Button>
                  <Button size="sm" className="bg-[#10ff8a] text-[#04130a] hover:bg-[#5dffaf]" asChild>
                    <Link to="/events">
                      <Ticket className="h-4 w-4" /> Get Tickets
                    </Link>
                  </Button>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2 md:hidden">
              {user && (isOrganizer || isAdmin) && (
                <button
                  onClick={() => navigate(isOrganizer ? "/dashboard" : "/admin")}
                  className="rounded-full ring-2 ring-[#10ff8a]/25"
                  aria-label={isOrganizer ? "Open organizer dashboard" : "Open super admin dashboard"}
                >
                  <UserAvatar className="h-10 w-10" />
                </button>
              )}
              <button
                onClick={() => setOpen((value) => !value)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#2a2e3f] text-white"
                aria-label="Toggle menu"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div className="border-t border-[#1f2230] bg-[#06070a] md:hidden">
            <nav className="mx-auto flex max-w-[1400px] flex-col px-5 py-4">
              <label className="mb-3 flex h-11 items-center gap-3 rounded-full border border-[#1f2230] bg-[#12141b] px-4">
                <Search className="h-4 w-4 text-[#10ff8a]" />
                <input
                  type="search"
                  placeholder="Search events..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#5e6377]"
                />
              </label>
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="py-3 text-sm font-medium text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#1f2230] pt-4">
                {user ? (
                  <Button
                    variant="outline"
                    className="col-span-2 border-[#2a2e3f] text-white"
                    onClick={() => {
                      signOut();
                      setOpen(false);
                    }}
                  >
                    Sign out
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" className="border-[#2a2e3f] text-white" asChild>
                      <Link to="/auth?mode=signin" onClick={() => setOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button className="bg-[#10ff8a] text-[#04130a]" asChild>
                      <Link to="/events" onClick={() => setOpen(false)}>
                        Tickets
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
};

export default Navbar;
