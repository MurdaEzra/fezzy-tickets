import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar, Users, MapPin, Sparkles, ExternalLink, Pencil, Loader2, TrendingUp, DollarSign, Ticket as TicketIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, formatEventDate, type DbEvent } from "@/lib/eventsApi";
import { toast } from "sonner";

interface OrgProfile {
  id: string;
  org_name: string;
  events_published_count: number;
  contact_email: string | null;
  contact_phone: string | null;
  mpesa_till: string | null;
  bio: string | null;
}

const OrganizerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signin&redirect=/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("organizer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof) {
        setProfile(prof as OrgProfile);
        const { data: evts } = await supabase
          .from("events")
          .select("*")
          .eq("organizer_id", prof.id)
          .order("created_at", { ascending: false });
        setEvents((evts ?? []) as DbEvent[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim()) return;
    setCreatingProfile(true);
    const { data, error } = await supabase
      .from("organizer_profiles")
      .insert({ user_id: user.id, org_name: orgName.trim(), contact_email: user.email })
      .select()
      .single();
    setCreatingProfile(false);
    if (error) { toast.error("Could not create organizer profile", { description: error.message }); return; }
    setProfile(data as OrgProfile);
    toast.success("Welcome aboard!", { description: "Let's create your first event." });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="grid place-items-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-px mx-auto max-w-2xl py-16">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
            <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> First-event fee waived</span>
            <h1 className="display mt-4 text-4xl text-foreground sm:text-5xl">
              Become an <span className="script font-normal text-primary text-[1.2em]">organizer</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Set up your organization to start publishing events. Your first event has 0% platform fee — buyers pay no service fees on any event you run.
            </p>
            <form onSubmit={createProfile} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="orgName">Organization name</Label>
                <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Solstice Collective" required />
              </div>
              <Button type="submit" variant="acacia" size="lg" disabled={creatingProfile} className="w-full">
                {creatingProfile && <Loader2 className="h-4 w-4 animate-spin" />} Create organizer profile
              </Button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalRevenue = 0; // placeholder until orders aggregation
  const isFirstEvent = profile.events_published_count === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-px mx-auto max-w-7xl py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Organizer dashboard</p>
            <h1 className="display mt-2 text-4xl text-foreground sm:text-5xl">{profile.org_name}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to={`/organizer/${profile.id}`}>View public page <ExternalLink className="h-4 w-4" /></Link></Button>
            <Button variant="acacia" asChild><Link to="/dashboard/events/new">New event <Plus className="h-4 w-4" /></Link></Button>
          </div>
        </div>

        {isFirstEvent && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.07] p-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">🎉</div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">First event = 0% platform fee</p>
              <p className="text-sm text-muted-foreground">Once you publish, this perk is used. Make it count.</p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat icon={TicketIcon} label="Events" value={String(events.length)} />
          <Stat icon={Users} label="Tickets sold" value="0" />
          <Stat icon={DollarSign} label="Revenue" value={formatKES(totalRevenue)} />
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold">Your events</h2>
        {events.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-lg">No events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first event — it's on us.</p>
            <Button variant="acacia" className="mt-6" asChild>
              <Link to="/dashboard/events/new">Create event <Plus className="h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {events.map((e) => (
              <div key={e.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft">
                <div className="flex gap-4 p-4">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary">
                    {e.cover_image_url ? (
                      <img src={e.cover_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground"><Calendar className="h-6 w-6" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold leading-tight text-foreground">{e.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        e.status === "published" ? "bg-primary/15 text-primary" :
                        e.status === "draft" ? "bg-secondary text-muted-foreground" :
                        "bg-destructive/15 text-destructive"
                      }`}>{e.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatEventDate(e.starts_at)}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {e.venue_name ?? "TBA"}
                    </p>
                    {e.fee_waived && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                        🎉 0% fee
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex border-t border-border">
                  <Button variant="ghost" className="flex-1 rounded-none" asChild>
                    <Link to={`/dashboard/events/${e.id}`}><Pencil className="h-4 w-4" /> Edit</Link>
                  </Button>
                  <div className="w-px bg-border" />
                  <Button variant="ghost" className="flex-1 rounded-none" asChild>
                    <Link to={`/events/${e.slug}`}><ExternalLink className="h-4 w-4" /> View</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

const Stat = ({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) => (
  <div className="rounded-2xl border border-border bg-card p-5 shadow-card-soft">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
    <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
  </div>
);

export default OrganizerDashboard;
