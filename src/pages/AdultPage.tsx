import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdultHubVerified from "@/components/AdultHubVerified";
import GlassTabBar from "@/components/GlassTabBar";

const AdultPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="liquid-glass-elevated safe-area-top sticky top-0 z-20">
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="depth-press">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h1 className="text-headline text-foreground">Verified 18+</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4 pt-5">
        {user ? (
          <AdultHubVerified />
        ) : (
          <div className="rounded-2xl border border-primary/30 bg-card/70 p-5 text-center">
            <p className="font-semibold text-foreground">Sign in to verify your age</p>
            <p className="mt-1 text-sm text-muted-foreground">Age verification is securely attached to your account.</p>
            <button onClick={() => navigate("/auth")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Sign in
            </button>
          </div>
        )}
      </main>
      <GlassTabBar />
    </div>
  );
};

export default AdultPage;
