import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Moon, Lock, Bell, HelpCircle, LogOut, ChevronRight, User, Shield, Palette, Sun, Users, WalletCards, Heart, Music2, Fingerprint, Disc3, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRoles } from "@/hooks/useRole";
import { readPreference, savePreference, Theme } from "@/utils/preferences";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import AdvancedDeveloperHub from "@/components/AdvancedDeveloperHub";
import AndroidDownloadCard from "@/components/AndroidDownloadCard";

type Panel = null | "profile" | "notifications" | "privacy" | "security" | "appearance" | "darkmode" | "help" | "accounts" | "creator" | "subscriptions";

type CreatorSubscription = {
  id: string;
  subscriber_id: string;
  creator_id: string;
  amount: number;
  status: string;
  started_at: string;
  expires_at: string;
  canceled_at: string | null;
};

type AccountProfile = { user_id: string; username: string | null; display_name: string | null };

const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
  <Switch checked={on} onCheckedChange={onToggle} aria-label="Toggle setting" />
);

const SettingsPage = () => {
  const navigate = useNavigate();
  const { signOut, user, savedAccounts, switchAccount, removeSavedAccount, saveCurrentAccount } = useAuth();
  const currentUserId = user?.id;
  const { isAdmin } = useRoles();
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Toggle states
  const [notifToggles, setNotifToggles] = useState(() => ({
    push: false,
    messages: true,
    calls: true,
    updates: true,
    ...readPreference("notifications", {}),
  }));
  const [privToggles, setPrivToggles] = useState({ private: false, activity: true, tags: true, dms: true });
  const [reduceAnimations, setReduceAnimations] = useState(() => readPreference("reduce-motion", false));
  const [theme, setThemeState] = useState<Theme>(() => readPreference("theme", "dark"));
  const darkMode = theme !== "light";
  const setTheme = (value: Theme) => { setThemeState(value); savePreference("theme", value); };
  const setDarkMode = (value: boolean) => setTheme(value ? "dark" : "light");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [creatorPrice, setCreatorPrice] = useState("50");
  const [creatorActive, setCreatorActive] = useState(false);
  const [creatorSubscribers, setCreatorSubscribers] = useState<Array<CreatorSubscription & { profile?: AccountProfile }>>([]);
  const [mySubscriptions, setMySubscriptions] = useState<Array<CreatorSubscription & { profile?: AccountProfile }>>([]);
  const [monetizationLoading, setMonetizationLoading] = useState(false);
  const [monetizationSaving, setMonetizationSaving] = useState(false);
  const [settingsProfile, setSettingsProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [storageUse, setStorageUse] = useState<{ used: string; total: string; percent: number } | null>(null);
  const [crushPreferences, setCrushPreferences] = useState(() => readPreference("crush-match-preferences", {
    facePrivacy: true,
    matchHistory: false,
    crushHistory: true,
    miniDemoPlayer: false,
  }));
  const [musicPreferences, setMusicPreferences] = useState(() => readPreference("global-music-preferences", {
    autoplay: false,
    favoriteGenres: [] as string[],
  }));

  const handleSignOut = async () => { await signOut(); toast.success("Signed out"); navigate("/auth"); };

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("display_name, username, bio").eq("user_id", user.id).single();
    if (data) { setDisplayName(data.display_name || ""); setUsername(data.username || ""); setBio(data.bio || ""); }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, username, bio }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to save"); else toast.success("Profile updated!");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Password changed!"); setNewPassword(""); setChangingPassword(false); }
  };

  const loadCreatorData = useCallback(async () => {
    if (!currentUserId) return;
    setMonetizationLoading(true);
    try {
      const [creator, subscriptions] = await Promise.all([
        supabase.from("creator_profiles").select("monthly_price").eq("user_id", currentUserId).maybeSingle(),
        supabase.from("creator_subscriptions").select("*").eq("creator_id", currentUserId).order("started_at", { ascending: false }),
      ]);
      if (creator.error) throw creator.error;
      if (subscriptions.error) throw subscriptions.error;
      setCreatorActive(!!creator.data);
      setCreatorPrice(String(creator.data?.monthly_price ?? 50));
      const ids = [...new Set((subscriptions.data ?? []).map(item => item.subscriber_id))];
      const { data: profiles, error } = ids.length
        ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids)
        : { data: [], error: null };
      if (error) throw error;
      const byId = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
      setCreatorSubscribers((subscriptions.data ?? []).map(item => ({ ...item, profile: byId.get(item.subscriber_id) })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load the creator dashboard");
    } finally {
      setMonetizationLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const loadSettingsSummary = async () => {
      const { data, error } = await supabase.from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load your account summary");
      } else {
        setSettingsProfile(data);
      }
      if (navigator.storage?.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (cancelled) return;
          const usage = estimate.usage ?? 0;
          const quota = estimate.quota ?? 0;
          const format = (bytes: number) => bytes >= 1024 ** 3
            ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
            : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
          setStorageUse({
            used: format(usage),
            total: quota ? format(quota) : "—",
            percent: quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0,
          });
        } catch {
          if (!cancelled) toast.error("Couldn't read browser storage usage");
        }
      }
    };
    void loadSettingsSummary();
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    void loadCreatorData();
  }, [loadCreatorData]);

  const updateCrushPreference = (key: keyof typeof crushPreferences, value: boolean) => {
    const next = { ...crushPreferences, [key]: value };
    setCrushPreferences(next);
    savePreference("crush-match-preferences", next);
  };

  const toggleFavoriteGenre = (genre: string) => {
    const favoriteGenres = musicPreferences.favoriteGenres.includes(genre)
      ? musicPreferences.favoriteGenres.filter(item => item !== genre)
      : [...musicPreferences.favoriteGenres, genre];
    const next = { ...musicPreferences, favoriteGenres };
    setMusicPreferences(next);
    savePreference("global-music-preferences", next);
  };

  const loadMySubscriptions = async () => {
    if (!user) return;
    setMonetizationLoading(true);
    try {
      const { data, error } = await supabase.from("creator_subscriptions").select("*")
        .eq("subscriber_id", user.id).order("started_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map(item => item.creator_id))];
      const { data: profiles, error: profileError } = ids.length
        ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
      setMySubscriptions((data ?? []).map(item => ({ ...item, profile: byId.get(item.creator_id) })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load subscriptions");
    } finally {
      setMonetizationLoading(false);
    }
  };

  const saveCreatorProfile = async () => {
    if (!user) return;
    const price = Number(creatorPrice);
    if (!Number.isInteger(price) || price < 50 || price > 5000) {
      toast.error("Set a monthly price from 50 to 5,000 KES");
      return;
    }
    setMonetizationSaving(true);
    try {
      const { error } = await supabase.from("creator_profiles").upsert({ user_id: user.id, monthly_price: price });
      if (error) throw error;
      setCreatorActive(true);
      toast.success("Creator profile saved");
      await loadCreatorData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the creator profile");
    } finally {
      setMonetizationSaving(false);
    }
  };

  const cancelSubscription = async (creatorId: string) => {
    try {
      const { error } = await supabase.rpc("creator_cancel_subscription", { _creator_id: creatorId });
      if (error) throw error;
      toast.success("Subscription canceled. Access ends immediately; there is no refund.");
      await loadMySubscriptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't cancel subscription");
    }
  };

  const sections = [
    { icon: User, label: "Edit Profile", desc: "Update your info", panel: "profile" as Panel, onOpen: loadProfile },
    { icon: Bell, label: "Notifications", desc: "Messages & browser alerts", panel: "notifications" as Panel },
    { icon: Lock, label: "Privacy", desc: "Account privacy settings", panel: "privacy" as Panel },
    { icon: Shield, label: "Security", desc: "Password & 2FA", panel: "security" as Panel },
    { icon: Palette, label: "Appearance", desc: "Theme & display", panel: "appearance" as Panel },
    { icon: Moon, label: "Dark Mode", desc: darkMode ? "On" : "Off", panel: "darkmode" as Panel },
    { icon: HelpCircle, label: "Help & Support", desc: "FAQs and contact", panel: "help" as Panel },
    { icon: User, label: "Switch Accounts", desc: "Manage up to two saved accounts", panel: "accounts" as Panel },
    { icon: Users, label: "Creator Dashboard", desc: "Register and manage subscribers", panel: "creator" as Panel, onOpen: loadCreatorData },
    { icon: WalletCards, label: "Subscriptions", desc: "Manage your creator subscriptions", panel: "subscriptions" as Panel, onOpen: loadMySubscriptions },
  ];

  const renderPanel = () => {
    switch (activePanel) {
      case "profile":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-caption text-muted-foreground block mb-1.5">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm outline-none" />
            </div>
            <div>
              <label className="text-caption text-muted-foreground block mb-1.5">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm outline-none" />
            </div>
            <div>
              <label className="text-caption text-muted-foreground block mb-1.5">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm outline-none resize-none h-20" />
            </div>
            <button onClick={saveProfile} disabled={saving} className="depth-press w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-3">
            <p className="px-1 text-xs text-muted-foreground">Browser alerts appear when Primegram is open in the background. Allow notifications in your browser to enable them.</p>
            {Object.entries(notifToggles).map(([key, val]) => (
              <div key={key} className="liquid-glass rounded-2xl p-4 flex items-center justify-between relative z-10">
                <span className="text-sm text-foreground capitalize">{key.replace(/([A-Z])/g, " $1")} Notifications</span>
                <Toggle on={val} onToggle={async () => {
                  if (key === "push" && !val) {
                    if (!("Notification" in window)) { toast.error("Browser notifications are unavailable."); return; }
                    if (await Notification.requestPermission() !== "granted") { toast.error("Allow notifications in your browser settings."); return; }
                  }
                  const next = { ...notifToggles, [key]: !val };
                  setNotifToggles(next); savePreference("notifications", next);
                }} />
              </div>
            ))}
          </div>
        );
      case "privacy":
        return (
          <div className="space-y-3">
            {[
              { key: "private", label: "Private Account" },
              { key: "activity", label: "Show Activity Status" },
              { key: "tags", label: "Allow Tags from Everyone" },
              { key: "dms", label: "Allow Messages from Everyone" },
            ].map(item => (
              <div key={item.key} className="liquid-glass rounded-2xl p-4 flex items-center justify-between relative z-10">
                <span className="text-sm text-foreground">{item.label}</span>
                <Toggle on={privToggles[item.key as keyof typeof privToggles]} onToggle={() => setPrivToggles(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))} />
              </div>
            ))}
          </div>
        );
      case "security":
        return (
          <div className="space-y-3">
            <button onClick={() => setChangingPassword(!changingPassword)} className="depth-press liquid-glass rounded-2xl p-4 w-full text-left relative z-10">
              <p className="text-sm font-semibold text-foreground mb-1">Change Password</p>
              <p className="text-caption text-muted-foreground">Update your password regularly</p>
            </button>
            {changingPassword && (
              <div className="space-y-3 px-1">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="w-full px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm outline-none" />
                <button onClick={changePassword} disabled={saving} className="depth-press w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                  {saving ? "..." : "Update Password"}
                </button>
              </div>
            )}
            <div className="liquid-glass rounded-2xl p-4 relative z-10">
              <p className="text-sm font-semibold text-foreground mb-1">Two-Factor Authentication</p>
              <p className="text-caption text-muted-foreground">Coming soon</p>
            </div>
            <div className="liquid-glass rounded-2xl p-4 relative z-10">
              <p className="text-sm font-semibold text-foreground mb-1">Login Activity</p>
              <p className="text-caption text-muted-foreground">Current session active</p>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-3">
            <div className="liquid-glass rounded-2xl p-4 relative z-10">
              <p className="text-sm font-semibold text-foreground mb-2">App Theme</p>
              <div className="flex gap-2">
                {(["dark", "light", "auto"] as const).map(t => (
                  <Button key={t} variant={theme === t ? "default" : "secondary"} onClick={() => setTheme(t)} className="flex-1 capitalize">
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between relative z-10">
              <span className="text-sm text-foreground">Reduce Animations</span>
              <Toggle on={reduceAnimations} onToggle={() => { setReduceAnimations(!reduceAnimations); savePreference("reduce-motion", !reduceAnimations); }} />
            </div>
          </div>
        );
      case "darkmode":
        return (
          <div className="space-y-3">
            <div className="liquid-glass rounded-2xl p-4 flex items-center gap-3 relative z-10">
              {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Dark Mode {darkMode ? "Active" : "Off"}</p>
                <p className="text-caption text-muted-foreground">Easier on the eyes in low light</p>
              </div>
              <Toggle on={darkMode} onToggle={() => setDarkMode(!darkMode)} />
            </div>
          </div>
        );
      case "help":
        return (
          <div className="space-y-3">
            {[
              { label: "FAQ", action: () => toast.info("FAQ: Visit our help center for common questions") },
              { label: "Contact Support", action: () => toast.info("Email: support@primegram.app") },
              { label: "Report a Problem", action: () => toast.info("Please describe the issue and we'll look into it") },
              { label: "Terms of Service", action: () => toast.info("Terms of Service - Primegram 2026") },
              { label: "Privacy Policy", action: () => toast.info("Your data is secure with Primegram") },
              { label: "About Primegram", action: () => toast.info("Primegram v1.0 - Created by Java Prime, Sponsored by JP7 ULTRA") },
            ].map(item => (
              <button key={item.label} onClick={item.action} className="depth-press liquid-glass rounded-2xl p-4 flex items-center justify-between w-full text-left relative z-10">
                <span className="text-sm text-foreground">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        );
      case "accounts":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Saved sessions stay on this device for one-tap switching. Passwords are never saved.</p>
            <div className="space-y-2">
              {savedAccounts.map(account => (
                <div key={account.userId} className="liquid-glass rounded-2xl p-4 flex items-center gap-3 relative z-10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{account.label}</p>
                    <p className="text-caption text-muted-foreground">{account.userId === user?.id ? "Currently active" : "Saved on this device"}</p>
                  </div>
                  {account.userId !== user?.id && (
                    <>
                      <Button variant="secondary" onClick={async () => {
                        try { await switchAccount(account.userId); toast.success(`Switched to ${account.label}`); }
                        catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't switch accounts"); }
                      }}>Switch</Button>
                      <Button variant="ghost" onClick={() => removeSavedAccount(account.userId)} aria-label={`Remove ${account.label}`}>Remove</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full" disabled={savedAccounts.length >= 2} onClick={async () => {
              try {
                await saveCurrentAccount();
                navigate("/auth?addAccount=1&next=%2Fsettings");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Couldn't prepare another account");
              }
            }}>
              {savedAccounts.length >= 2 ? "Remove an account before adding another" : "Add another account"}
            </Button>
            <p className="text-xs text-muted-foreground">Account sessions are stored locally in this browser. Removing an account forgets its saved session on this device.</p>
          </div>
        );
      case "creator":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Set a monthly subscription price between 50 and 5,000 KES. Each purchase covers one prepaid month and does not auto-renew. Creators receive 95% of each payment.</p>
            <label className="block text-sm text-foreground">
              Monthly price (KES)
              <input type="number" min="50" max="5000" step="1" value={creatorPrice} onChange={event => setCreatorPrice(event.target.value)} className="mt-2 w-full rounded-2xl bg-secondary/50 px-4 py-3 outline-none" />
            </label>
            <Button className="w-full" disabled={monetizationSaving} onClick={() => void saveCreatorProfile()}>
              {monetizationSaving ? "Saving..." : creatorActive ? "Save Creator Plan" : "Register as a Creator"}
            </Button>
            {monetizationLoading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : creatorActive && (
              <section className="liquid-glass rounded-2xl p-4 relative z-10">
                <h3 className="font-semibold text-foreground">Subscribers ({creatorSubscribers.filter(item => item.status === "active" && new Date(item.expires_at) > new Date()).length})</h3>
                <div className="mt-3 space-y-3">
                  {creatorSubscribers.length === 0 ? <p className="text-sm text-muted-foreground">Your subscribers will appear here.</p> : creatorSubscribers.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{item.profile?.display_name || item.profile?.username || "Primegram member"}</span>
                      <span className="shrink-0 text-muted-foreground">{item.status === "active" && new Date(item.expires_at) > new Date() ? `Until ${new Date(item.expires_at).toLocaleDateString()}` : "Expired"}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      case "subscriptions":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Purchases are prepaid for one month and do not auto-renew. Cancellation is immediate and does not issue a refund.</p>
            {monetizationLoading ? <p className="text-sm text-muted-foreground">Loading subscriptions...</p> : mySubscriptions.length === 0 ? (
              <p className="liquid-glass rounded-2xl p-4 text-sm text-muted-foreground relative z-10">You have no creator subscriptions.</p>
            ) : mySubscriptions.map(item => {
              const isActive = item.status === "active" && new Date(item.expires_at) > new Date();
              return (
                <div key={item.id} className="liquid-glass rounded-2xl p-4 flex items-center gap-3 relative z-10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{item.profile?.display_name || item.profile?.username || "Creator"}</p>
                    <p className="text-caption text-muted-foreground">{item.amount.toLocaleString()} KES · {isActive ? `ends ${new Date(item.expires_at).toLocaleDateString()}` : "inactive"}</p>
                  </div>
                  {isActive && <Button variant="destructive" onClick={() => void cancelSubscription(item.creator_id)}>Cancel</Button>}
                </div>
              );
            })}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="liquid-glass-elevated safe-area-top">
        <div className="flex items-center gap-3 px-5 py-4 relative z-10">
          <button onClick={() => activePanel ? setActivePanel(null) : navigate(-1)} className="depth-press">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-headline text-foreground text-base">
            {activePanel ? sections.find(s => s.panel === activePanel)?.label || "Settings" : "Settings"}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activePanel ? (
          <motion.div key={activePanel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 max-w-2xl mx-auto">
            {renderPanel()}
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-3xl space-y-3 px-4 py-4 sm:px-5">
            <section className="liquid-glass-elevated flex items-center gap-3 rounded-2xl p-3 relative z-10">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-secondary">
                {settingsProfile?.avatar_url
                  ? <img src={settingsProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">{(settingsProfile?.display_name || user?.email || "U")[0].toUpperCase()}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{settingsProfile?.display_name || user?.user_metadata?.nickname || user?.email?.split("@")[0] || "Primegram user"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{settingsProfile?.username ? `@${settingsProfile.username}` : user?.email}</p>
              </div>
              <div className="w-24 shrink-0 sm:w-36">
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className="hidden sm:inline">Quick storage usage</span><span>{storageUse ? `${storageUse.percent}%` : "—"}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-fuchsia-400" style={{ width: `${storageUse?.percent ?? 0}%` }} />
                </div>
                <p className="mt-1 text-right text-[9px] text-muted-foreground">{storageUse ? `${storageUse.used} / ${storageUse.total}` : "Storage usage unavailable"}</p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_24px_rgba(255,0,51,.08)] backdrop-blur-xl">
              <button onClick={() => { setActivePanel("profile"); void loadProfile(); }} className="flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07] text-foreground"><UserRound className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground">Account Management</span>
                  <span className="block text-[10px] text-muted-foreground">Update your info and switch profiles</span>
                </span>
                <ChevronRight className="h-4 w-4 text-red-300" />
              </button>
              <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="mb-2 text-[10px] font-semibold text-white/75">1. Linked Accounts</p>
                  <div className="space-y-2">
                    {savedAccounts.length ? savedAccounts.map(account => (
                      <div key={account.userId} className="flex min-w-0 items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${account.userId === user?.id ? "bg-emerald-400" : "bg-white/25"}`} />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-white/80">{account.label}</span>
                        {account.userId === user?.id && <span className="text-[9px] text-emerald-300">Current</span>}
                      </div>
                    )) : <p className="text-[10px] text-white/40">No saved account profiles.</p>}
                  </div>
                  <button onClick={() => setActivePanel("accounts")} className="mt-2 text-[10px] text-cyan-200 hover:text-cyan-100">Manage linked accounts</button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="mb-2 text-[10px] font-semibold text-white/75">2. Switch Account / Manage Profiles</p>
                  <div className="space-y-1.5">
                    {savedAccounts.filter(account => account.userId !== user?.id).map(account => (
                      <button key={account.userId} onClick={async () => {
                        try { await switchAccount(account.userId); toast.success(`Switched to ${account.label}`); }
                        catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't switch accounts"); }
                      }} className="flex w-full items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5 text-left text-[10px] text-white/80 hover:bg-white/10">
                        <UserRound className="h-3.5 w-3.5 text-cyan-200" /> Switch to {account.label}
                      </button>
                    ))}
                    <button onClick={() => setActivePanel("accounts")} className="w-full rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/5">
                      {savedAccounts.length >= 2 ? "Manage saved profiles" : "Add another account"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid border-t border-white/10 sm:grid-cols-2">
                <button onClick={() => setActivePanel("privacy")} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.035]">
                  <Lock className="h-4 w-4 text-white/75" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">Privacy</span><span className="block text-[10px] text-muted-foreground">Account privacy settings</span></span><ChevronRight className="h-4 w-4 text-red-300" />
                </button>
                <button onClick={() => setActivePanel("security")} className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-left hover:bg-white/[0.035] sm:border-l sm:border-t-0">
                  <Shield className="h-4 w-4 text-white/75" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">Security</span><span className="block text-[10px] text-muted-foreground">Password & 2FA</span></span><ChevronRight className="h-4 w-4 text-red-300" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[0_0_24px_rgba(255,0,51,.08)] backdrop-blur-xl">
              <button onClick={() => setActivePanel("appearance")} className="flex w-full items-center gap-3 text-left">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07] text-foreground"><Palette className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">Appearance</span><span className="block text-[10px] text-muted-foreground">Theme switcher: Midnight Obsidian, Liquid Glass, Neon</span></span>
                <span className="h-5 w-5 shrink-0 rounded-md border border-red-300/50 bg-red-600 shadow-[0_0_12px_rgba(255,0,51,.6)]" /><ChevronRight className="h-4 w-4 text-red-300" />
              </button>
              {creatorActive && <div className="mt-3"><AdvancedDeveloperHub /></div>}
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-rose-300" /><h2 className="text-xs font-semibold text-foreground">AI Crush & Match Hub</h2></div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  { key: "facePrivacy" as const, label: "Facial Recognition Privacy", icon: Fingerprint },
                  { key: "matchHistory" as const, label: "Match History", icon: Heart },
                  { key: "crushHistory" as const, label: "Crush History", icon: Heart },
                  { key: "miniDemoPlayer" as const, label: "Mini Demo Player", icon: Music2 },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-rose-300/75" />
                    <span className="flex-1 text-[11px] text-foreground">{item.label}</span>
                    <Switch checked={crushPreferences[item.key]} onCheckedChange={value => updateCrushPreference(item.key, value)} aria-label={item.label} />
                  </div>
                ))}
              </div>
            </section>

            <AndroidDownloadCard />

            <section className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2"><Music2 className="h-4 w-4 text-pink-300" /><h2 className="text-xs font-semibold text-foreground">Global Music Preferences</h2></div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><Disc3 className="h-4 w-4 text-pink-300/75" /><span className="flex-1 text-[11px] text-foreground">Autoplay Background Tracks</span><Switch checked={musicPreferences.autoplay} onCheckedChange={value => {
                    const next = { ...musicPreferences, autoplay: value };
                    setMusicPreferences(next);
                    savePreference("global-music-preferences", next);
                  }} aria-label="Autoplay background tracks" /></div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground">Favorite Genres</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Afrobeats", "Hip-hop", "R&B", "Pop"].map(genre => (
                        <button key={genre} onClick={() => toggleFavoriteGenre(genre)} className={`rounded-full border px-2 py-1 text-[9px] ${musicPreferences.favoriteGenres.includes(genre) ? "border-pink-400/40 bg-pink-500/15 text-pink-200" : "border-white/10 bg-white/5 text-white/55"}`}>{genre}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/50 to-pink-500/40"><Music2 className="h-4 w-4 text-white" /></span>
                  <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-foreground">Primegram mini demo</p><p className="text-[9px] text-muted-foreground">Preference preview · playback not started</p></div>
                  <div className="flex h-7 items-center gap-0.5" aria-hidden="true">{[8, 15, 11, 20, 12, 17, 7, 14].map((height, index) => <span key={index} className="w-0.5 rounded-full bg-fuchsia-300/70" style={{ height }} />)}</div>
                </div>
              </div>
            </section>

            <section className="flex items-center gap-3 border-y border-white/10 px-3 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07]"><Moon className="h-4 w-4 text-foreground" /></span>
              <span className="flex-1"><span className="block text-xs font-semibold text-foreground">Dark Mode</span><span className="block text-[10px] text-muted-foreground">{darkMode ? "On" : "Off"}</span></span>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} aria-label="Dark Mode" />
            </section>

            <button onClick={() => setActivePanel("help")} className="flex w-full items-center gap-3 border-b border-white/10 px-3 py-3 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.07]"><HelpCircle className="h-4 w-4 text-foreground" /></span>
              <span className="flex-1"><span className="block text-xs font-semibold text-foreground">Help & Support</span><span className="block text-[10px] text-muted-foreground">FAQs and contact</span></span>
              <ChevronRight className="h-4 w-4 text-red-300" />
            </button>

            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => { setActivePanel("creator"); void loadCreatorData(); }} className="depth-press flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 text-left">
                <Users className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">Creator Dashboard</span><span className="block text-[10px] text-muted-foreground">{creatorActive ? "Manage plan and subscribers" : "Register as a creator"}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => { setActivePanel("subscriptions"); void loadMySubscriptions(); }} className="depth-press flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 text-left">
                <WalletCards className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">Subscriptions</span><span className="block text-[10px] text-muted-foreground">Your creator memberships</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {isAdmin && (
              <motion.button
                onClick={() => navigate("/admin")}
                className="depth-press liquid-glass rounded-2xl p-4 flex items-center gap-3 w-full text-left relative z-10 border border-primary/30"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Admin Console</p>
                  <p className="text-caption text-muted-foreground">Moderation, users, reports & audit log</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            )}
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} onClick={handleSignOut}
              className="depth-press w-full mt-1 py-3 rounded-2xl border border-red-300/30 bg-gradient-to-r from-red-950/60 to-rose-950/30 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 relative z-10 shadow-[0_0_16px_rgba(255,0,51,.12)]">
              <LogOut className="w-4 h-4" /> Sign Out
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
