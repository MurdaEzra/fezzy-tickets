import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Ticket, X, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/events", label: "Browse" },
  { to: "/streams", label: "Streams" },
  { to: "/start-selling", label: "Become Organizer" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 10);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsOrganizer(false);
      return;
    }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r) => r.role);
      setIsAdmin(roles.includes("super_admin") || roles.includes("admin"));
    });
    getOrganizerAccessStatus(user.id).then((status) => {
      setIsOrganizer(status === "approved");
    });
  }, [user]);

  return (
    <header
      className={
        `sticky top-0 z-40 transition-all duration-300 ` +
        (atTop
          ? "border-b-0 bg-gradient-to-b from-background/70 to-transparent backdrop-blur-none"
          : "border-b border-border/70 bg-background/85 backdrop-blur-xl")
      }
    >
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex items gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img
              src={FEZZY_LOGO_URL}
              alt="Fezzy Tickets"
              className="h-16 md:h-36 lg:h-56 w-auto object-contain"
            />
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors duration-200 ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full shadow-acacia ring-2 ring-transparent transition hover:ring-primary/30">
                  <UserAvatar />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
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
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth?mode=signin">Organizer sign in</Link>
              </Button>
              <Button variant="acacia" size="sm" asChild>
                <Link to="/start-selling">Sell tickets</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user && isOrganizer && (
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-full shadow-acacia ring-2 ring-primary/20"
              aria-label="Open organizer dashboard"
            >
              <UserAvatar className="h-10 w-10" />
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container-px mx-auto flex max-w-7xl flex-col py-4">
            {navItems.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-foreground"
              >
                {it.label}
              </Link>
            ))}
            {user && isOrganizer && (
              <button
                onClick={() => { navigate("/dashboard"); setOpen(false); }}
                className="flex items-center gap-3 py-3 text-sm font-medium text-foreground"
              >
                <UserAvatar className="h-8 w-8" />
                Organizer dashboard
              </button>
            )}
            {user && isAdmin && (
              <button
                onClick={() => { navigate("/admin"); setOpen(false); }}
                className="flex items-center gap-3 py-3 text-sm font-medium text-foreground"
              >
                <Shield className="h-4 w-4" /> Super admin
              </button>
            )}
            <div className="mt-2 flex gap-2 border-t border-border pt-4">
              {user ? (
                <Button variant="outline" className="flex-1" onClick={() => { signOut(); setOpen(false); }}>
                  Sign out
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to="/auth?mode=signin" onClick={() => setOpen(false)}>Sign in</Link>
                  </Button>
                  <Button variant="acacia" className="flex-1" asChild>
                    <Link to="/start-selling" onClick={() => setOpen(false)}>Sell tickets</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
