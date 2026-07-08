import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const AcceptableUse = () => (
  <div className="fezzy-editorial min-h-screen bg-ink text-cream">
    <Navbar />
    <main className="mx-auto max-w-1440 px-5 py-16 md:py-24 lg:px-8">
      <div className="max-w-3xl">
        <p className="mb-4 font-mono-label text-fezzy-glow">Legal</p>
        <h1 className="font-display text-5xl text-cream sm:text-6xl">Acceptable Use Policy</h1>
        <p className="mt-4 font-mono-label text-ash">Effective Date: July 8, 2026</p>

        <article className="mt-12 max-w-none space-y-8 text-sm leading-relaxed text-cream-dim">
          <section>
            <h2 className="font-display text-2xl text-cream">1. Purpose</h2>
            <p className="mt-3">This Acceptable Use Policy governs the use of the Fezzy Tickets platform by event organizers, ticket sellers, buyers, affiliates, and all other users. The purpose of this policy is to maintain a safe, lawful, and trustworthy marketplace for event ticket transactions.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">2. Prohibited Activities</h2>
            <p className="mt-3">Users may not use Fezzy Tickets to:</p>
            
            <div className="mt-4 space-y-4 pl-4 border-l border-cream/10">
              <h3 className="font-display text-lg text-cream">2.1 Illegal Activities</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>Promote, facilitate, or engage in unlawful activities.</li>
                <li>Sell tickets for events that violate applicable laws or regulations.</li>
                <li>Conduct fraudulent, deceptive, or misleading business practices.</li>
                <li>Engage in money laundering, terrorist financing, or other financial crimes.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">2.2 Unauthorized Ticket Sales</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>Sell tickets without authorization from the event organizer where authorization is required.</li>
                <li>List counterfeit, duplicated, stolen, or invalid tickets.</li>
                <li>Misrepresent ticket ownership or transfer rights.</li>
                <li>Sell tickets that have already been used or redeemed.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">2.3 Fraudulent Conduct</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>Create fake organizer accounts.</li>
                <li>Use stolen payment methods.</li>
                <li>Submit false identity information.</li>
                <li>Manipulate ticket inventory, pricing, reviews, or event details.</li>
                <li>Attempt chargeback fraud or payment abuse.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">2.4 Restricted Events</h3>
              <p className="text-cream-dim">Fezzy Tickets reserves the right to prohibit events involving:</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li>Illegal gambling activities.</li>
                <li>Hate speech or extremist activities.</li>
                <li>Illegal substances.</li>
                <li>Human trafficking or exploitation.</li>
                <li>Unauthorized investment schemes.</li>
                <li>Any activity prohibited by applicable law.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">2.5 Platform Abuse</h3>
              <p className="text-cream-dim">Users may not:</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li>Attempt to gain unauthorized access to systems.</li>
                <li>Introduce malware or harmful software.</li>
                <li>Interfere with platform operations.</li>
                <li>Scrape, harvest, or misuse platform data.</li>
                <li>Circumvent security controls.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">3. Organizer Responsibilities</h2>
            <p className="mt-3">Event organizers must:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide accurate event information.</li>
              <li>Hold all required licenses and permits.</li>
              <li>Honor valid tickets sold through the platform.</li>
              <li>Maintain accurate venue, date, and pricing information.</li>
              <li>Notify Fezzy Tickets immediately of event changes.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">4. Verification and Compliance</h2>
            <p className="mt-3">Fezzy Tickets may:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Request identity verification documents.</li>
              <li>Request business registration documents.</li>
              <li>Conduct enhanced due diligence reviews.</li>
              <li>Suspend listings pending verification.</li>
              <li>Refuse service to high-risk or non-compliant users.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">5. Monitoring and Enforcement</h2>
            <p className="mt-3">Fezzy Tickets reserves the right to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Remove listings.</li>
              <li>Suspend accounts.</li>
              <li>Cancel transactions.</li>
              <li>Withhold payouts pending investigation.</li>
              <li>Report illegal activities to relevant authorities.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">6. Violations</h2>
            <p className="mt-3">Violations of this policy may result in:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Listing removal.</li>
              <li>Account suspension.</li>
              <li>Permanent account termination.</li>
              <li>Payment withholding where permitted by law.</li>
              <li>Legal action where necessary.</li>
            </ul>
            <p className="mt-6 text-cream font-medium">By using Fezzy Tickets, users agree to comply with this Acceptable Use Policy.</p>
          </section>
        </article>
      </div>
    </main>
    <Footer />
  </div>
);

export default AcceptableUse;
