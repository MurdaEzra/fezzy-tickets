import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const BecomeOrganizer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    const existing = sessionStorage.getItem("pendingOrgName");
    if (existing) setOrgName(existing);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = orgName.trim();
    if (!name) return;
    sessionStorage.setItem("pendingOrgName", name);
    navigate("/pricing?becoming=1");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center py-16">
          <div className="w-full rounded-3xl border border-border bg-card p-8 shadow-soft md:p-12">
            <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> First event is free</span>
            <h1 className="display mt-4 text-4xl text-foreground sm:text-5xl">
              Become an <span className="script font-normal text-primary text-[1.2em]">organizer</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              Start with the name of your organization. We'll show it across your dashboard and event pages.
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <Label htmlFor="org">Organization name</Label>
                <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Solstice Collective" required />
              </div>
              <Button type="submit" variant="acacia" size="lg" className="w-full">
                Choose your plan <ArrowRight className="h-4 w-4" />
              </Button>
              {!user && (
                <p className="text-center text-xs text-muted-foreground">
                  You'll create your account after choosing a plan.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BecomeOrganizer;
