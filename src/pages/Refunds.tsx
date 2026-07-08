import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Refunds = () => (
  <div className="fezzy-editorial min-h-screen bg-ink text-cream">
    <Navbar />
    <main className="mx-auto max-w-1440 px-5 py-16 md:py-24 lg:px-8">
      <div className="max-w-3xl">
        <p className="mb-4 font-mono-label text-fezzy-glow">Legal</p>
        <h1 className="font-display text-5xl text-cream sm:text-6xl">Refunds, Returns & Cancellation Policy</h1>
        <p className="mt-4 font-mono-label text-ash">Effective Date: July 8, 2026</p>

        <article className="mt-12 max-w-none space-y-8 text-sm leading-relaxed text-cream-dim">
          <section>
            <h2 className="font-display text-2xl text-cream">1. Nature of Digital Tickets</h2>
            <p className="mt-3">Tickets sold through Fezzy Tickets are digital products granting access to specific events.</p>
            <p className="mt-3">Because tickets reserve event capacity and are time-sensitive, refunds are subject to the conditions outlined below.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">2. Eligible Refund Scenarios</h2>
            <p className="mt-3">Customers may be eligible for refunds where:</p>
            
            <div className="mt-4 space-y-4 pl-4 border-l border-cream/10">
              <h3 className="font-display text-lg text-cream">Event Cancellation</h3>
              <p className="text-cream-dim">If an event is cancelled and not rescheduled:</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li>Customers may receive a full refund of the ticket purchase price.</li>
                <li>Processing fees may be refunded at Fezzy Tickets' discretion or according to organizer agreements.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">Duplicate Transactions</h3>
              <p className="text-cream-dim">If a customer is charged multiple times for the same purchase due to a technical error, duplicate payments may be refunded after verification.</p>

              <h3 className="font-display text-lg text-cream mt-6">Non-Delivery of Tickets</h3>
              <p className="text-cream-dim">Where payment has been successfully completed but no valid ticket was delivered, Fezzy Tickets will investigate and either:</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li>Deliver the valid ticket, or</li>
                <li>Issue a refund where appropriate.</li>
              </ul>

              <h3 className="font-display text-lg text-cream mt-6">Unauthorized Transactions</h3>
              <p className="text-cream-dim">Verified fraudulent or unauthorized purchases may qualify for refunds following investigation.</p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">3. Non-Refundable Situations</h2>
            <p className="mt-3">Refunds are generally not available for:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Change of mind purchases.</li>
              <li>Failure to attend an event.</li>
              <li>Scheduling conflicts.</li>
              <li>Customer transportation issues.</li>
              <li>Weather conditions unless the event is cancelled.</li>
              <li>Violations of event rules resulting in denied entry.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">4. Event Rescheduling</h2>
            <p className="mt-3">If an event is rescheduled:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Tickets generally remain valid for the new date.</li>
              <li>Refund eligibility will depend on organizer policies and applicable laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">5. Ticket Resale Transactions</h2>
            <p className="mt-3">For tickets purchased through the Fezzy Tickets resale marketplace:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Completed resale transactions are generally final.</li>
              <li>Refunds may be available where fraud, technical failures, or invalid ticket issuance is confirmed.</li>
              <li>Fezzy Tickets may reverse fraudulent resale transactions where necessary.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">6. Chargebacks</h2>
            <p className="mt-3">Customers should contact Fezzy Tickets before initiating chargebacks.</p>
            <p className="mt-3">Fraudulent or abusive chargebacks may result in:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Account restrictions.</li>
              <li>Account suspension.</li>
              <li>Investigation of future purchases.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">7. Refund Processing</h2>
            <p className="mt-3">Approved refunds are processed to the original payment method whenever possible.</p>
            <p className="mt-3">Processing times may vary depending on:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Payment provider requirements.</li>
              <li>Banking networks.</li>
              <li>Mobile money providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">8. Dispute Resolution</h2>
            <p className="mt-3">Customers may submit disputes through Fezzy Tickets customer support.</p>
            <p className="mt-3">Each dispute is reviewed using:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Payment records.</li>
              <li>Ticket ownership records.</li>
              <li>Event organizer information.</li>
              <li>System audit logs.</li>
              <li>Ticket validation history.</li>
            </ul>
            <p className="mt-3">Fezzy Tickets aims to resolve disputes fairly and efficiently while protecting customers, event organizers, and platform integrity.</p>
          </section>
        </article>
      </div>
    </main>
    <Footer />
  </div>
);

export default Refunds;
