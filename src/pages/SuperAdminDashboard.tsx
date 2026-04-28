import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";

const SuperAdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: Replace with real super admin check
    if (!loading && (!user || user.email !== "admin@fezzy.app")) {
      navigate("/auth?mode=signin", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container-px mx-auto max-w-7xl py-16">
        <h1 className="display text-4xl mb-8">Super Admin Dashboard</h1>
        {/* TODO: Add management tabs for users, events, payouts, etc. */}
        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <p>Welcome, super admin! Here you can manage all aspects of the platform.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SuperAdminDashboard;
