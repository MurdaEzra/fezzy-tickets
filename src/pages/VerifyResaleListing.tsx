
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const VerifyResaleListing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid verification link");
      return;
    }

    const verifyListing = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resale-verify-listing`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY!
            },
            body: JSON.stringify({ token }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Verification failed");
        }

        setStatus("success");
        toast.success("Listing activated successfully!");
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Verification failed");
        toast.error(error instanceof Error ? error.message : "Verification failed");
      }
    };

    verifyListing();
  }, [token]);

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main className="mx-auto max-w-1440 px-5 py-16 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 animate-spin text-fezzy" />
              <p className="text-lg">Verifying your listing...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h1 className="font-display text-3xl">Listing Activated!</h1>
              <p className="text-lg text-cream-dim">
                Your ticket is now listed in the resale marketplace!
              </p>
              <Button
                className="btn-ember mt-4"
                onClick={() => navigate("/account")}
              >
                Go to My Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="h-16 w-16 text-ember" />
              <h1 className="font-display text-3xl">Verification Failed</h1>
              <p className="text-lg text-cream-dim">{errorMessage}</p>
              <Button
                className="btn-ember mt-4"
                onClick={() => navigate("/account")}
              >
                Go to My Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyResaleListing;
