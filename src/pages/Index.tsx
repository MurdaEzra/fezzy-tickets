import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Headphones,
  Lock,
  Mail,
  MapPin,
  Music,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useFeaturedEvents, useHomepageSettings } from "@/hooks/useEvents";
import { artists, categories, iconicVenues, pastEvents, trendingEvents, weekendCalendar } from "@/data/homepage";
import { formatEventDate, formatPrice, lowestTierPrice, ticketsRemaining } from "@/lib/eventsApi";
import { pickHeadliner } from "@/lib/homepageSettings";
import { isEventDue } from "@/lib/pricing";
import { toast } from "sonner";

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const { data: events = [] } = useFeaturedEvents(12);
  const { data: homepageSettings } = useHomepageSettings();
  const headliner = pickHeadliner(events, homepageSettings?.headliner_event_id);
  const headlinerTiers = headliner?.ticket_tiers ?? [];
  const headlinerLowestPrice = headliner ? lowestTierPrice(headlinerTiers) : null;
  const headlinerBuying = headlinerTiers.reduce((sum, tier) => sum + tier.sold, 0);
  const endedEvents = events.filter((event) => isEventDue(event.starts_at)).map((event) => ({
    title: event.title,
    date: formatEventDate(event.starts_at),
    venue: event.venue_name ?? event.city ?? "Venue TBA",
    attendance: "Ticket sale ended",
    image: event.cover_image_url || event.poster_url || "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
  }));
  const displayedPastEvents = [...endedEvents, ...pastEvents].slice(0, 6);
  const showTicketSaleEnded = () => toast.info("Ticket Sale Ended");

  return (
    <div className="min-h-screen bg-[#06070a] text-white">
      <Navbar />
      <main>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(6,7,10,0) 0%, rgba(6,7,10,.2) 40%, rgba(6,7,10,.9) 92%), linear-gradient(90deg, rgba(6,7,10,.88) 0%, rgba(6,7,10,.35) 52%, rgba(6,7,10,0) 100%), url('https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=80')",
            }}
          />
          <div className="dotgrid absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-[1400px] px-5 pb-20 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
            <div className="grid items-end gap-10 lg:grid-cols-12">
              <div className="flex flex-col lg:col-span-7">
                <h1 className="hidden font-display text-5xl font-extrabold leading-[0.95] sm:text-6xl md:block lg:text-7xl xl:text-8xl">
                  <span className="tm-grad-text">Live moments.</span>
                  <br />
                  <span className="tm-grad-green">Unforgettable nights.</span>
                </h1>
                <p className="mt-6 hidden max-w-xl text-lg leading-relaxed text-[#a4a9bb] md:block">
                  Kenya's home for live entertainment - concerts, derbies, festivals, theatre and the moments everyone will be talking about tomorrow.
                </p>

                <div className="order-first flex max-w-2xl flex-col gap-3 md:order-none md:mt-8 sm:flex-row">
                  <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-[#1f2230] bg-[#12141b] px-4 transition focus-within:border-[#10ff8a] md:h-14 md:rounded-2xl md:px-5">
                    <Search className="h-4 w-4 text-[#10ff8a] md:h-5 md:w-5" />
                    <input
                      type="search"
                      placeholder="Search Sauti Sol, Safari Rally, Koroga..."
                      className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#5e6377] md:text-sm"
                    />
                  </label>
                  <select className="hidden h-14 rounded-2xl border border-[#1f2230] bg-[#12141b] px-5 text-sm outline-none transition focus:border-[#10ff8a] sm:block">
                    <option>All categories</option>
                    <option>Music</option>
                    <option>Sports</option>
                    <option>Festivals</option>
                    <option>Theatre</option>
                    <option>Comedy</option>
                  </select>
                  <Button className="hidden h-14 rounded-2xl bg-[#10ff8a] px-7 font-bold text-[#04130a] hover:bg-[#5dffaf] sm:inline-flex" asChild>
                    <Link to="/events">
                      Search <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="ticket-shell rounded-3xl p-2">
                  <div className="overflow-hidden rounded-[20px] bg-[#171922]">
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={headliner?.cover_image_url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80"}
                        alt={headliner?.title ?? "Sol Fest"}
                        className="h-full w-full object-cover transition duration-700 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#171922] via-transparent to-transparent" />
                      <span className="absolute left-3 top-3 -rotate-6 rounded-md bg-[#10ff8a] px-2.5 py-1 text-xs font-black uppercase text-[#04130a]">
                        Headliner
                      </span>
                      <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2.5 py-1 text-xs backdrop-blur">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#10ff8a]" />
                        {headlinerBuying > 0 ? headlinerBuying.toLocaleString() : "3,420"} buying
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#10ff8a]">
                            {headliner ? formatEventDate(headliner.starts_at) : "Sat - 06 Dec 2026"}
                          </div>
                          <h2 className="font-display text-2xl font-bold leading-tight">{headliner?.title ?? "Sol Fest 2026 - The Finale"}</h2>
                          <p className="mt-2 flex items-center gap-2 text-sm text-[#8a8fa3]">
                            <MapPin className="h-4 w-4" /> {headliner?.venue_name ?? "Kasarani Stadium"}, {headliner?.city ?? "Nairobi"}
                          </p>
                        </div>
                        <div className="eq mt-1 shrink-0">
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                      <div className="my-5 border-t-2 border-dashed border-[#2a2e3f]" />
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-[#8a8fa3]">From</div>
                          <div className="font-display text-3xl font-bold">
                            {headlinerLowestPrice === null ? "Sales soon" : formatPrice(headlinerLowestPrice)}
                          </div>
                        </div>
                        <Button className="rounded-xl bg-[#10ff8a] font-bold text-[#04130a] hover:bg-[#5dffaf]" asChild>
                          <Link to={headliner ? `/events/${headliner.slug}` : "/events"}>
                            Get Tickets <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                      <div className="mt-5 space-y-2 text-sm">
                        {(headlinerTiers.length
                          ? headlinerTiers.slice(0, 3).map((tier, index) => [
                            tier.name,
                            formatPrice(tier.price_kes),
                            index === 0 ? "#10ff8a" : index === 1 ? "#c4ff3d" : "#ffd23d",
                            `${ticketsRemaining(tier)} left`,
                          ])
                          : [
                            ["Regular", "KSh 3,500", "#10ff8a", "Available"],
                            ["VIP", "KSh 12,000", "#c4ff3d", "Available"],
                            ["VVIP Table (8)", "KSh 250,000", "#ffd23d", "Limited"],
                          ]).map(([tier, price, color, note]) => (
                            <div key={tier} className="flex items-center justify-between rounded-lg bg-[#13151c] px-3 py-2">
                              <span className="flex items-center gap-2 text-[#8a8fa3]">
                                <Circle className="h-2 w-2 fill-current" style={{ color }} />
                                {tier} <span className="text-[10px] text-[#5e6377]">{note}</span>
                              </span>
                              <span>{price}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#1f2230] bg-[#0c0d12]">
          <div className="mx-auto max-w-[1400px] px-5 py-5 lg:px-8">
            <div className="no-scrollbar flex items-center gap-3 overflow-x-auto">
              <span className="shrink-0 pr-2 text-xs uppercase tracking-[0.25em] text-[#8a8fa3]">Browse</span>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${activeCategory === category
                    ? "border-[#10ff8a] bg-[#10ff8a] text-[#04130a]"
                    : "border-[#1f2230] bg-white/[.04] text-white hover:border-[#10ff8a] hover:text-[#10ff8a]"
                    }`}
                >
                  <Sparkles className="h-4 w-4" />
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        <SectionHeader eyebrow="Trending in Nairobi" title="This week's hottest events" action="View all events" to="/events" />
        <section className="mx-auto grid max-w-[1400px] gap-6 px-5 pb-20 lg:grid-cols-3 lg:px-8">
          {trendingEvents.map((event) => (
            <Link key={event.title} to="/events" className="ev-card group overflow-hidden rounded-3xl border border-[#1f2230] bg-[#12141b]">
              <div className="relative h-56 overflow-hidden">
                <img src={event.image} alt={event.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12141b] via-transparent to-transparent" />
                <span className="absolute left-4 top-4 rounded-full bg-[#10ff8a] px-3 py-1 text-xs font-black uppercase text-[#04130a]">{event.tag}</span>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#10ff8a]">{event.date}</p>
                <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{event.title}</h3>
                <p className="mt-3 flex items-center gap-2 text-sm text-[#8a8fa3]">
                  <MapPin className="h-4 w-4" /> {event.venue}, {event.city}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#cfd2dc]">
                  By {event.organizer}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-[#1f2230] pt-4">
                  <span className="text-sm text-[#8a8fa3]">From <b className="text-white">{event.price}</b></span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#171922] text-[#10ff8a] transition group-hover:bg-[#10ff8a] group-hover:text-[#04130a]">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="border-y border-[#1f2230] bg-[#0c0d12]">
          <div className="mx-auto max-w-[1400px] px-5 py-20 lg:px-8">
            <SectionTitle eyebrow="Artists" title="Artists lighting up Kenya" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {artists.map((artist) => (
                <Link key={artist.name} to="/events" className="group overflow-hidden rounded-3xl border border-[#1f2230] bg-[#12141b]">
                  <div className="aspect-square overflow-hidden">
                    <img src={artist.image} alt={artist.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-widest text-[#10ff8a]">{artist.genre}</p>
                    <h3 className="mt-1 font-display text-2xl font-bold">{artist.name}</h3>
                    <p className="mt-2 text-sm text-[#8a8fa3]">{artist.shows}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 py-20 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-[#1f2230] bg-[#0c0d12]">
            <div className="flex flex-col gap-4 border-b border-[#1f2230] p-6 md:flex-row md:items-end md:justify-between lg:p-8">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#10ff8a]">Past Events</p>
                <h2 className="font-display text-4xl font-bold leading-tight text-white lg:text-5xl">Moments people still talk about</h2>
              </div>
              <Button variant="outline" className="w-fit border-[#2a2e3f] text-white hover:border-[#10ff8a]" asChild>
                <Link to="/events">
                  Browse archive <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-3 lg:p-6">
              {displayedPastEvents.map((event) => (
                <button
                  key={`${event.title}-${event.date}`}
                  type="button"
                  onClick={showTicketSaleEnded}
                  className="group overflow-hidden rounded-2xl border border-[#1f2230] bg-[#12141b] text-left"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img src={event.image} alt={event.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white backdrop-blur">
                      {event.date}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-2xl font-bold leading-tight">{event.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[#8a8fa3]">
                      <MapPin className="h-4 w-4" /> {event.venue}
                    </p>
                    <p className="mt-4 rounded-xl border border-[#1f2230] bg-[#0c0d12] px-3 py-2 text-sm text-[#cfd2dc]">
                      {event.attendance}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-20 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <SectionTitle eyebrow="This Weekend" title="Your calendar is calling" />
            <p className="mt-4 max-w-md text-[#8a8fa3]">
              Friday to Sunday plans, sorted by date with fast links straight to event browsing.
            </p>
          </div>
          <div className="space-y-3 lg:col-span-7">
            {weekendCalendar.map((item) => (
              <Link
                key={`${item.day}-${item.title}`}
                to="/events"
                className="group grid gap-4 rounded-2xl border border-[#1f2230] bg-[#12141b] p-4 transition hover:border-[#10ff8a] sm:grid-cols-[86px_1fr_auto]"
              >
                <div className="grid h-20 w-20 place-items-center rounded-2xl bg-[#10ff8a] text-center text-[#04130a]">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest">{item.day}</div>
                    <div className="font-display text-3xl font-black">{item.date}</div>
                  </div>
                </div>
                <div className="self-center">
                  <h3 className="font-display text-xl font-bold">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-[#8a8fa3]">
                    <MapPin className="h-4 w-4" /> {item.location}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 self-center text-sm sm:block sm:text-right">
                  <p className="text-[#8a8fa3]">From</p>
                  <p className="font-bold">{item.price}</p>
                  <ChevronRight className="mt-2 hidden h-5 w-5 text-[#10ff8a] sm:ml-auto sm:block" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="venues" className="border-y border-[#1f2230] bg-[#0c0d12]">
          <div className="mx-auto max-w-[1400px] px-5 py-20 lg:px-8">
            <SectionTitle eyebrow="Iconic Venues" title="Where the big nights happen" />
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {iconicVenues.map((venue) => (
                <Link key={venue.name} to="/events" className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-[#1f2230]">
                  <img src={venue.image} alt={venue.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-widest backdrop-blur">
                      <MapPin className="h-3.5 w-3.5 text-[#10ff8a]" /> {venue.city}
                    </p>
                    <h3 className="font-display text-3xl font-bold">{venue.name}</h3>
                    <p className="mt-2 text-[#cfd2dc]">{venue.events}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-20 lg:grid-cols-12 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#2a2e3f] bg-[#13151c] p-8 lg:col-span-7 lg:p-12">
            <div className="mapbg absolute inset-0 opacity-55" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#10ff8a]">For Organizers</p>
              <h2 className="mt-3 max-w-lg font-display text-4xl font-bold leading-tight lg:text-5xl">
                Sell out smarter with Fezzy Tickets.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-[#8a8fa3]">
                Launch events, manage tiers, scan tickets at the door, and track sales from one clean dashboard.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button className="bg-[#10ff8a] text-[#04130a] hover:bg-[#5dffaf]" asChild>
                  <Link to="/start-selling">
                    Start selling <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="border-[#2a2e3f] text-white hover:border-[#10ff8a]" asChild>
                  <Link to="/dashboard">Organizer dashboard</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  [Wallet, "M-Pesa payouts"],
                  [Users, "Audience insights"],
                  [Ticket, "Fast gate scans"],
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof Wallet;
                  return (
                    <div key={label as string} className="rounded-2xl border border-[#1f2230] bg-black/20 p-4">
                      <ItemIcon className="h-5 w-5 text-[#10ff8a]" />
                      <p className="mt-3 text-sm font-semibold">{label as string}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#2a2e3f] bg-[#12141b] p-8 lg:col-span-5 lg:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#10ff8a]">Presale Access</p>
            <h2 className="mt-3 font-display text-3xl font-bold">Never miss the drop.</h2>
            <p className="mt-3 text-[#8a8fa3]">Presale codes, venue alerts, and weekend picks land in your inbox first.</p>
            <form className="mt-6 space-y-3">
              <label className="flex h-14 items-center gap-3 rounded-xl border border-[#2a2e3f] bg-[#13151c] px-4 transition focus-within:border-[#10ff8a]">
                <Mail className="h-4 w-4 text-[#8a8fa3]" />
                <input type="email" placeholder="you@email.com" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#5e6377]" />
              </label>
              <label className="flex h-14 items-center gap-3 rounded-xl border border-[#2a2e3f] bg-[#13151c] px-4">
                <MapPin className="h-4 w-4 text-[#8a8fa3]" />
                <select className="min-w-0 flex-1 bg-transparent text-sm outline-none">
                  <option>Nairobi</option>
                  <option>Mombasa</option>
                  <option>Kisumu</option>
                  <option>Nakuru</option>
                  <option>Eldoret</option>
                </select>
              </label>
              <Button type="button" className="h-14 w-full rounded-xl bg-[#10ff8a] text-[#04130a] hover:bg-[#5dffaf]">
                Join the list <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </section>

        <section className="border-t border-[#1f2230]">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-5 py-10 text-center md:grid-cols-4 lg:px-8">
            {[
              [ShieldCheck, "100% Verified", "Authentic tickets, every time"],
              [CheckCircle2, "Easy refunds", "Clear event policies"],
              [Headphones, "24/7 Support", "Swahili and English"],
              [Lock, "Secure payments", "M-Pesa, Visa and Mastercard"],
            ].map(([Icon, title, body]) => {
              const ItemIcon = Icon as typeof ShieldCheck;
              return (
                <div key={title as string}>
                  <ItemIcon className="mx-auto h-7 w-7 text-[#10ff8a]" />
                  <div className="mt-2 font-display font-bold">{title as string}</div>
                  <div className="mt-1 text-xs text-[#8a8fa3]">{body as string}</div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const SectionHeader = ({ eyebrow, title, action, to }: { eyebrow: string; title: string; action: string; to: string }) => (
  <section className="mx-auto max-w-[1400px] px-5 pb-8 pt-20 lg:px-8">
    <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
      <SectionTitle eyebrow={eyebrow} title={title} />
      <Button variant="outline" className="border-[#2a2e3f] text-white hover:border-[#10ff8a]" asChild>
        <Link to={to}>
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  </section>
);

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div>
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#10ff8a]">{eyebrow}</p>
    <h2 className="font-display text-4xl font-bold leading-tight text-white lg:text-5xl">{title}</h2>
  </div>
);

export default Index;

