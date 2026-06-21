import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  Mail,
  MapPin,
  Search,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFeaturedEvents, useHomepageSettings } from "@/hooks/useEvents";
import { artists, categories, iconicVenues, pastEvents, trendingEvents, weekendCalendar } from "@/data/homepage";
import { formatEventDate, formatPrice, lowestTierPrice, ticketsRemaining } from "@/lib/eventsApi";
import { pickHeadliner } from "@/lib/homepageSettings";
import { isEventDue } from "@/lib/pricing";
import { toast } from "sonner";

const asset = (path: string) => `/uploads/events/${path}`;

const eventImages = [
  asset("sol-fest.jpg"),
  asset("blankets-wine.png"),
  asset("safari-sevens.jpg"),
  asset("jazz-night.jpg"),
  asset("laugh-industry.jpg"),
  asset("koroga.jpg"),
];

const artistImages = [asset("artist-1.jpg"), asset("artist-2.jpg"), asset("artist-3.jpg"), asset("artist-4.jpg")];
const venueImages = [asset("venue-1.jpg"), asset("venue-2.jpg"), asset("venue-3.webp")];
const pastImages = [asset("festival-grid-1.jpg"), asset("tembea-kenya.jpg"), asset("blankets-wine.png"), asset("festival-grid-2.jpg")];

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedCity, setSelectedCity] = useState("Nairobi");
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const { data: events = [] } = useFeaturedEvents(12);
  const { data: homepageSettings } = useHomepageSettings();
  const headliner = pickHeadliner(events, homepageSettings?.headliner_event_id);
  const headlinerTiers = headliner?.ticket_tiers ?? [];
  const headlinerLowestPrice = headliner ? lowestTierPrice(headlinerTiers) : null;
  const headlinerBuying = headlinerTiers.reduce((sum, tier) => sum + tier.sold, 0);

  const endedEvents = events
    .filter((event) => isEventDue(event.starts_at))
    .map((event, index) => ({
      title: event.title,
      date: formatEventDate(event.starts_at),
      venue: event.venue_name ?? event.city ?? "Venue TBA",
      attendance: "Ticket sale ended",
      image: event.cover_image_url || event.poster_url || pastImages[index % pastImages.length],
    }));

  const displayedPastEvents = [...endedEvents, ...pastEvents.map((event, index) => ({ ...event, image: pastImages[index % pastImages.length] }))].slice(0, 4);
  const displayedTrendingEvents = trendingEvents.map((event, index) => ({ ...event, image: eventImages[index % eventImages.length] }));
  const displayedArtists = artists.map((artist, index) => ({ ...artist, image: artistImages[index % artistImages.length] }));
  const displayedVenues = iconicVenues.map((venue, index) => ({ ...venue, image: venueImages[index % venueImages.length] }));

  const submitPresale = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmittedEmail(email.trim());
    setEmail("");
  };

  const resetPresale = () => {
    setSubmittedEmail("");
  };

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-cream/10 noise-overlay">
          <div className="absolute inset-0 z-0">
            <img
              src={headliner?.cover_image_url || headliner?.poster_url || asset("sol-fest.jpg")}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.75)_50%,rgba(0,0,0,0.92)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,176,96,0.18)_0%,transparent_60%)]" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-0 hidden items-center justify-center opacity-[0.04] md:flex">
            <span className="font-display text-[40vw] leading-none text-cream">LIVE</span>
          </div>

          <div className="relative z-10 mx-auto max-w-1440 px-5 pb-16 pt-6 md:pt-12 lg:px-8 lg:pb-28 lg:pt-20">
            <div className="grid grid-cols-12 items-end gap-6 lg:gap-10">
              <div className="col-span-12 lg:col-span-8">
                <div className="mb-8 hidden items-center gap-3 md:flex">
                  <span className="font-mono-label text-fezzy-glow">001 - Live from Nairobi</span>
                  <span className="h-px max-w-[200px] flex-1 bg-cream/15" />
                  <span className="font-mono-label text-cream-dim">Est. 2026</span>
                </div>

                <h1 className="hidden font-display text-cream md:block">
                  <span className="block text-[14vw] leading-[0.86] lg:text-[9.5vw] xl:text-[140px]">LIVE MOMENTS.</span>
                  <span className="block text-[14vw] leading-[0.86] lg:text-[9.5vw] xl:text-[140px]">UNFORGETTABLE</span>
                  <span className="block text-[14vw] leading-[0.86] text-outline lg:text-[9.5vw] xl:text-[140px]">NIGHTS.</span>
                </h1>

                <p className="mt-8 hidden max-w-xl text-base leading-relaxed text-cream-dim md:block lg:text-lg">
                  Kenya's home for live entertainment - concerts, derbies, festivals, theatre and the moments everyone will be talking about
                  tomorrow. Pay with M-Pesa, card or wallet in under 30 seconds.
                </p>

                <div className="max-w-2xl md:mt-10">
                  <div className="flex flex-col items-stretch border border-cream/20 bg-ink/80 backdrop-blur-sm transition-colors focus-within:border-fezzy sm:flex-row">
                    <label className="flex flex-1 items-center py-3 pl-4 sm:border-r sm:border-cream/15">
                      <Search className="mr-3 h-4 w-4 shrink-0 text-ash" />
                      <input
                        type="search"
                        placeholder="Search artists, venues, events..."
                        className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-ash"
                      />
                    </label>
                    <label className="flex items-center py-3 pl-4 pr-3 sm:border-r sm:border-cream/15">
                      <MapPin className="mr-2 h-4 w-4 shrink-0 text-fezzy" />
                      <select className="cursor-pointer bg-transparent pr-2 font-mono-label text-cream-dim outline-none">
                        {["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"].map((city) => (
                          <option key={city} className="bg-ink" value={city}>
                            {city.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Link to="/events" className="btn-ember justify-center sm:px-6">
                      Find tickets
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="mr-1 font-mono-label text-ash">Browse:</span>
                    {categories.slice(0, 8).map((category) => (
                      <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`border px-3 py-1.5 font-mono-label transition-all ${activeCategory === category
                            ? "border-cream bg-cream text-ink"
                            : "border-cream/20 text-cream-dim hover:border-fezzy hover:text-fezzy"
                          }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4">
                <HeadlinerTicket
                  title={headliner?.title ?? "Sol Fest 2026 - The Finale"}
                  image={headliner?.cover_image_url || headliner?.poster_url || asset("sol-fest.jpg")}
                  date={headliner ? formatEventDate(headliner.starts_at) : "Sat - 06 Dec 2026"}
                  venue={`${headliner?.venue_name ?? "Kasarani Stadium"}, ${headliner?.city ?? "Nairobi"}`}
                  buying={headlinerBuying || 3420}
                  price={headlinerLowestPrice === null ? "Sales soon" : formatPrice(headlinerLowestPrice)}
                  to={headliner ? `/events/${headliner.slug}` : "/events"}
                  tiers={
                    headlinerTiers.length
                      ? headlinerTiers.slice(0, 3).map((tier, index) => ({
                        name: tier.name,
                        price: formatPrice(tier.price_kes),
                        note: `${ticketsRemaining(tier)} left`,
                        color: index === 0 ? "#00b060" : index === 1 ? "#d4ff3a" : "#ff4d1a",
                      }))
                      : [
                        { name: "Regular", price: "KSh 3,500", note: "Available", color: "#00b060" },
                        { name: "VIP", price: "KSh 12,000", note: "Available", color: "#d4ff3a" },
                        { name: "VVIP Table", price: "KSh 250,000", note: "Limited", color: "#ff4d1a" },
                      ]
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <EditorialHeader eyebrow="002 - Trending" title="This week's hottest events" action="View all events" to="/events" />
        <section id="trending" className="relative border-b border-cream/10">
          <div className="mx-auto grid max-w-1440 gap-px bg-cream/10 px-5 pb-20 lg:grid-cols-3 lg:px-8">
            {displayedTrendingEvents.map((event, index) => (
              <Link key={event.title} to="/events" className="group bg-ink transition-colors hover:bg-ink-card">
                <div className="relative h-72 overflow-hidden">
                  <img src={event.image} alt={event.title} className="h-full w-full object-cover img-zoom" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.82)_100%)]" />
                  <div className="absolute left-5 top-5 stamp text-fezzy-glow">{event.tag}</div>
                  <div className="absolute bottom-5 left-5 right-5">
                    <div className="mb-2 font-mono-label text-fezzy-glow">{event.date}</div>
                    <h3 className="font-display text-4xl leading-none text-cream transition-colors group-hover:text-fezzy-glow">{event.title}</h3>
                  </div>
                </div>
                <div className="grid min-h-[132px] grid-cols-[1fr_auto] gap-4 p-5">
                  <div>
                    <p className="flex items-center gap-2 text-sm text-cream-dim">
                      <MapPin className="h-4 w-4 text-fezzy" />
                      {event.venue}, {event.city}
                    </p>
                    <p className="mt-3 font-mono-label text-ash">By {event.organizer}</p>
                    <p className="mt-4 text-sm text-cream-dim">
                      From <span className="font-semibold text-cream">{event.price}</span>
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center border border-cream/20 text-fezzy transition-colors group-hover:border-fezzy group-hover:bg-fezzy group-hover:text-ink">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
                {index < 3 && <div className="h-1 bg-fezzy" />}
              </Link>
            ))}
          </div>
        </section>

        <section className="relative border-b border-cream/10 bg-ink-soft">
          <div className="mx-auto grid max-w-1440 gap-10 px-5 py-20 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-4">
              <SectionTitle eyebrow="003 - Weekend" title="Your calendar is calling" />
              <p className="mt-5 max-w-sm leading-relaxed text-cream-dim">Friday to Sunday plans, sorted by date with fast links straight to event browsing.</p>
            </div>
            <div className="grid gap-px bg-cream/10 lg:col-span-8">
              {weekendCalendar.map((item, index) => (
                <Link key={`${item.day}-${item.title}`} to="/events" className="group grid gap-5 bg-ink-soft p-5 transition-colors hover:bg-ink-card sm:grid-cols-[92px_1fr_auto]">
                  <div className={`grid h-20 w-20 place-items-center text-center text-ink ${index === 0 ? "bg-fezzy" : "bg-cream"}`}>
                    <div>
                      <div className="font-mono-label text-ink">{item.day}</div>
                      <div className="font-display text-4xl leading-none">{item.date}</div>
                    </div>
                  </div>
                  <div className="self-center">
                    <h3 className="font-display text-3xl leading-none text-cream group-hover:text-fezzy-glow">{item.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-cream-dim">
                      <MapPin className="h-4 w-4 text-fezzy" />
                      {item.location}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 self-center text-sm sm:block sm:text-right">
                    <p className="font-mono-label text-ash">From</p>
                    <p className="font-semibold text-cream">{item.price}</p>
                    <ChevronRight className="mt-2 hidden h-5 w-5 text-fezzy sm:ml-auto sm:block" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-cream/10">
          <div className="mx-auto max-w-1440 px-5 py-20 lg:px-8">
            <SectionTitle eyebrow="004 - Artists spotlight" title="Artists lighting up Kenya" />
            <div className="mt-10 grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-4">
              {displayedArtists.map((artist) => (
                <Link key={artist.name} to="/events" className="group bg-ink p-4 transition-colors hover:bg-ink-card">
                  <div className="aspect-[4/5] overflow-hidden">
                    <img src={artist.image} alt={artist.name} className="h-full w-full object-cover img-zoom" />
                  </div>
                  <div className="pt-5">
                    <p className="font-mono-label text-fezzy">{artist.genre}</p>
                    <h3 className="mt-2 font-display text-4xl leading-none text-cream">{artist.name}</h3>
                    <p className="mt-3 text-sm text-cream-dim">{artist.shows}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="venues" className="relative border-b border-cream/10 bg-ink-soft">
          <div className="mx-auto max-w-1440 px-5 py-20 lg:px-8">
            <SectionTitle eyebrow="005 - Iconic venues" title="Where the big nights happen" />
            <div className="mt-10 grid gap-px bg-cream/10 lg:grid-cols-3">
              {displayedVenues.map((venue) => (
                <Link key={venue.name} to="/events" className="group relative min-h-[380px] overflow-hidden bg-ink">
                  <img src={venue.image} alt={venue.name} className="absolute inset-0 h-full w-full object-cover img-zoom" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.92)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="mb-3 inline-flex items-center gap-2 border border-cream/20 bg-ink/70 px-3 py-1 font-mono-label text-cream-dim backdrop-blur">
                      <MapPin className="h-3.5 w-3.5 text-fezzy" />
                      {venue.city}
                    </p>
                    <h3 className="font-display text-4xl leading-none text-cream group-hover:text-fezzy-glow">{venue.name}</h3>
                    <p className="mt-3 text-cream-dim">{venue.events}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-cream/10">
          <div className="mx-auto grid max-w-1440 gap-px bg-cream/10 px-5 py-20 lg:grid-cols-12 lg:px-8">
            <div className="relative overflow-hidden bg-ink-card p-8 lg:col-span-7 lg:p-12">
              <div className="absolute inset-0 stripes-diagonal opacity-60" />
              <div className="relative">
                <SectionTitle eyebrow="006 - For organizers" title="Sell out smarter with Fezzy Tickets." />
                <p className="mt-5 max-w-md leading-relaxed text-cream-dim">
                  Launch events, manage tiers, scan tickets at the door, and track sales from one clean dashboard.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/start-selling" className="btn-ember">
                    Start selling <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/dashboard" className="btn-outline-editorial">
                    Organizer dashboard
                  </Link>
                </div>
                <div className="mt-10 grid gap-px bg-cream/10 sm:grid-cols-3">
                  {[
                    [Wallet, "M-Pesa payouts"],
                    [Users, "Audience insights"],
                    [Ticket, "Fast gate scans"],
                  ].map(([Icon, label]) => {
                    const ItemIcon = Icon as typeof Wallet;
                    return (
                      <div key={label as string} className="bg-ink p-5">
                        <ItemIcon className="h-5 w-5 text-fezzy" />
                        <p className="mt-4 font-mono-label text-cream-dim">{label as string}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-ink p-8 lg:col-span-5 lg:p-10">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono-label text-fezzy">Door tools</p>
                  <h3 className="mt-2 font-display text-4xl leading-none text-cream">Scan. Admit. Track.</h3>
                </div>
                <div className="qr-code h-16 w-16 opacity-50" />
              </div>
              <div className="space-y-3">
                {["Realtime ticket validation", "Tier sales and payout visibility", "Fraud-resistant QR delivery"].map((item) => (
                  <div key={item} className="flex items-center gap-3 border border-cream/10 p-4">
                    <Check className="h-4 w-4 text-lime" />
                    <span className="font-mono-label text-cream-dim">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-cream/10 bg-ink-soft">
          <div className="pointer-events-none absolute -right-6 top-6 font-display text-[18vw] leading-none text-cream/[0.03]">ARCHIVE</div>
          <div className="relative mx-auto max-w-1440 px-5 py-20 lg:px-8">
            <SectionTitle eyebrow="007 - Past moments" title="Moments people still talk about" />
            <div className="mt-10 grid gap-px bg-cream/10 sm:grid-cols-2 lg:grid-cols-4">
              {displayedPastEvents.map((event, index) => (
                <button
                  key={`${event.title}-${event.date}`}
                  type="button"
                  onClick={() => toast.info("Ticket Sale Ended")}
                  className="group relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-ink text-left transition-colors hover:bg-ink-card"
                >
                  <div className="absolute inset-0 z-0">
                    <img src={event.image} alt={event.title} className="h-full w-full object-cover img-zoom" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.4)_0%,rgba(0,0,0,0.6)_50%,rgba(0,0,0,0.95)_100%)]" />
                  </div>
                  <div className="relative z-10 p-6">
                    <div className="mb-1 font-mono-label text-cream-dim">{event.date}</div>
                    <div className="font-display text-5xl leading-none" style={{ color: index % 2 === 0 ? "#2bff9a" : "#f4ead4" }}>
                      {event.attendance}
                    </div>
                    <div className="mt-1 font-mono-label text-cream-dim">Fans in attendance</div>
                  </div>
                  <div className="relative z-10 p-6">
                    <h3 className="font-display text-2xl leading-tight text-cream transition-colors group-hover:text-fezzy-glow">{event.title}</h3>
                    <div className="mt-1 font-mono-label text-ash">{event.venue}</div>
                  </div>
                  <div className="relative z-10 mx-6 mb-2 flex items-center justify-end border-t border-cream/10 p-4 pt-0">
                    <ArrowUpRight className="h-4 w-4 text-fezzy transition-colors group-hover:text-lime" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="presale" className="relative overflow-hidden border-b border-cream/10 bg-fezzy text-ink">
          <div className="pointer-events-none absolute inset-0 stripes-diagonal opacity-20" />
          <div className="pointer-events-none absolute -bottom-16 -right-12 select-none font-display text-[28vw] leading-none text-ink/10">PRESALE</div>

          <div className="relative mx-auto max-w-1440 px-5 py-16 lg:px-8 lg:py-28">
            <div className="grid grid-cols-12 items-end gap-8">
              <div className="col-span-12 lg:col-span-7">
                <div className="mb-4 font-mono-label text-ink/70">008 - Presale access</div>
                <h2 className="font-display text-5xl leading-[0.86] text-ink lg:text-8xl">
                  Never miss
                  <br />
                  the drop.
                </h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/80">
                  Presale codes, venue alerts and weekend picks land in your inbox first. Join 84,000+ Kenyans who get the jump on every
                  drop.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono-label text-ink/80">
                  {["Presale codes", "Venue alerts", "Weekend picks", "No spam, ever"].map((item) => (
                    <span key={item} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="col-span-12 lg:col-span-5">
                {submittedEmail ? (
                  <div className="border-2 border-lime bg-ink p-8 text-cream shadow-2xl lg:p-10">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border-2 border-lime">
                      <Check className="h-6 w-6 text-lime" />
                    </div>
                    <div className="mb-2 font-mono-label text-lime">You're in - {selectedCity.toUpperCase()}</div>
                    <div className="mb-3 font-display text-3xl leading-tight text-cream">See you in your inbox.</div>
                    <p className="text-sm text-cream-dim">
                      Check <span className="text-lime">{submittedEmail}</span> for a welcome letter. Next drop hits in 48h.
                    </p>
                    <button onClick={resetPresale} className="mt-6 font-mono-label text-cream-dim transition-colors hover:text-lime">
                      &lt;- Add another email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitPresale} className="border-2 border-ink bg-ink p-6 text-cream shadow-2xl lg:p-8">
                    <div className="mb-2 font-mono-label text-lime">Join the list -&gt;</div>
                    <div className="mb-6 font-display text-3xl leading-tight text-cream">Be first in line.</div>

                    <div className="space-y-3">
                      <label>
                        <span className="mb-1.5 block font-mono-label text-cream-dim">Email</span>
                        <span className="flex items-center border border-cream/15 bg-ink-soft px-4 py-3 transition-colors focus-within:border-lime">
                          <Mail className="mr-3 h-4 w-4 text-ash" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            className="min-w-0 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-ash"
                          />
                        </span>
                      </label>

                      <div>
                        <div className="mb-1.5 block font-mono-label text-cream-dim">Your city</div>
                        <div className="grid grid-cols-5 gap-1">
                          {[
                            ["Nairobi", "NAIR"],
                            ["Mombasa", "MOMB"],
                            ["Kisumu", "KISU"],
                            ["Nakuru", "NAKU"],
                            ["Eldoret", "ELDO"],
                          ].map(([city, label]) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => setSelectedCity(city)}
                              className={`border px-1 py-2 text-[10px] font-mono-label transition-all ${selectedCity === city
                                  ? "border-lime bg-lime text-ink"
                                  : "border-cream/15 text-cream-dim hover:border-cream"
                                }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 bg-lime py-3 font-mono-label text-ink transition-colors hover:bg-cream">
                        Get presale access
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5 border-t border-cream/10 pt-4">
                      <div className="qr-code mx-auto h-12 w-12 opacity-50" />
                      <div className="mt-1 flex justify-between font-mono-label text-ash">
                        <span>Fezzy - Presale list</span>
                        <span>84,219 subscribers</span>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const HeadlinerTicket = ({
  title,
  image,
  date,
  venue,
  buying,
  price,
  to,
  tiers,
}: {
  title: string;
  image: string;
  date: string;
  venue: string;
  buying: number;
  price: string;
  to: string;
  tiers: Array<{ name: string; price: string; note: string; color: string }>;
}) => (
  <div className="relative bg-ink-card p-2 shadow-[0_20px_60px_-20px_rgba(0,176,96,0.35)]">
    <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
    <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
    <div className="overflow-hidden bg-ink-soft">
      <div className="relative h-52 overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover img-zoom" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-soft via-transparent to-transparent" />
        <span className="stamp absolute left-4 top-4 text-fezzy-glow">Headliner</span>
        <span className="absolute right-4 top-4 flex items-center gap-1.5 bg-ink/60 px-2.5 py-1 text-xs backdrop-blur">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-fezzy" />
          {buying.toLocaleString()} buying
        </span>
      </div>
      <div className="p-5">
        <div className="mb-1 font-mono-label text-fezzy">{date}</div>
        <h2 className="font-display text-3xl leading-none text-cream">{title}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm text-cream-dim">
          <MapPin className="h-4 w-4 text-fezzy" />
          {venue}
        </p>
        <div className="my-5 border-t-2 border-dashed border-cream/20" />
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono-label text-ash">From</div>
            <div className="font-display text-4xl leading-none text-cream">{price}</div>
          </div>
          <Link to={to} className="btn-ember px-4 py-3">
            Get tickets
          </Link>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          {tiers.map((tier) => (
            <div key={tier.name} className="flex items-center justify-between bg-ink px-3 py-2">
              <span className="flex items-center gap-2 text-cream-dim">
                <Circle className="h-2 w-2 fill-current" style={{ color: tier.color }} />
                {tier.name} <span className="text-[10px] text-ash">{tier.note}</span>
              </span>
              <span className="text-cream">{tier.price}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 qr-code mx-auto h-10 w-10 opacity-45" />
      </div>
    </div>
  </div>
);

const EditorialHeader = ({ eyebrow, title, action, to }: { eyebrow: string; title: string; action: string; to: string }) => (
  <section className="mx-auto max-w-1440 px-5 pb-8 pt-20 lg:px-8">
    <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-end">
      <SectionTitle eyebrow={eyebrow} title={title} />
      <Link to={to} className="btn-outline-editorial">
        {action}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </section>
);

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div>
    <p className="mb-4 font-mono-label text-fezzy-glow">{eyebrow}</p>
    <h2 className="font-display text-5xl leading-[0.9] text-cream lg:text-7xl">{title}</h2>
  </div>
);

export default Index;
