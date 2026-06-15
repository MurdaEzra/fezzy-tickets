import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const StartSelling = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = orgName.trim();
    if (!name) return;
    sessionStorage.setItem("pendingOrgName", name);
    navigate(`/auth?mode=signup&redirect=/dashboard&org=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl place-items-center py-12">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 shadow-soft md:p-10">
            <span className="chip"><Sparkles className="h-3 w-3 text-primary" /> Organizer setup</span>
            <h1 className="display mt-4 text-4xl text-foreground sm:text-5xl">
              Name your <span className="script font-normal text-primary text-[1.2em]">organization</span>
            </h1>
            <p className="mt-3 text-muted-foreground">
              This name will be used for your organizer profile after you create your account.
            </p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="e.g. Solstice Collective"
                  required
                />
              </div>
              <Button type="submit" variant="acacia" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue to account
              </Button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default StartSelling;
