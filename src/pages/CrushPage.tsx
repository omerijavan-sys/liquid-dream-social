import { ArrowLeft, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GlassTabBar from "@/components/GlassTabBar";
import MatchTab from "@/components/MatchTab";

const CrushPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="liquid-glass-elevated safe-area-top sticky top-0 z-20">
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="depth-press">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Heart className="h-5 w-5 text-primary" />
          <h1 className="text-headline text-foreground">Crush</h1>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 p-4 pt-5">
        <MatchTab />
      </main>
      <GlassTabBar />
    </div>
  );
};

export default CrushPage;
