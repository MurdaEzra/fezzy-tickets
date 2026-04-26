import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Ticket, Calendar, MapPin, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { events, formatDate, formatPrice } from "@/data/events";
import { toast } from "sonner";

const Account = () => {
  const { user, loading, deleteAccount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=signin", { replace: true });
  }, [user, loading, navigate]);

  if (!user) return null;

  const upcoming = events.slice(0, 2);
  const name = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "there";

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("Delete your Fezzy Tickets account permanently? This cannot be undone.");
    if (!confirmed) return;
    try {
      await deleteAccount();
      toast.success("Account deleted");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error("Could not delete account", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="border-b border-border bg-mesh">
          <div className="container-px mx-auto max-w-7xl py-16">
            <p className="eyebrow mb-3">My account</p>
            <h1 className="display text-4xl text-foreground sm:text-5xl md:text-6xl">
              Hello, <span className="script font-normal text-primary text-[1.2em]">{name}</span>
            </h1>
            <p className="mt-3 text-base text-muted-foreground">{user.email}</p>
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl py-12">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-foreground">Your tickets</h2>
            <Button variant="outline" size="sm" asChild><Link to="/events">Browse more</Link></Button>
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-display text-2xl font-bold text-foreground">No tickets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">When you grab tickets, they'll appear here.</p>
              <Button variant="acacia" className="mt-6" asChild><Link to="/events">Find events</Link></Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcoming.map((e) => (
                <article key={e.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                  <div className="flex">
                    <div className="relative w-32 flex-shrink-0 sm:w-44">
                      <img src={e.image} alt={e.title} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{e.category}</p>
                      <h3 className="mt-1 font-display text-lg font-bold leading-tight text-foreground">{e.title}</h3>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(e.date)}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {e.venue}, {e.city}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <span className="font-display text-sm font-bold text-foreground">{formatPrice(e.priceFrom, e.currency)}</span>
                        <Button size="sm" variant="outline">View QR</Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="container-px mx-auto max-w-7xl pb-12">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Delete account</h2>
                <p className="mt-1 text-sm text-muted-foreground">Permanently remove your buyer account and sign out.</p>
              </div>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4" /> Delete account
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
