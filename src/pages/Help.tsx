import { Headphones, ShieldCheck, Sparkles, Ticket, Users } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const supportCards: Array<{ icon: typeof Headphones; title: string; text: string }> = [
  { icon: Headphones, title: "Live support", text: "Reach out to the Fezzy team anytime for event or payout help." },
  { icon: ShieldCheck, title: "Secure payouts", text: "Keep your payout setup current with M-Pesa, till, or bank options." },
  { icon: Sparkles, title: "Creative design", text: "Use the ticket designer and banner tools to make every event feel premium." },
];

const faqs = [
  {
    q: "How do I invite another organizer admin?",
    a: "Open the Team & admins page in your dashboard, create an invite, and share the link. It expires automatically after 7 days.",
  },
  {
    q: "Can I choose M-Pesa or a till number for payouts?",
    a: "Yes. In Payout, choose the method that fits your shop and save your M-Pesa number or till number to receive payouts.",
  },
  {
    q: "Can I customize the ticket appearance?",
    a: "Absolutely. The event editor lets you switch ticket themes, accents, patterns, and seat arrangement before you publish.",
  },
];

const Help = () => (
  <div className="fezzy-editorial min-h-screen bg-ink text-cream">
    <Navbar />
    <main className="mx-auto max-w-1440 px-5 py-10 md:py-14 lg:px-8">
      <section className="border border-cream/10 bg-ink-card p-8 md:p-10">
        <p className="font-mono-label text-fezzy-glow">Support hub</p>
        <h1 className="mt-3 font-display text-4xl text-cream md:text-5xl">Help for organizers and guests</h1>
        <p className="mt-4 max-w-3xl text-cream-dim">Find quick answers, manage payout options, invite co-admins, and polish your event pages in one place.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {supportCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="border border-cream/10 bg-ink-soft p-5">
                <Icon className="h-6 w-6 text-fezzy" />
                <h2 className="mt-3 font-display text-xl text-cream">{item.title}</h2>
                <p className="mt-2 text-sm text-cream-dim">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="border border-cream/10 bg-ink-card p-8">
          <h2 className="font-display text-2xl text-cream">Frequently asked questions</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((item) => (
              <details key={item.q} className="border border-cream/10 bg-ink-soft p-4">
                <summary className="cursor-pointer list-none font-semibold text-cream">{item.q}</summary>
                <p className="mt-3 text-sm text-cream-dim">{item.a}</p>
              </details>
            ))}
          </div>
        </article>

        <article className="border border-cream/10 bg-ink-card p-8">
          <h2 className="font-display text-2xl text-cream">Need a hand?</h2>
          <p className="mt-3 text-sm text-cream-dim">We're here to help with admin access, ticket design, payouts, and event publishing.</p>
          <ul className="mt-5 space-y-3 text-sm text-cream">
            <li className="flex items-center gap-3 border border-cream/10 bg-ink-soft p-3"><Users className="h-4 w-4 text-fezzy" /> Invite co-admins from the Team menu.</li>
            <li className="flex items-center gap-3 border border-cream/10 bg-ink-soft p-3"><Ticket className="h-4 w-4 text-fezzy" /> Customize ticket layouts and seat styles before publishing.</li>
            <li className="flex items-center gap-3 border border-cream/10 bg-ink-soft p-3"><Sparkles className="h-4 w-4 text-fezzy" /> Update posters, banners, and payout setup in one dashboard.</li>
          </ul>
        </article>
      </section>
    </main>
    <Footer />
  </div>
);

export default Help;
