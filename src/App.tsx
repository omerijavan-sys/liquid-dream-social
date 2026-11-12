import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MuteProvider } from "@/contexts/MuteContext";
import { OnlineProvider } from "@/contexts/OnlineContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage";
import WelcomePage from "./pages/WelcomePage";
import PublicLandingPage from "./pages/PublicLandingPage";
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CreatePostPage = lazy(() => import("./pages/CreatePostPage"));
const SportsPage = lazy(() => import("./pages/SportsPage"));
const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const ExtremePage = lazy(() => import("./pages/ExtremePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const CrushPage = lazy(() => import("./pages/CrushPage"));
const AdultPage = lazy(() => import("./pages/AdultPage"));
const AIBotsPage = lazy(() => import("./pages/AIBotsPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
import GlobalRealtimeListener from "./components/GlobalRealtimeListener";
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const isGuest = localStorage.getItem('guestMode') === 'true';
  
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user && !isGuest) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();
  const isGuest = localStorage.getItem("guestMode") === "true";

  if (loading) return <div className="min-h-screen bg-background" />;
  return user || isGuest ? <Index /> : <PublicLandingPage />;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (user) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addAccount") === "1") return <>{children}</>;
    const next = params.get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return <Navigate to={safe} replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MuteProvider>
          <OnlineProvider>
          <GlobalRealtimeListener />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/welcome" element={<AuthRoute><WelcomePage /></AuthRoute>} />
            <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
            <Route path="/" element={<HomeRoute />} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><CreatePostPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="/reels" element={<ProtectedRoute><ReelsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfilePage /></ProtectedRoute>} />
            <Route path="/call/:userId" element={<ProtectedRoute><CallPage /></ProtectedRoute>} />
            <Route path="/sports" element={<ProtectedRoute><SportsPage /></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
            <Route path="/extreme" element={<ProtectedRoute><ExtremePage /></ProtectedRoute>} />
            <Route path="/crush" element={<ProtectedRoute><CrushPage /></ProtectedRoute>} />
            <Route path="/adult" element={<ProtectedRoute><AdultPage /></ProtectedRoute>} />
            <Route path="/bots" element={<ProtectedRoute><AIBotsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </OnlineProvider>
          </MuteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
