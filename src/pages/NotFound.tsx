import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, Home } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-1440 items-center px-5 py-16 lg:px-8">
        <section className="w-full border border-cream/10 bg-ink-card p-8 text-center md:p-12">
          <div className="mx-auto grid h-24 w-24 place-items-center bg-fezzy text-4xl">🧩</div>
          <p className="mt-6 font-mono-label text-fezzy-glow">404 · lost in the fun</p>
          <h1 className="mt-3 font-display text-4xl text-cream md:text-5xl">This page wandered off the map.</h1>
          <p className="mt-4 max-w-2xl mx-auto text-cream-dim">The link may have expired or the page moved. Let's bring you back to the lively side of Fezzy.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="btn-ember">
              <Home className="h-4 w-4" /> Home
            </Link>
            <Link to="/help" className="btn-outline-editorial">
              Help center <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
