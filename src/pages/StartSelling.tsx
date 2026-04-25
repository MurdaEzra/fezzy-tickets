import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const STEPS = ["You", "Your event", "Almost done"] as const;

const StartSelling = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    name: (user?.user_metadata as { full_name?: string })?.full_name ?? "",
    email: user?.email ?? "",
    phone: "",
    org: "",
    country: "Kenya",
    eventName: "",
    category: "Music",
    expected: "",
    city: "",
    desc: "",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1100));
    setSubmitting(false);
    setDone(true);
    toast.success("Application received!", { description: "We'll be in touch within one business day." });
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container-px mx-auto max-w-2xl py-20 text-center">
          <div className="rounded-3xl border border-border bg-card p-10 shadow-soft md:p-14">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="display mt-6 text-4xl font-bold text-foreground sm:text-5xl">
              We'll be in <span className="script font-normal text-primary text-[1.2em]">touch</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Thanks {form.name.split(" ")[0] || "there"}! A Fezzy partner manager will reach you at{" "}
              <span className="text-foreground font-medium">{form.email}</span> within one business day.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="acacia" size="lg" asChild><Link to="/organizer">Back to Organizers</Link></Button>
              <Button variant="outline" size="lg" asChild><Link to="/events">Browse events</Link></Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto max-w-3xl py-12 md:py-16">
          <Link to="/organizer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Organizers
          </Link>
          <h1 className="display mt-6 text-4xl text-foreground sm:text-5xl">
            Let's get you <span className="script font-normal text-primary text-[1.2em]">selling</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Tell us a bit about you and your event. Takes about 2 minutes.
          </p>

          {/* Stepper */}
          <ol className="mt-10 flex items-center gap-3">
            {STEPS.map((s, i) => {
              const active = i === step;
              const complete = i < step;
              return (
                <li key={s} className="flex flex-1 items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-colors ${
                    complete ? "bg-primary text-primary-foreground" :
                    active ? "bg-foreground text-background" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {complete ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`hidden text-sm font-semibold sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
                </li>
              );
            })}
          </ol>

          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-9">
            {step === 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor="n">Full name</Label><Input id="n" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Wanjiku Mwangi" required /></div>
                <div><Label htmlFor="e">Email</Label><Input id="e" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></div>
                <div><Label htmlFor="p">Phone number</Label><Input id="p" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+254 712 345 678" required /></div>
                <div><Label htmlFor="o">Organization</Label><Input id="o" value={form.org} onChange={(e) => update("org", e.target.value)} placeholder="Solstice Collective" /></div>
                <div><Label htmlFor="c">Country</Label><Input id="c" value={form.country} onChange={(e) => update("country", e.target.value)} required /></div>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor="ev">Event name</Label><Input id="ev" value={form.eventName} onChange={(e) => update("eventName", e.target.value)} placeholder="Sol Fest Naivasha 2026" required /></div>
                <div>
                  <Label htmlFor="cat">Category</Label>
                  <select id="cat" value={form.category} onChange={(e) => update("category", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {["Music", "Festival", "Sports", "Arts", "Tech", "Food & Drink", "Nightlife"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="ci">City</Label><Input id="ci" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Nairobi" required /></div>
                <div className="sm:col-span-2"><Label htmlFor="ex">Expected attendance</Label><Input id="ex" value={form.expected} onChange={(e) => update("expected", e.target.value)} placeholder="e.g. 1,500" /></div>
                <div className="sm:col-span-2"><Label htmlFor="d">Tell us about your event</Label><Textarea id="d" value={form.desc} onChange={(e) => update("desc", e.target.value)} rows={4} placeholder="Vibe, lineup, vision…" /></div>
              </div>
            )}
            {step === 2 && (
              <div>
                <h3 className="font-display text-xl font-bold">Review</h3>
                <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background">
                  {[
                    ["Organizer", `${form.name}${form.org ? ` · ${form.org}` : ""}`],
                    ["Email", form.email],
                    ["Phone", form.phone || "—"],
                    ["Country", form.country],
                    ["Event", form.eventName],
                    ["Category", form.category],
                    ["City", form.city],
                    ["Expected attendance", form.expected || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">By submitting, you agree to our terms and our 5% platform fee model.</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button variant="acacia" onClick={next}>Continue</Button>
            ) : (
              <Button variant="acacia" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit application
              </Button>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default StartSelling;
