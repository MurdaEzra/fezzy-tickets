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
  date: string;
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

// Prices in KES — Kenya-first.
export const events: EventItem[] = [
  {
    id: "1",
    slug: "blankets-and-wine-april",
    title: "Blankets & Wine — April Edition",
    tagline: "Sunday afternoons, soundtracked.",
    description:
      "Spread the blanket, open a bottle, and lose the afternoon to live afro-fusion sets at the Ngong Racecourse lawns. Family-friendly, picnic-ready.",
    category: "Music",
    image: jazz,
    date: "2026-04-26T14:00:00Z",
    city: "Nairobi",
    venue: "Ngong Racecourse",
    country: "Kenya",
    priceFrom: 2500,
    currency: "KES",
    featured: true,
    trending: true,
    organizer: { name: "Blankets & Wine", tag: "Verified" },
    tiers: [
      { name: "Early Bird", price: 2500, perks: ["General entry", "Picnic space"], remaining: 142 },
      { name: "Standard", price: 3500, perks: ["General entry", "Picnic space"], remaining: 480 },
      { name: "VIP Lounge", price: 8500, perks: ["VIP lounge access", "Welcome drink", "Premium washrooms"], remaining: 28 },
    ],
    lineup: ["Sauti Sol", "Nyashinski", "Bensoul", "Karun"],
  },
  {
    id: "2",
    slug: "sol-fest-naivasha-2026",
    title: "Sol Fest Naivasha 2026",
    tagline: "Three days. Lake views. Endless sound.",
    description:
      "The lakeside flagship returns with afrobeats, amapiano and indie headliners. Camping, food halls, art installations and sunrise yoga by the water.",
    category: "Festival",
    image: festival,
    date: "2026-06-19T15:00:00Z",
    endDate: "2026-06-21T23:00:00Z",
    city: "Naivasha",
    venue: "Hell's Gate Plains",
    country: "Kenya",
    priceFrom: 4500,
    currency: "KES",
    featured: true,
    trending: true,
    organizer: { name: "Solstice Collective", tag: "Verified" },
    tiers: [
      { name: "Day Pass", price: 4500, perks: ["Single day access"], remaining: 1240 },
      { name: "3-Day GA", price: 11500, perks: ["Full festival access", "Camping spot"], remaining: 480 },
      { name: "VIP", price: 28000, perks: ["VIP decks", "Private bars", "Express entry", "Lounge"], remaining: 60 },
    ],
    lineup: ["Black Coffee", "Sampa the Great", "Burna Boy", "Bien"],
  },
  {
    id: "3",
    slug: "of-light-and-form-lagos",
    title: "Of Light and Form",
    tagline: "Twelve voices, one continent.",
    description:
      "A retrospective of contemporary African art — twelve artists, eighty works. Curated walkthroughs nightly at The Yard.",
    category: "Arts",
    image: art,
    date: "2026-04-30T18:00:00Z",
    endDate: "2026-07-12T20:00:00Z",
    city: "Lagos",
    venue: "The Yard Gallery",
    country: "Nigeria",
    priceFrom: 1500,
    currency: "KES",
    featured: true,
    organizer: { name: "Yard Curatorial", tag: "Verified" },
    tiers: [
      { name: "General Admission", price: 1500, perks: ["All exhibits"], remaining: 600 },
      { name: "Curator's Tour", price: 4800, perks: ["Guided tour", "Artist Q&A", "Catalog"], remaining: 24 },
    ],
  },
  {
    id: "4",
    slug: "frontier-summit-2026",
    title: "Frontier Summit 2026",
    tagline: "African tech. One room.",
    description:
      "Two days of keynote talks, workshops and deal-making with founders, operators and investors shaping the next decade.",
    category: "Tech",
    image: tech,
    date: "2026-09-08T09:00:00Z",
    endDate: "2026-09-09T18:00:00Z",
    city: "Kigali",
    venue: "Kigali Convention Center",
    country: "Rwanda",
    priceFrom: 18500,
    currency: "KES",
    trending: true,
    organizer: { name: "Frontier Group", tag: "Verified" },
    tiers: [
      { name: "Standard", price: 18500, perks: ["All keynotes", "Exhibit hall"], remaining: 320 },
      { name: "Investor", price: 65000, perks: ["All sessions", "Deal room", "Private dinners"], remaining: 40 },
    ],
  },
  {
    id: "5",
    slug: "chefs-table-no-7",
    title: "Chef's Table, No. 7",
    tagline: "Nine courses. Candlelight. One night.",
    description:
      "A single evening, a single table, a menu written that morning. Pairings included.",
    category: "Food & Drink",
    image: food,
    date: "2026-05-22T19:30:00Z",
    city: "Cape Town",
    venue: "Salt & Smoke",
    country: "South Africa",
    priceFrom: 12000,
    currency: "KES",
    organizer: { name: "Salt & Smoke", tag: "Verified" },
    tiers: [
      { name: "Seat", price: 12000, perks: ["Nine-course menu", "Wine pairings"], remaining: 14 },
    ],
  },
  {
    id: "6",
    slug: "mashemeji-derby",
    title: "Mashemeji Derby — Gor vs AFC",
    tagline: "The rivalry. Under the lights.",
    description:
      "The biggest night in the league calendar. All stands open. Wear your colors.",
    category: "Sports",
    image: sports,
    date: "2026-08-02T16:00:00Z",
    city: "Nairobi",
    venue: "Kasarani Stadium",
    country: "Kenya",
    priceFrom: 500,
    currency: "KES",
    trending: true,
    organizer: { name: "FKF Premier League", tag: "Verified" },
    tiers: [
      { name: "Terrace", price: 500, perks: ["Open stand seating"], remaining: 8400 },
      { name: "Main Stand", price: 1500, perks: ["Covered seating"], remaining: 2200 },
      { name: "Corporate Box", price: 25000, perks: ["Private box for 4", "Catering"], remaining: 18 },
    ],
  },
];

export const categories: { name: EventCategory; emoji: string; count: number }[] = [
  { name: "Music", emoji: "🎵", count: 128 },
  { name: "Festival", emoji: "🎪", count: 32 },
  { name: "Sports", emoji: "⚽", count: 84 },
  { name: "Arts", emoji: "🎨", count: 56 },
  { name: "Tech", emoji: "💻", count: 41 },
  { name: "Food & Drink", emoji: "🍷", count: 67 },
  { name: "Nightlife", emoji: "🌙", count: 92 },
];

export const formatPrice = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });

export const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
