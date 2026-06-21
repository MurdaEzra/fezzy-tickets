import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Privacy = () => (
  <div className="fezzy-editorial min-h-screen bg-ink text-cream">
    <Navbar />
    <main className="mx-auto max-w-1440 px-5 py-16 md:py-24 lg:px-8">
      <div className="max-w-3xl">
        <p className="mb-4 font-mono-label text-fezzy-glow">Legal</p>
        <h1 className="font-display text-5xl text-cream sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 font-mono-label text-ash">Last updated: June 7, 2026</p>

        <article className="mt-12 max-w-none space-y-8 text-sm leading-relaxed text-cream-dim">
          <section>
            <h2 className="font-display text-2xl text-cream">1. Who we are</h2>
            <p className="mt-3">Fezzy Tickets ("Fezzy", "we", "us") operates the Fezzy Tickets platform. This policy explains what personal data we collect, why we collect it, how we use it, and the rights you have over it.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">2. Data we collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-cream">Account data:</strong> name, email, phone, country, password hash, and the date you created your account.</li>
              <li><strong className="text-cream">Ticket data:</strong> the events you browse, the tiers you select, the orders you place, the QR tokens issued to you, and the entry-scan timestamps.</li>
              <li><strong className="text-cream">Organizer data:</strong> organization name, public handle, contact details, bio, logo, bank or M-Pesa subaccount metadata held by our payment processor, and platform fee history.</li>
              <li><strong className="text-cream">Payment data:</strong> we never store full card numbers. Paystack handles card and M-Pesa details directly; we receive a payment reference, the amount, the status, and the masked instrument used.</li>
              <li><strong className="text-cream">Device data:</strong> IP address, browser type, device type, language, and basic usage analytics needed to operate and protect the service.</li>
              <li><strong className="text-cream">Optional marketing data:</strong> if you opt in, we record your consent timestamp and the source of the opt-in.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">3. How we use it</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To create your account, authenticate you, and recover access.</li>
              <li>To process orders, generate tickets, validate entry, and send ticket-delivery emails.</li>
              <li>To pay organizers and reconcile platform fees.</li>
              <li>To prevent fraud, detect abuse, and meet our legal obligations.</li>
              <li>To send service emails (receipts, ticket delivery, important changes) regardless of marketing opt-in.</li>
              <li>To send marketing or promotional emails <em>only</em> if you opted in.</li>
              <li>To improve the product through aggregate analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">4. Legal bases</h2>
            <p className="mt-3">We process personal data on the legal bases of contract performance (ticket purchases and account use), legitimate interest (fraud prevention, product analytics), consent (marketing communications), and legal obligation (tax, accounting, law-enforcement requests).</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">5. Sharing</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-cream">Organizers</strong> of events you buy tickets to receive the ticket-holder name, email, phone, tier, and order reference, so they can communicate with you and validate entry.</li>
              <li><strong className="text-cream">Payment processors</strong> (Paystack) receive the data needed to process your payment and split funds to the organizer's subaccount.</li>
              <li><strong className="text-cream">Email delivery</strong> (Brevo) receives recipient address and email content needed to send ticket-delivery and account emails.</li>
              <li><strong className="text-cream">Cloud infrastructure</strong> (Supabase, Lovable Cloud) hosts our database and edge functions under data-processing agreements.</li>
              <li><strong className="text-cream">Authorities</strong> when we are legally required to disclose information.</li>
            </ul>
            <p className="mt-3">We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">6. Cookies & similar tech</h2>
            <p className="mt-3">We use strictly necessary cookies to keep you signed in, remember your cart, and secure the service. We use lightweight analytics cookies only with your consent.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">7. Retention</h2>
            <p className="mt-3">We keep your account data while your account is active. Ticket and payment records are retained for at least seven (7) years to meet tax and accounting requirements. You can request deletion of your account at any time; certain records will be retained where the law requires.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">8. Your rights</h2>
            <p className="mt-3">Depending on where you live, you may have the right to access, correct, export, restrict, object to, or delete your personal data, and to withdraw consent for marketing at any time. To exercise these rights, email <a href="mailto:privacy@fezzy.app" className="font-semibold text-fezzy hover:text-lime">privacy@fezzy.app</a>. We may need to verify your identity before acting on a request.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">9. Security</h2>
            <p className="mt-3">We use TLS in transit, encrypted storage at rest, row-level security in the database, signed JWT-based authentication, and short-lived QR tokens for entry. No system is perfectly secure; if a breach affects you, we will notify you and the relevant authority as required by law.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">10. International transfers</h2>
            <p className="mt-3">Some of our processors are based outside Kenya. When personal data is transferred internationally, we rely on standard contractual clauses or equivalent safeguards.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">11. Children</h2>
            <p className="mt-3">The service is intended for users aged 18 and over. We do not knowingly collect personal data from children under the age of 13. If you believe a child has provided us with personal data, contact us so we can delete it.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">12. Changes</h2>
            <p className="mt-3">If we update this policy, we will revise the "last updated" date and, for material changes, notify you by email or via an in-app notice.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl text-cream">13. Contact</h2>
            <p className="mt-3">Privacy questions or requests: <a href="mailto:privacy@fezzy.app" className="font-semibold text-fezzy hover:text-lime">privacy@fezzy.app</a>.</p>
          </section>
        </article>
      </div>
    </main>
    <Footer />
  </div>
);

export default Privacy;
