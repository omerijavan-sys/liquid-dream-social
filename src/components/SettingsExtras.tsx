import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const card = "liquid-glass rounded-2xl p-4 relative z-10";
const input = "w-full px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm outline-none";
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : (e as { message?: string })?.message || fallback);

// ---------- Privacy (persisted) ----------
type PrivacyState = { is_private: boolean; show_activity: boolean; allow_tags: boolean; allow_dms: boolean };
const PRIVACY_DEFAULT: PrivacyState = { is_private: false, show_activity: true, allow_tags: true, allow_dms: true };

export const PrivacyPanel = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PrivacyState>(PRIVACY_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("user_settings" as never).select("is_private, show_activity, allow_tags, allow_dms").eq("user_id", user.id).maybeSingle();
      if (data) setState({ ...PRIVACY_DEFAULT, ...(data as Partial<PrivacyState>) });
      setLoading(false);
    })();
  }, [user]);

  const toggle = async (key: keyof PrivacyState) => {
    if (!user) return;
    const next = { ...state, [key]: !state[key] };
    setState(next);
    const { error } = await supabase.from("user_settings" as never).upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() } as never);
    if (error) { setState(state); toast.error(errMsg(error, "Couldn't save setting")); }
  };

  const items: Array<[keyof PrivacyState, string]> = [
    ["is_private", "Private Account"],
    ["show_activity", "Show Activity Status"],
    ["allow_tags", "Allow Tags from Everyone"],
    ["allow_dms", "Allow Messages from Everyone"],
  ];
  return (
    <div className="space-y-3">
      {items.map(([key, label]) => (
        <div key={key} className={`${card} flex items-center justify-between`}>
          <span className="text-sm text-foreground">{label}</span>
          <Switch disabled={loading} checked={state[key]} onCheckedChange={() => void toggle(key)} aria-label={label} />
        </div>
      ))}
    </div>
  );
};

// ---------- Blocked accounts ----------
export const BlockedPanel = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ blocked_id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("user_blocks" as never).select("blocked_id").eq("blocker_id", user.id);
    const ids = ((data ?? []) as Array<{ blocked_id: string }>).map(r => r.blocked_id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids) : { data: [] };
    const byId = new Map((profiles ?? []).map(p => [p.user_id, p.display_name || p.username || "Primegram member"]));
    setRows(ids.map(id => ({ blocked_id: id, name: byId.get(id) ?? "Primegram member" })));
    setLoading(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const unblock = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_blocks" as never).delete().eq("blocker_id", user.id).eq("blocked_id", id);
    if (error) toast.error(errMsg(error, "Couldn't unblock")); else { toast.success("Unblocked"); void load(); }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Blocked people can't message you. Block someone from their profile.</p>
      {rows.length === 0 && <p className={`${card} text-sm text-muted-foreground`}>You haven't blocked anyone.</p>}
      {rows.map(r => (
        <div key={r.blocked_id} className={`${card} flex items-center justify-between gap-3`}>
          <span className="truncate text-sm text-foreground">{r.name}</span>
          <Button variant="secondary" onClick={() => void unblock(r.blocked_id)}>Unblock</Button>
        </div>
      ))}
    </div>
  );
};

// ---------- Two-factor (TOTP) ----------
const TwoFactor = () => {
  const [factorId, setFactorId] = useState<string | null>(null); // verified factor
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp?.find(f => f.status === "verified")?.id ?? null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const start = async () => {
    setBusy(true);
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) { toast.error(errMsg(e, "Couldn't start 2FA setup")); }
    setBusy(false);
  };

  const confirm = async () => {
    if (!enroll) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
      if (error) throw error;
      toast.success("Two-factor authentication enabled");
      setEnroll(null); setCode(""); await refresh();
    } catch (e) { toast.error(errMsg(e, "Invalid code")); }
    setBusy(false);
  };

  const disable = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) toast.error(errMsg(error, "Couldn't disable 2FA")); else { toast.success("Two-factor authentication disabled"); void refresh(); }
  };

  return (
    <div className={card}>
      <p className="text-sm font-semibold text-foreground mb-1">Two-Factor Authentication</p>
      {factorId ? (
        <>
          <p className="text-caption text-muted-foreground mb-3">Enabled with an authenticator app.</p>
          <Button variant="secondary" disabled={busy} onClick={() => void disable()}>Disable 2FA</Button>
        </>
      ) : enroll ? (
        <div className="space-y-3">
          <p className="text-caption text-muted-foreground">Scan this QR code with Google Authenticator, Authy or similar, then enter the 6-digit code.</p>
          <img src={enroll.qr} alt="2FA QR code" className="mx-auto h-40 w-40 rounded-xl bg-white p-2" />
          <p className="break-all text-center text-[11px] text-muted-foreground">Or enter this key: {enroll.secret}</p>
          <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={input} />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy || code.length !== 6} onClick={() => void confirm()}>Verify & enable</Button>
            <Button variant="ghost" onClick={() => { void supabase.auth.mfa.unenroll({ factorId: enroll.id }); setEnroll(null); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-caption text-muted-foreground mb-3">Add an extra layer of protection with an authenticator app.</p>
          <Button disabled={busy} onClick={() => void start()}>Set up 2FA</Button>
        </>
      )}
    </div>
  );
};

