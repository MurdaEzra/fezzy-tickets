import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, Loader2, MapPin, Ticket, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAccountTickets,
  formatEventDate,
  formatPrice,
  type AccountTicket,
} from "@/lib/eventsApi";
import { toast } from "sonner";

const Account = () => {
  const { user, loading, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<AccountTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=signin", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setTicketsLoading(true);
    fetchAccountTickets()
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setTickets([]);
          toast.error("Could not load tickets", { description: error instanceof Error ? error.message : "Please try again." });
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

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
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="border-b border-cream/10 noise-overlay">
          <div className="mx-auto max-w-1440 px-5 py-16 lg:px-8">
            <p className="mb-4 font-mono-label text-fezzy-glow">My account</p>
            <h1 className="font-display text-4xl text-cream sm:text-5xl md:text-6xl">
              Hello, {name}
            </h1>
            <p className="mt-3 text-base text-cream-dim">{user.email}</p>
          </div>
        </section>

        <section className="mx-auto max-w-1440 px-5 py-12 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-display text-2xl text-cream">Your tickets</h2>
            <Link to="/events" className="btn-outline-editorial px-4 py-2">Browse more</Link>
          </div>

          {ticketsLoading ? (
            <div className="grid min-h-48 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-ash" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="border border-dashed border-cream/20 bg-ink-card p-16 text-center">
              <Ticket className="mx-auto h-10 w-10 text-ash" />
              <p className="mt-4 font-display text-2xl text-cream">No tickets yet</p>
              <p className="mt-1 text-sm text-cream-dim">When you grab tickets, they'll appear here.</p>
              <Link to="/events" className="btn-ember mt-6 inline-flex">
                Find events <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-px bg-cream/10 md:grid-cols-2">
              {tickets.map((ticket) => {
                const event = ticket.events;
                const tier = ticket.ticket_tiers;
                return (
                  <article key={ticket.id} className="flex bg-ink transition-colors hover:bg-ink-card">
                    <div className="relative w-32 flex-shrink-0 bg-ink-soft sm:w-44">
                      {event?.cover_image_url ? (
                        <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full min-h-40 place-items-center px-3 text-center">
                          <Ticket className="h-8 w-8 text-fezzy" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-5">
                      <p className="font-mono-label text-fezzy">{ticket.status}</p>
                      <h3 className="mt-1 font-display text-lg leading-tight text-cream">
                        {event?.title ?? "Event unavailable"}
                      </h3>
                      <div className="mt-3 space-y-1 text-xs text-cream-dim">
                        {event && <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-fezzy" /> {formatEventDate(event.starts_at)}</p>}
                        {event && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-fezzy" /> {event.venue_name ?? "Venue TBA"}, {event.city ?? "Location TBA"}</p>}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3">
                        <span className="font-display text-sm text-cream">
                          {tier?.name ?? "Ticket"} {ticket.orders ? `- ${formatPrice(ticket.orders.total_kes)}` : ""}
                        </span>
                        <span className="border border-cream/20 px-3 py-1 font-mono-label text-ash">QR emailed</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-1440 px-5 pb-12 lg:px-8">
          <div className="border border-ember/30 bg-ember/10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg text-cream">Delete account</h2>
                <p className="mt-1 text-sm text-cream-dim">Permanently remove your buyer account and sign out.</p>
              </div>
              <button onClick={handleDeleteAccount} className="inline-flex items-center gap-2 border border-ember bg-ember px-4 py-2 font-mono-label text-cream transition-colors hover:bg-ember-deep">
                <Trash2 className="h-4 w-4" /> Delete account
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
