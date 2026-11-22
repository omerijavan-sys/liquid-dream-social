import { PinHost } from "@/components/WalletPin";
import BackgroundAudio from "./components/BackgroundAudio";
import PostMusicGuard from "./components/PostMusicGuard";
import ConsentGate from "./components/ConsentGate";
import NativeMediaPicker from "./components/NativeMediaPicker";
import { lazy, Suspense } from "react";
import SplashLoader from "@/components/SplashLoader";
import PaystackReturn from "@/components/PaystackReturn";
import SpotifyCallback from "@/components/SpotifyCallback";
import NativePush from "@/components/NativePush";
import UpdateChecker from "@/components/UpdateChecker";
import BackButtonHandler from "@/components/BackButtonHandler";
import MiniPlayer from "@/components/MiniPlayer";
import InAppBrowser from "@/components/InAppBrowser";
import NativeAuthBridge from "@/components/NativeAuthBridge";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import LivePage from "@/pages/LivePage";
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
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const GroupCallPage = lazy(() => import("./pages/GroupCallPage"));
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
const AdultVideoChatPage = lazy(() => import("./pages/AdultVideoChatPage"));
const MeetPage = lazy(() => import("./pages/MeetPage"));
const AIBotsPage = lazy(() => import("./pages/AIBotsPage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
import GlobalRealtimeListener from "./components/GlobalRealtimeListener";
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const isGuest = localStorage.getItem('guestMode') === 'true';
  
  if (loading) return <SplashLoader />;
  if (!user && !isGuest) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();
  const isGuest = localStorage.getItem("guestMode") === "true";

  if (loading) return <SplashLoader />;
  return user || isGuest ? <Index /> : <PublicLandingPage />;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <SplashLoader />;
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
      <PinHost />
      <Sonner />
      <BrowserRouter>
        <NativeAuthBridge />
        <BackButtonHandler />
        <NativeMediaPicker />
        <PostMusicGuard />
        <BackgroundAudio />
        <UpdateChecker />
        <PaystackReturn />
        <SpotifyCallback />
        <MiniPlayer />
        <InAppBrowser />
        <AuthProvider>
          <MuteProvider>
          <OnlineProvider>
          <ConsentGate />
          <GlobalRealtimeListener />
          <NativePush />
          <Suspense fallback={<SplashLoader />}>
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
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/help" element={<LegalPage kind="help" />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/reels" element={<ProtectedRoute><ReelsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfilePage /></ProtectedRoute>} />
            <Route path="/call/:userId" element={<ProtectedRoute><CallPage /></ProtectedRoute>} />
            <Route path="/live/new" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
            <Route path="/live/:id" element={<ProtectedRoute><LivePage /></ProtectedRoute>} />
            <Route path="/gcall/:callId" element={<ProtectedRoute><GroupCallPage /></ProtectedRoute>} />
            <Route path="/sports" element={<ProtectedRoute><SportsPage /></ProtectedRoute>} />
            <Route path="/movies" element={<ProtectedRoute><MoviesPage /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
            <Route path="/extreme" element={<ProtectedRoute><ExtremePage /></ProtectedRoute>} />
            <Route path="/crush" element={<ProtectedRoute><CrushPage /></ProtectedRoute>} />
            <Route path="/meet" element={<ProtectedRoute><MeetPage /></ProtectedRoute>} />
            <Route path="/adult" element={<ProtectedRoute><AdultPage /></ProtectedRoute>} />
            <Route path="/adult/video" element={<ProtectedRoute><AdultVideoChatPage /></ProtectedRoute>} />
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
