import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Ticket, X, LogOut, User as UserIcon, Shield, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FEZZY_LOGO_URL } from "@/lib/brand";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/events", label: "Events" },
  { to: "/streams", label: "Streams" },
  { to: "/pricing", label: "Pricing" },
  { to: "/organizer", label: "For Organizers" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data ?? []).map((r) => r.role);
      setIsAdmin(roles.includes("super_admin") || roles.includes("admin"));
    });
  }, [user]);

  const initials = user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-20 max-w-7xl items-center justify-between gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src={FEZZY_LOGO_URL} alt="Fezzy Tickets" className="h-12 md:h-14 w-auto object-contain" />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative text-[15px] font-semibold transition-colors duration-200 ${
                  isActive ? "text-foreground after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:bg-primary" : "text-foreground/70 hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href="#help" className="flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-foreground">
            <HelpCircle className="h-4 w-4" /> Help
          </a>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid h-10 w-10 place-items-center rounded-full bg-gradient-acacia font-semibold text-primary-foreground shadow-acacia">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/account")}>
                  <UserIcon className="mr-2 h-4 w-4" /> My account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <Ticket className="mr-2 h-4 w-4" /> Organizer dashboard
                </DropdownMenuItem>
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
            <Button variant="ghost" size="sm" asChild className="font-semibold">
              <Link to="/auth?mode=signin">Log In</Link>
            </Button>
          )}
          <Button variant="acacia" size="lg" asChild className="rounded-full px-5 font-semibold">
            <Link to={user ? "/dashboard" : "/auth?mode=signup&redirect=/dashboard"}>
              Sell Your Event
            </Link>
          </Button>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid h-10 w-10 place-items-center rounded-full border border-border"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container-px mx-auto flex max-w-7xl flex-col py-4">
            {navItems.map((it) => (
              <Link key={it.to} to={it.to} onClick={() => setOpen(false)} className="py-3 text-sm font-semibold text-foreground">
                {it.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-4">
              {user ? (
                <Button variant="outline" className="flex-1" onClick={() => { signOut(); setOpen(false); }}>Sign out</Button>
              ) : (
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/auth?mode=signin" onClick={() => setOpen(false)}>Log in</Link>
                </Button>
              )}
              <Button variant="acacia" className="flex-1" asChild>
                <Link to={user ? "/dashboard" : "/auth?mode=signup&redirect=/dashboard"} onClick={() => setOpen(false)}>Sell Your Event</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
