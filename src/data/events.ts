import jazz from "@/assets/event-jazz.jpg";
import festival from "@/assets/event-festival.jpg";
import art from "@/assets/event-art.jpg";
import tech from "@/assets/event-tech.jpg";
import food from "@/assets/event-food.jpg";
import sports from "@/assets/event-sports.jpg";

export type EventCategory =
  | "Music"
  | "Festival"
  | "Sports"
  | "Arts"
  | "Tech"
  | "Food & Drink"
  | "Nightlife";

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: EventCategory;
  image: string;
  date: string; // ISO
  endDate?: string;
  city: string;
  venue: string;
  country: string;
  priceFrom: number;
  currency: string;
  featured?: boolean;
  trending?: boolean;
  organizer: { name: string; tag: string };
  tiers: { name: string; price: number; perks: string[]; remaining: number }[];
  lineup?: string[];
}

export const events: EventItem[] = [
  {
    id: "1",
    slug: "midnight-sessions-vol-iv",
    title: "Midnight Sessions, Vol. IV",
    tagline: "An intimate jazz night under amber light",
    description:
      "A curated evening of contemporary jazz featuring rising voices and seasoned virtuosos. Doors at 8, first set at 9. Limited seating, full sound.",
    category: "Music",
    image: jazz,
    date: "2026-05-14T20:00:00Z",
    city: "Nairobi",
    venue: "The Alchemist Cellar",
    country: "Kenya",
    priceFrom: 35,
    currency: "USD",
    featured: true,
    trending: true,
    organizer: { name: "Sessions Collective", tag: "Verified" },
    tiers: [
      { name: "General", price: 35, perks: ["Standing room", "Welcome drink"], remaining: 142 },
      { name: "Reserved", price: 65, perks: ["Reserved seating", "Welcome drink", "Cloakroom"], remaining: 48 },
      { name: "Front Row", price: 120, perks: ["Front row seat", "Meet the artists", "Signed program"], remaining: 8 },
    ],
    lineup: ["Aluna Quartet", "Idris Adan", "Maya Sol Trio"],
  },
  {
    id: "2",
    slug: "solstice-festival-2026",
    title: "Solstice Festival 2026",
    tagline: "Three days. One horizon. Endless sound.",
    description:
      "The flagship summer gathering returns with a headline-strong lineup spanning electronic, afrobeats and indie. Camping, food halls and lake-side stages.",
    category: "Festival",
    image: festival,
    date: "2026-06-19T15:00:00Z",
    endDate: "2026-06-21T23:00:00Z",
    city: "Naivasha",
    venue: "Hell's Gate Plains",
    country: "Kenya",
    priceFrom: 95,
    currency: "USD",
    featured: true,
    trending: true,
    organizer: { name: "Solstice Collective", tag: "Verified" },
    tiers: [
      { name: "Day Pass", price: 95, perks: ["Single day access"], remaining: 1240 },
      { name: "3-Day GA", price: 220, perks: ["Full festival access", "Camping spot"], remaining: 480 },
      { name: "VIP", price: 520, perks: ["VIP viewing decks", "Private bars", "Express entry", "Lounge access"], remaining: 60 },
    ],
    lineup: ["Black Coffee", "Sampa the Great", "Burna Boy", "Romy"],
  },
  {
    id: "3",
    slug: "of-light-and-form",
    title: "Of Light and Form",
    tagline: "A retrospective of contemporary African art",
    description:
      "Twelve artists, eighty works, one continent's bold new voice. Curated walkthroughs nightly.",
    category: "Arts",
    image: art,
    date: "2026-04-30T18:00:00Z",
    endDate: "2026-07-12T20:00:00Z",
    city: "Lagos",
    venue: "The Yard Gallery",
    country: "Nigeria",
    priceFrom: 18,
    currency: "USD",
    featured: true,
    organizer: { name: "Yard Curatorial", tag: "Verified" },
    tiers: [
      { name: "General Admission", price: 18, perks: ["All exhibits"], remaining: 600 },
      { name: "Curator's Tour", price: 55, perks: ["Guided tour", "Artist Q&A", "Catalog"], remaining: 24 },
    ],
  },
  {
    id: "4",
    slug: "frontier-summit-2026",
    title: "Frontier Summit 2026",
    tagline: "The future of African tech, in one room",
    description:
      "Two days of keynote talks, workshops and deal-making with founders, operators and investors shaping the next decade.",
    category: "Tech",
    image: tech,
    date: "2026-09-08T09:00:00Z",
    endDate: "2026-09-09T18:00:00Z",
    city: "Kigali",
    venue: "Kigali Convention Center",
    country: "Rwanda",
    priceFrom: 240,
    currency: "USD",
    trending: true,
    organizer: { name: "Frontier Group", tag: "Verified" },
    tiers: [
      { name: "Standard", price: 240, perks: ["All keynotes", "Exhibit hall"], remaining: 320 },
      { name: "Investor Pass", price: 780, perks: ["All sessions", "Deal room", "Private dinners"], remaining: 40 },
    ],
  },
  {
    id: "5",
    slug: "chefs-table-no-7",
    title: "Chef's Table, No. 7",
    tagline: "A nine-course tasting by candlelight",
    description:
      "A single evening, a single table, a menu written that morning. Pairings included.",
    category: "Food & Drink",
    image: food,
    date: "2026-05-22T19:30:00Z",
    city: "Cape Town",
    venue: "Salt & Smoke",
    country: "South Africa",
    priceFrom: 145,
    currency: "USD",
    organizer: { name: "Salt & Smoke", tag: "Verified" },
    tiers: [
      { name: "Seat", price: 145, perks: ["Nine-course menu", "Wine pairings"], remaining: 14 },
    ],
  },
  {
    id: "6",
    slug: "derby-night-classico",
    title: "Derby Night — Clásico",
    tagline: "The rivalry returns under the floodlights",
    description:
      "The biggest night in the league calendar. All stands open. Wear your colors.",
    category: "Sports",
    image: sports,
    date: "2026-08-02T21:00:00Z",
    city: "Nairobi",
    venue: "Kasarani Stadium",
    country: "Kenya",
    priceFrom: 12,
    currency: "USD",
    trending: true,
    organizer: { name: "Premier League KE", tag: "Verified" },
    tiers: [
      { name: "Terrace", price: 12, perks: ["Open stand seating"], remaining: 8400 },
      { name: "Main Stand", price: 38, perks: ["Covered seating"], remaining: 2200 },
      { name: "Corporate Box", price: 220, perks: ["Private box for 4", "Catering"], remaining: 18 },
    ],
  },
];

export const categories: { name: EventCategory; count: number }[] = [
  { name: "Music", count: 128 },
  { name: "Festival", count: 32 },
  { name: "Sports", count: 84 },
  { name: "Arts", count: 56 },
  { name: "Tech", count: 41 },
  { name: "Food & Drink", count: 67 },
  { name: "Nightlife", count: 92 },
];

export const formatPrice = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
