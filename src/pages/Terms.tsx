import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => (
  <div className="tm-page min-h-screen bg-background">
    <Navbar />
    <main className="container-px mx-auto max-w-3xl py-16 md:py-24">
      <p className="eyebrow mb-3">Legal</p>
      <h1 className="display text-5xl text-foreground sm:text-6xl">Terms & Conditions</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: June 7, 2026</p>

      <article className="prose prose-neutral mt-12 max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">1. Acceptance</h2>
          <p className="mt-3">By creating an account, purchasing a ticket, or listing an event on Fezzy Tickets ("Fezzy", "we", "us"), you agree to these Terms & Conditions and the Privacy Policy. If you do not agree, do not use the platform.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">2. The service</h2>
          <p className="mt-3">Fezzy is a self-service ticketing marketplace connecting event organizers ("Organizers") with attendees ("Buyers"). Fezzy provides the technology that lists events, processes payments, issues digital tickets, and handles entry validation. Fezzy is not the organizer, producer, owner, or operator of any event listed on the platform.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">3. Accounts</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>You must be at least 18 years old, or have the consent of a parent or legal guardian, to create an account.</li>
            <li>You are responsible for the security of your login credentials and for all activity on your account.</li>
            <li>You agree to provide accurate, current, and complete information and to keep it updated.</li>
            <li>We may suspend or terminate accounts that violate these Terms, applicable law, or platform policies.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">4. Buyer terms</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Tickets are issued as QR-encoded digital passes. You are responsible for keeping them secure; screenshots and printed copies are accepted at the gate, but the first valid scan wins.</li>
            <li>All ticket sales are between you and the Organizer. The refund window, transfer rules, and entry policy are set by the Organizer and published on the event page.</li>
            <li>You agree that a 3.5% buyer service fee is added to the listed ticket subtotal during checkout.</li>
            <li>You must not resell tickets above face value unless the Organizer explicitly authorizes it. Tickets sold or transferred outside Fezzy may be invalidated without refund.</li>
            <li>Entry is subject to the Organizer's house rules, venue rules, and applicable law. Refusal of entry by the Organizer or venue is not refundable by Fezzy.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">5. Organizer terms</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>You are solely responsible for the event you list — licensing, safety, insurance, taxes, age restrictions, refund handling, and delivery of the experience promised.</li>
            <li>You must accurately describe the event, venue, dates, tier inclusions, capacity, and refund policy.</li>
            <li>You must hold all rights necessary to use the images, music, names, trademarks, and other assets you upload (including posters and banners). Fezzy may remove content that infringes third-party rights.</li>
            <li>Fezzy applies a 3.5% buyer service fee to ticket orders during checkout.</li>
            <li>Payouts are split instantly at the moment of payment using Paystack subaccounts. Fezzy does not hold organizer funds.</li>
            <li>You authorize Fezzy to send your buyers ticket-delivery and event-update emails on your behalf, and to display your event and brand on the public marketplace and partner channels.</li>
            <li>You must not list illegal, prohibited, dangerous, hateful, or fraudulent events. Fezzy may unlist any event at its sole discretion, including post-publication.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">6. Fees & payments</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Buyers pay the listed ticket subtotal plus a 3.5% buyer service fee.</li>
            <li>The buyer service fee is calculated from the ticket subtotal and shown before payment.</li>
            <li>Payment-processor fees charged by Paystack are deducted from the Organizer's share unless explicitly noted otherwise.</li>
            <li>All prices are denominated in Kenyan Shillings (KES) unless stated otherwise. Currency conversion, if any, is performed by the payment processor at the rate in effect at the time of payment.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">7. Cancellations & refunds</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>If an Organizer cancels an event, the Organizer is responsible for refunding ticket holders. Fezzy will assist in processing the refund through Paystack.</li>
            <li>If an Organizer postpones an event, existing tickets remain valid for the rescheduled date unless the Organizer publishes a different policy.</li>
            <li>Buyer-initiated refunds are subject to the refund window the Organizer sets on the event page.</li>
            <li>Fezzy is not liable to refund service fees on events that were already fulfilled or that were materially delivered as described.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">8. Prohibited use</h2>
          <p className="mt-3">You agree not to: reverse-engineer or attempt to circumvent the QR-validation system; scrape, copy, or republish event data without authorization; impersonate another person or organization; transmit malware; use the platform to launder funds, fund prohibited activities, or evade tax; or interfere with the operation of the platform.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">9. Intellectual property</h2>
          <p className="mt-3">Fezzy and its logos, layouts, designs, and codebase are the property of Fezzy Tickets and its licensors. Organizers retain ownership of the content they upload but grant Fezzy a worldwide, royalty-free license to host, display, and distribute that content for the purpose of running and promoting the event listings.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">10. Disclaimer & liability</h2>
          <p className="mt-3">The service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Fezzy is not liable for indirect, incidental, consequential, special, or exemplary damages, or for any loss arising from cancelled, postponed, or poorly run events. Our aggregate liability to you for any claim arising from the service shall not exceed the amount of service fees you paid to Fezzy in the 12 months preceding the claim.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">11. Indemnity</h2>
          <p className="mt-3">You agree to indemnify and hold Fezzy harmless from any claim, demand, loss, or expense arising out of your event, your content, your breach of these Terms, or your violation of any law or third-party right.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">12. Governing law</h2>
          <p className="mt-3">These Terms are governed by the laws of the Republic of Kenya. Disputes shall be submitted to the exclusive jurisdiction of the courts of Nairobi.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">13. Changes</h2>
          <p className="mt-3">We may update these Terms from time to time. Material changes will be communicated by email or via an in-app notice. Continued use of the service after an update constitutes acceptance of the revised Terms.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">14. Contact</h2>
          <p className="mt-3">Questions about these Terms? Reach us at <a href="mailto:legal@fezzy.app" className="font-semibold text-primary hover:underline">legal@fezzy.app</a>.</p>
        </section>
      </article>
    </main>
    <Footer />
  </div>
);

export default Terms;