// ---------- Security extras ----------
export const SecurityExtras = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Unknown";

  const signOutEverywhere = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) { toast.error(errMsg(error, "Couldn't sign out")); return; }
    toast.success("Signed out of all devices");
    navigate("/auth");
  };

  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const tables: Array<[string, string]> = [
        ["profiles", "user_id"], ["posts", "user_id"], ["wallet_transactions", "user_id"],
        ["withdrawal_requests", "user_id"], ["creator_subscriptions", "subscriber_id"], ["user_blocks", "blocker_id"],
      ];
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, phone: user.phone, created_at: user.created_at } };
      for (const [t, col] of tables) {
        const { data } = await supabase.from(t as never).select("*").eq(col, user.id);
        out[t] = data ?? [];
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "primegram-data.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data was downloaded");
    } catch (e) { toast.error(errMsg(e, "Export failed")); }
    setBusy(false);
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account" as never);
    if (error) { setBusy(false); toast.error(errMsg(error, "Couldn't delete account")); return; }
    await signOut().catch(() => undefined);
    toast.success("Your account was deleted");
    navigate("/auth");
  };

  return (
    <div className="space-y-3">
      <TwoFactor />
      <div className={card}>
        <p className="text-sm font-semibold text-foreground mb-1">Login Activity</p>
        <p className="text-caption text-muted-foreground mb-3">Last sign-in: {lastSignIn}</p>
        <Button variant="secondary" onClick={() => void signOutEverywhere()}>Sign out of all devices</Button>
      </div>
      <div className={card}>
        <p className="text-sm font-semibold text-foreground mb-1">Download my data</p>
        <p className="text-caption text-muted-foreground mb-3">Get a JSON copy of your profile, posts and wallet history.</p>
        <Button variant="secondary" disabled={busy} onClick={() => void exportData()}>Download</Button>
      </div>
      <div className={`${card} border border-red-400/30`}>
        <p className="text-sm font-semibold text-red-300 mb-1">Delete account</p>
        <p className="text-caption text-muted-foreground mb-3">Permanently removes your account and data. Wallet balance is forfeited — withdraw first. This can't be undone.</p>
        {showDelete ? (
          <div className="space-y-2">
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' className={input} />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1" disabled={busy || confirmText !== "DELETE"} onClick={() => void deleteAccount()}>Delete forever</Button>
              <Button variant="ghost" onClick={() => { setShowDelete(false); setConfirmText(""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" onClick={() => setShowDelete(true)}>Delete my account</Button>
        )}
      </div>
    </div>
  );
};

// ---------- Help & support ----------
export const HelpPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<null | "problem" | "contact">(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !form) return;
    setBusy(true);
    const { error } = await supabase.from("support_tickets" as never).insert({ user_id: user.id, kind: form, subject: subject.trim(), message: message.trim() } as never);
    setBusy(false);
    if (error) { toast.error(errMsg(error, "Couldn't send. Check subject (3+ chars) and message (5+ chars).")); return; }
    toast.success("Sent! Our team will review it.");
    setForm(null); setSubject(""); setMessage("");
  };

  const links: Array<[string, () => void]> = [
    ["FAQ", () => navigate("/help")],
    ["Contact Support", () => setForm("contact")],
    ["Report a Problem", () => setForm("problem")],
    ["Terms of Service", () => navigate("/terms")],
    ["Privacy Policy", () => navigate("/privacy")],
    ["About Primegram", () => navigate("/help#about")],
  ];
  return (
    <div className="space-y-3">
      {links.map(([label, action]) => (
        <button key={label} onClick={action} className="depth-press liquid-glass rounded-2xl p-4 flex items-center justify-between w-full text-left relative z-10">
          <span className="text-sm text-foreground">{label}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      ))}
      {form && (
        <div className={`${card} space-y-3`}>
          <p className="text-sm font-semibold text-foreground">{form === "problem" ? "Report a problem" : "Contact support"}</p>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" maxLength={150} className={input} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe what's going on" maxLength={4000} className={`${input} h-28 resize-none`} />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy || subject.trim().length < 3 || message.trim().length < 5} onClick={() => void submit()}>Send</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Wallet shortcut ----------
export const WalletShortcut = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/wallet")} className="depth-press flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground">Wallet & Earnings</span>
        <span className="block text-[10px] text-muted-foreground">Top up, tips, subscriptions and withdrawals</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};
