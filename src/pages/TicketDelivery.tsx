import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TicketDelivery = () => (
  <div className="fezzy-editorial min-h-screen bg-ink text-cream">
    <Navbar />
    <main className="mx-auto max-w-1440 px-5 py-16 md:py-24 lg:px-8">
      <div className="max-w-3xl">
        <p className="mb-4 font-mono-label text-fezzy-glow">Legal</p>
        <h1 className="font-display text-5xl text-cream sm:text-6xl">Ticket Delivery Policy</h1>
        <p className="mt-4 font-mono-label text-ash">Effective Date: July 8, 2026</p>

        <article className="mt-12 max-w-none space-y-8 text-sm leading-relaxed text-cream-dim">
          <section>
            <h2 className="font-display text-2xl text-cream">1. Digital Delivery Model</h2>
            <p className="mt-3">Fezzy Tickets operates exclusively as a digital ticketing platform. Physical tickets are not shipped unless explicitly stated by an event organizer.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">2. Ticket Issuance</h2>
            <p className="mt-3">Upon successful payment:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>A unique electronic ticket is generated.</li>
              <li>A unique QR code is assigned to each ticket.</li>
              <li>Ticket details are recorded within the Fezzy Tickets system.</li>
              <li>The ticket is delivered electronically to the purchaser.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">3. Delivery Methods</h2>
            <p className="mt-3">Tickets may be delivered through:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Email.</li>
              <li>User account dashboard.</li>
              <li>SMS notification where available.</li>
              <li>Downloadable ticket documents.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">4. Delivery Time</h2>
            <p className="mt-3">Most tickets are delivered immediately after payment confirmation.</p>
            <p className="mt-3">Delivery times may vary if:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Payment verification is required.</li>
              <li>Fraud screening is in progress.</li>
              <li>Technical interruptions occur.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">5. Customer Responsibilities</h2>
            <p className="mt-3">Customers must:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide accurate contact information.</li>
              <li>Ensure access to the email address used during purchase.</li>
              <li>Review ticket details immediately upon receipt.</li>
              <li>Contact support promptly if tickets are not received.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">6. Resold Tickets</h2>
            <p className="mt-3">Where ticket resale is permitted:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>The original ticket is automatically invalidated after a successful resale.</li>
              <li>A new ticket is generated for the buyer.</li>
              <li>A new QR code is issued.</li>
              <li>System records maintain the ownership history of the ticket.</li>
            </ul>
            <p className="mt-3">Only the most recently issued ticket remains valid for event entry.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">7. Event Entry</h2>
            <p className="mt-3">Event admission remains subject to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Event organizer rules.</li>
              <li>Venue policies.</li>
              <li>Security requirements.</li>
              <li>Ticket validation at the point of entry.</li>
            </ul>
            <p className="mt-3">Possession of a ticket does not guarantee entry where venue capacity limits or security restrictions apply.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">8. Technical Issues</h2>
            <p className="mt-3">Customers experiencing ticket access issues should contact Fezzy Tickets support before the event date whenever possible.</p>
          </section>
        </article>
      </div>
    </main>
    <Footer />
  </div>
);

export default TicketDelivery;
