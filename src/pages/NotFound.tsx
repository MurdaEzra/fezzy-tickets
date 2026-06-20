import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, Sparkles } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-mesh">
      <main className="container-px mx-auto flex min-h-screen max-w-4xl items-center py-16">
        <section className="w-full rounded-[32px] border border-border bg-card p-8 text-center shadow-soft md:p-12">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-acacia text-4xl shadow-acacia">🧩</div>
          <p className="eyebrow mt-6">404 · lost in the fun</p>
          <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">This page wandered off the map.</h1>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">The link may have expired or the page moved. Let’s bring you back to the lively side of Fezzy.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-gradient-acacia px-5 py-3 text-sm font-semibold text-primary-foreground shadow-acacia"><Home className="h-4 w-4" /> Home</Link>
            <Link to="/help" className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-5 py-3 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Help center</Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;

