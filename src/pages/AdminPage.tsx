import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import LiquidBackground from "@/components/LiquidBackground";
import {
  Shield, Users, FileText, Video, MessageCircle, Flag, Trash2, ArrowLeft,
  BadgeCheck, Search, ScrollText, Loader2, Banknote, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

/** Admin-only: add or remove minor admins (they manage users and their posts; no badges, revenue or payouts). */
const TeamPanel = ({ profiles, glass }: { profiles: any[]; glass: string }) => {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const { data: team } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_list_minor_admins");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const ids = new Set((team ?? []).map((t: any) => t.user_id));
  const results = term.trim().length < 2 ? [] : profiles.filter((p) => !ids.has(p.user_id) && `${p.username ?? ""} ${p.display_name ?? ""}`.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 8);
  const setOn = async (userId: string, on: boolean, name: string) => {
    if (on && !window.confirm(`Make @${name} a minor admin? They will be able to ban users and remove posts, but not grant badges or see revenue.`)) return;
    const { error } = await (supabase.rpc as any)("admin_set_minor_admin", { _user: userId, _on: on });
    if (error) return toast.error(error.message);
    toast.success(on ? `@${name} is now a minor admin` : `@${name} removed from the team`);
    setTerm("");
    qc.invalidateQueries({ queryKey: ["admin", "team"] });
  };
  return (
    <div className="space-y-4">
      <Card className={glass}><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Minor admins</p>
        <p>Can manage users (ban / unban) and remove their posts, reels, comments and reports. Cannot grant badges, see revenue, withdrawals, health, audit logs or support tickets, and cannot act on admins or other minor admins.</p>
      </CardContent></Card>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search a username to promote" className="pl-9" />
      </div>
      {results.map((p: any) => (
        <Card key={p.user_id} className={glass}><CardContent className="flex items-center gap-3 p-3">
          <Avatar className="h-9 w-9"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback>{(p.username || "U")[0].toUpperCase()}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">@{p.username || "unknown"}</p><p className="truncate text-xs text-muted-foreground">{p.display_name || "—"}</p></div>
          <Button size="sm" onClick={() => void setOn(p.user_id, true, p.username || "user")}>Make minor admin</Button>
        </CardContent></Card>
      ))}
      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current minor admins ({(team ?? []).length})</p>
      {(team ?? []).length === 0 && <p className="text-sm text-muted-foreground">No minor admins yet.</p>}
      {(team ?? []).map((t: any) => (
        <Card key={t.user_id} className={glass}><CardContent className="flex items-center gap-3 p-3">
          <Avatar className="h-9 w-9"><AvatarImage src={t.avatar_url || undefined} /><AvatarFallback>{(t.username || "U")[0].toUpperCase()}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">@{t.username || "unknown"}</p><p className="text-xs text-muted-foreground">Since {new Date(t.since).toLocaleDateString()}</p></div>
          <Button size="sm" variant="destructive" onClick={() => void setOn(t.user_id, false, t.username || "user")}>Remove</Button>
        </CardContent></Card>
      ))}
    </div>
  );
};

/** Growth funnel (last 7 days): sign-ups, onboarding steps, shares and referrals. */
const GrowthFunnel = ({ glass }: { glass: string }) => {
  const { data } = useQuery({
    queryKey: ["admin", "growth"],
    queryFn: async () => { const { data, error } = await (supabase.rpc as any)("admin_growth_funnel"); if (error) throw error; return data as any; },
  });
  if (!data) return null;
  const st = (k: string) => Number(data.steps?.[k] ?? 0);
  const rows: [string, number][] = [
    ["New sign-ups", data.signups], ["Finished welcome flow", data.onboarded], ["Started onboarding", st("onboarding_start")],
    ["Followed people", st("onboarding_follow")], ["Posted a first Drop", st("onboarding_first_drop")], ["Reached invite step", st("onboarding_drop")],
    ["Shared on WhatsApp", Object.entries(data.steps ?? {}).filter(([k]) => k.startsWith("share_whatsapp")).reduce((a, [, v]) => a + Number(v), 0)],
    ["Joined via invite", data.referrals], ["Active people (24h)", data.dau],
  ];
  return (
    <Card className={glass}><CardHeader className="pb-2"><CardTitle className="text-sm">Growth funnel · last 7 days</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {rows.map(([l, v]) => <div key={l} className="rounded-xl bg-secondary/40 p-3"><p className="text-xl font-bold tabular-nums">{Number(v ?? 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}
      </CardContent></Card>
  );
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isModerator, isMinorAdmin, loading } = useRoles();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const enabled = isModerator; // admins and minor admins
  const full = isAdmin; // money, badges, health, audit and team are admin-only

  const { data: profiles } = useQuery({
    queryKey: ["admin", "profiles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["admin", "posts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: reels } = useQuery({
    queryKey: ["admin", "reels"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: chatReports } = useQuery({
    queryKey: ["admin", "chat-reports"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("video_chat_reports" as never).select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: events } = useQuery({
    queryKey: ["admin", "events"],
    enabled: full,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data, error } = await supabase.from("client_events" as never).select("kind,name,message,path,platform,app_version,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(3000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: bans } = useQuery({
    queryKey: ["admin", "bans"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_bans" as never).select("*").order("banned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["admin", "reports"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["admin", "withdrawals"],
    enabled: full,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin", "revenue"],
    enabled: full,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_revenue");
      if (error) throw error;
      return data as any;
    },
  });
  const kes = (n: unknown) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const { data: tickets } = useQuery({
    queryKey: ["admin", "tickets"],
    enabled: full,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const resolveTicket = async (id: string) => {
    const { error } = await supabase.from("support_tickets" as any).update({ status: "resolved" }).eq("id", id);
    if (error) { toast.error("Couldn't update ticket"); return; }
    toast.success("Ticket resolved");
    qc.invalidateQueries({ queryKey: ["admin", "tickets"] });
  };

  const { data: audit } = useQuery({
    queryKey: ["admin", "audit"],
    enabled: full,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6">
        <LiquidBackground />
        <Card className="relative z-10 max-w-md w-full border-white/10 bg-white/5 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" /> Admin access required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This console is restricted to accounts holding the admin role. Sign in with the
              official Primegram account to continue.
            </p>
            {!user && <p>You are not signed in.</p>}
            <Button variant="secondary" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Primegram
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deleteRow = async (table: "posts" | "reels" | "reports", id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin", table] });
  };

  const setBadges = async (
    userId: string,
    patch: { is_verified?: boolean; is_official?: boolean; badge?: string | null },
  ) => {
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["admin", "profiles"] });
  };

  const banUser = async (userId: string, reason: string, reportId?: string) => {
    if (!window.confirm("Ban this user? They will be locked out of the app immediately.")) return;
    const { error } = await supabase.from("user_bans" as never).upsert({ user_id: userId, reason, banned_by: user?.id } as never);
    if (error) return toast.error(error.message);
    if (reportId) await supabase.from("video_chat_reports" as never).update({ status: "actioned", resolved_by: user?.id, resolved_at: new Date().toISOString() } as never).eq("id", reportId);
    toast.success("User banned");
    qc.invalidateQueries({ queryKey: ["admin", "bans"] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-reports"] });
  };
  const unbanUser = async (userId: string) => {
    const { error } = await supabase.from("user_bans" as never).delete().eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Ban lifted");
    qc.invalidateQueries({ queryKey: ["admin", "bans"] });
  };
  const dismissChatReport = async (id: string) => {
    const { error } = await supabase.from("video_chat_reports" as never).update({ status: "dismissed", resolved_by: user?.id, resolved_at: new Date().toISOString() } as never).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "chat-reports"] });
  };

  const setReportStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status, resolved_by: user?.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`);
    qc.invalidateQueries({ queryKey: ["admin", "reports"] });
  };

  const processWithdrawal = async (w: any, action: "paid" | "reject") => {
    let receipt: string | null = null;
    let note: string | null = null;
    if (action === "paid") {
      receipt = window.prompt(`Send KES ${Number(w.amount).toLocaleString()} to ${w.phone} on M-Pesa first, then enter the M-Pesa receipt code:`);
      if (!receipt || !receipt.trim()) return;
    } else {
      note = window.prompt("Reason for rejecting (the user sees this). Their money will be refunded:", "");
      if (note === null) return;
    }
    const { error } = await supabase.rpc("admin_process_withdrawal" as any, {
      _id: w.id,
      _action: action,
      _receipt: receipt,
      _note: note,
    });
    if (error) return toast.error(error.message);
    toast.success(action === "paid" ? "Marked as paid" : "Rejected and refunded");
    qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
  };

  const usernameFor = (userId: string) => {
    const p = (profiles ?? []).find((x: any) => x.user_id === userId) as any;
    return p?.username ? `@${p.username}` : userId.slice(0, 8);
  };

  const filtered = (profiles ?? []).filter((p: any) =>
    q
      ? `${p.username ?? ""} ${p.display_name ?? ""}`.toLowerCase().includes(q.toLowerCase())
      : true,
  );

  const allStats = [
    { label: "Primegram revenue", value: kes(revenue?.total), icon: TrendingUp },
    { label: "Revenue (30d)", value: kes(revenue?.last30), icon: TrendingUp },
    { label: "Users", value: profiles?.length ?? 0, icon: Users },
    { label: "Posts", value: posts?.length ?? 0, icon: FileText },
    { label: "Reels", value: reels?.length ?? 0, icon: Video },
    { label: "Open reports", value: (reports ?? []).filter((r: any) => r.status === "open").length, icon: Flag },
    { label: "Pending withdrawals", value: (withdrawals ?? []).filter((w: any) => w.status === "pending").length, icon: Banknote },
    { label: "Payout queue (KES)", value: (withdrawals ?? []).filter((w: any) => w.status === "pending").reduce((a: number, w: any) => a + Number(w.amount || 0), 0).toLocaleString(), icon: Banknote },
    { label: "New users (7d)", value: (profiles ?? []).filter((p: any) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 864e5).length, icon: Users },
    { label: "Open tickets", value: ((tickets ?? []) as any[]).filter((t: any) => t.status !== "resolved").length, icon: Flag },
  ];
  const MONEY = ["Primegram revenue", "Revenue (30d)", "Pending withdrawals", "Payout queue (KES)", "Open tickets"];
  const stats = full ? allStats : allStats.filter((x) => !MONEY.includes(x.label));


  const glass = "border-white/10 bg-white/5 backdrop-blur-2xl";

  return (
    <div className="min-h-screen relative pb-24">
      <LiquidBackground />
      <div className="relative z-10">
        <header className={`sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b ${glass}`}>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Primegram Admin</h1>
            <Badge variant="secondary" className="ml-1">{full ? "official" : "minor admin"}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> App
          </Button>
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.map((s) => (
              <Card key={s.label} className={glass}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-full bg-primary/15 p-2.5">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="users">
            <TabsList className={`${glass} w-full justify-start overflow-x-auto`}>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="chat">Chat reports ({(chatReports ?? []).filter((r: any) => r.status === "open").length})</TabsTrigger>
              <TabsTrigger value="bans">Bans ({(bans ?? []).length})</TabsTrigger>
              {full && <TabsTrigger value="health">Health &amp; usage</TabsTrigger>}
              {full && <TabsTrigger value="revenue">Revenue</TabsTrigger>}
              {full && <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>}
              {full && <TabsTrigger value="tickets">Support ({(tickets ?? []).filter((t: any) => t.status === "open").length})</TabsTrigger>}
              {full && <TabsTrigger value="audit">Audit log</TabsTrigger>}
              {full && <TabsTrigger value="team">Team</TabsTrigger>}
            </TabsList>

            <TabsContent value="users" className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search users"
                  className="pl-9"
                />
              </div>
              {filtered.map((p: any) => (
                <Card key={p.id} className={glass}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url || undefined} alt={p.username || "user"} />
                      <AvatarFallback>{(p.username || "U")[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        @{p.username || "unknown"}
                        <VerifiedBadge isVerified={p.is_verified} isOfficial={p.is_official} badge={p.badge} />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.display_name || "—"}
                      </p>
                    </div>
                    {full && (                    <select
                      aria-label="Badge"
                      value={p.is_official ? "official" : p.badge ?? (p.is_verified ? "verified" : "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        const patch: Record<string, unknown> = { is_official: v === "official", is_verified: v === "verified", badge: ["blue", "gold", "black", "all_access"].includes(v) ? v : null };
                        void setBadges(p.user_id, patch as never);
                      }}
                      className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs"
                    >
                      <option value="">No badge</option>
                      <option value="verified">Verified (blue tick)</option>
                      <option value="official">Official (gold shield)</option>
                      <option value="blue">Prime Blue</option>
                      <option value="gold">Prime Gold</option>
                      <option value="black">Founder Black</option>
                      <option value="all_access">All Access</option>
                    </select>)}
                    {(bans ?? []).some((b: any) => b.user_id === p.user_id)
                      ? <Button size="sm" variant="secondary" onClick={() => unbanUser(p.user_id)}>Unban</Button>
                      : <Button size="sm" variant="destructive" onClick={() => { const r = window.prompt("Reason for ban:", "Violated community rules"); if (r) void banUser(p.user_id, r); }}>Ban</Button>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="content" className="mt-4 space-y-3">
              {(posts ?? []).map((post: any) => (
                <Card key={post.id} className={glass}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {post.media_url && post.media_type === "video"
                      ? <video src={post.media_url} poster={post.thumbnail_url || undefined} controls preload="metadata" playsInline className="h-24 w-16 shrink-0 rounded-lg bg-black object-cover" />
                      : post.media_url && post.media_type !== "text"
                        ? <a href={post.media_url} target="_blank" rel="noreferrer" className="shrink-0"><img src={post.media_url} alt="" loading="lazy" className="h-24 w-16 rounded-lg bg-black object-cover" /></a>
                        : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{post.caption || "No caption"}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.media_type} · {new Date(post.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteRow("posts", post.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {(reels ?? []).map((reel: any) => (
                <Card key={reel.id} className={glass}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {reel.video_url ? <video src={reel.video_url} poster={reel.thumbnail_url || undefined} controls preload="metadata" playsInline className="h-24 w-16 shrink-0 rounded-lg bg-black object-cover" /> : <Video className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{reel.caption || "Reel"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reel.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteRow("reels", reel.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="reports" className="mt-4 space-y-3">
              {(reports ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No reports filed.</p>
              )}
              {(reports ?? []).map((r: any) => (
                <Card key={r.id} className={glass}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium capitalize">{r.target_type}</span>
                      <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                    </div>
                    <p className="text-sm font-medium break-words">{r.reason}</p>
                    {r.details && <p className="rounded-lg bg-secondary/50 p-2 text-sm text-muted-foreground break-words">“{r.details}”</p>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setReportStatus(r.id, "resolved")}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReportStatus(r.id, "dismissed")}>
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="chat" className="mt-4 space-y-3">
              {(chatReports ?? []).length === 0 && <p className="text-sm text-muted-foreground">No video chat reports.</p>}
              {(chatReports ?? []).map((r: any) => {
                const count = (chatReports ?? []).filter((x: any) => x.reported_id && x.reported_id === r.reported_id).length;
                const banned = (bans ?? []).some((b: any) => b.user_id === r.reported_id);
                return (
                  <Card key={r.id} className={glass}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Flag className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium capitalize">{String(r.reason).replace(/_/g, " ")}</span>
                        <Badge variant={r.reason === "underage" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                        {count > 1 && <Badge variant="destructive">{count} reports on this user</Badge>}
                        {banned && <Badge>banned</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Reported: {r.reported_id ? usernameFor(r.reported_id) : "unknown"} · by {usernameFor(r.reporter_id)} · {new Date(r.created_at).toLocaleString()}
                      </p>
                      {r.status === "open" && (
                        <div className="flex gap-2">
                          {r.reported_id && !banned && <Button size="sm" variant="destructive" onClick={() => banUser(r.reported_id, `Video chat: ${r.reason}`, r.id)}>Ban user</Button>}
                          <Button size="sm" variant="ghost" onClick={() => dismissChatReport(r.id)}>Dismiss</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="bans" className="mt-4 space-y-3">
              {(bans ?? []).length === 0 && <p className="text-sm text-muted-foreground">No banned users.</p>}
              {(bans ?? []).map((b: any) => (
                <Card key={b.user_id} className={glass}>
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0"><p className="text-sm font-medium">{usernameFor(b.user_id)}</p><p className="truncate text-xs text-muted-foreground">{b.reason} · {new Date(b.banned_at).toLocaleDateString()}</p></div>
                    <Button size="sm" variant="secondary" onClick={() => unbanUser(b.user_id)}>Unban</Button>
                  </CardContent>
                </Card>
              ))}
              <p className="text-xs text-muted-foreground">To ban someone from anywhere, find them in the Users tab. Banned accounts are locked out on their next app load.</p>
            </TabsContent>

            {full && <TabsContent value="health" className="mt-4 space-y-3">
              <GrowthFunnel glass={glass} />
              {(() => {
                const ev = events ?? [];
                const errs = ev.filter((e) => e.kind === "error");
                const pages = ev.filter((e) => e.kind === "page");
                const top = (rows: any[], f: (r: any) => string) => Object.entries(rows.reduce((m: Record<string, number>, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
                const day = new Date(Date.now() - 864e5).toISOString();
                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[["Page views (7d)", pages.length], ["Errors (7d)", errs.length], ["Errors (24h)", errs.filter((e) => e.created_at > day).length]].map(([l, v]) => (
                        <Card key={String(l)} className={glass}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>
                      ))}
                    </div>
                    <Card className={glass}><CardHeader className="pb-1"><CardTitle className="text-sm">Top errors</CardTitle></CardHeader><CardContent className="space-y-1.5">
                      {top(errs, (e) => `${e.name}: ${(e.message || "").slice(0, 110)}`).map(([k, n]) => <p key={k} className="text-xs break-words"><b>{n}×</b> {k}</p>)}
                      {errs.length === 0 && <p className="text-xs text-muted-foreground">No errors logged. Good.</p>}
                    </CardContent></Card>
                    <Card className={glass}><CardHeader className="pb-1"><CardTitle className="text-sm">Most visited screens</CardTitle></CardHeader><CardContent className="space-y-1">
                      {top(pages, (e) => e.name).map(([k, n]) => <p key={k} className="flex justify-between text-xs"><span>{k}</span><b>{n}</b></p>)}
                    </CardContent></Card>
                    <Card className={glass}><CardHeader className="pb-1"><CardTitle className="text-sm">Where users are</CardTitle></CardHeader><CardContent className="space-y-1">
                      {top(pages, (e) => e.platform || "unknown").map(([k, n]) => <p key={k} className="flex justify-between text-xs"><span>{k}</span><b>{n}</b></p>)}
                    </CardContent></Card>
                  </>
                );
              })()}
            </TabsContent>}

            {full && <TabsContent value="revenue" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[
                  ["Total profit", revenue?.total],
                  ["Today", revenue?.today],
                  ["Last 30 days", revenue?.last30],
                  ["Primegram plans", revenue?.by_kind?.plan],
                  ["Post boosts", revenue?.by_kind?.boost],
                  ["Fees on tips & creator subs", revenue?.by_kind?.fee],
                  ["Payments processed", revenue?.gross_volume],
                  ["Paystack fees (cost)", revenue?.paystack_fees],
                  ["Creator payouts owed", revenue?.creator_payouts_owed],
                  ["Creator payouts paid", revenue?.creator_payouts_paid],
                ].map(([label, v]) => (
                  <Card key={String(label)} className={glass}><CardContent className="p-4">
                    <p className="text-lg font-bold">{kes(v)}</p><p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent></Card>
                ))}
              </div>
              <Card className={glass}><CardHeader className="pb-2"><CardTitle className="text-sm">By month</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
                {(revenue?.months ?? []).length === 0 && <p className="text-muted-foreground">No revenue yet.</p>}
                {(revenue?.months ?? []).map((m: any) => <div key={m.m} className="flex justify-between"><span>{m.m}</span><span className="font-medium">{kes(m.amount)}</span></div>)}
              </CardContent></Card>
              <Card className={glass}><CardHeader className="pb-2"><CardTitle className="text-sm">Recent earnings</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
                {(revenue?.recent ?? []).length === 0 && <p className="text-muted-foreground">Nothing yet. Plans, boosts and platform fees show here automatically.</p>}
                {(revenue?.recent ?? []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                    <div className="min-w-0"><p className="truncate">{r.source}</p><p className="text-xs text-muted-foreground">{r.username ? `@${r.username} · ` : ""}{new Date(r.at).toLocaleString()}</p></div>
                    <span className="shrink-0 font-semibold text-emerald-400">+{kes(r.amount)}</span>
                  </div>
                ))}
              </CardContent></Card>
            </TabsContent>}

            {full && <TabsContent value="withdrawals" className="mt-4 space-y-3">
              {(withdrawals ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
              )}
              {(withdrawals ?? []).map((w: any) => (
                <Card key={w.id} className={glass}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Banknote className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">KES {Number(w.amount).toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">{usernameFor(w.user_id)} · {w.phone}</span>
                      <Badge variant="secondary" className="capitalize">{w.status}</Badge>
                      {(w.risk_flags ?? []).map((f: string) => (
                        <Badge key={f} variant="destructive" className="text-[10px]">{f.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(w.created_at).toLocaleString()}
                      {w.mpesa_receipt ? ` · Receipt ${w.mpesa_receipt}` : ""}
                      {w.admin_note ? ` · ${w.admin_note}` : ""}
                    </p>
                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => processWithdrawal(w, "paid")}>
                          Mark paid
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => processWithdrawal(w, "reject")}>
                          Reject &amp; refund
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>}

            {full && <TabsContent value="tickets" className="mt-4 space-y-3">
              {(tickets ?? []).map((t: any) => (
                <Card key={t.id} className={glass}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{t.subject}</span>
                      <Badge variant="secondary" className="capitalize">{t.kind}</Badge>
                      <Badge variant={t.status === "open" ? "destructive" : "secondary"} className="capitalize">{t.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {usernameFor(t.user_id)} · {new Date(t.created_at).toLocaleString()}
                    </p>
                    {t.status === "open" && (
                      <Button size="sm" variant="secondary" onClick={() => resolveTicket(t.id)}>Mark resolved</Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(tickets ?? []).length === 0 && <p className="text-sm text-muted-foreground">No support tickets.</p>}
            </TabsContent>}

            {full && <TabsContent value="audit" className="mt-4 space-y-2">
              {(audit ?? []).map((a: any) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs ${glass}`}
                >
                  <ScrollText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="uppercase tracking-wide text-muted-foreground">{a.category}</span>
                  <span className="font-medium">{a.event}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {(audit ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> No audit events yet.
                </p>
              )}
            </TabsContent>}

            {full && <TabsContent value="team" className="mt-4 space-y-3"><TeamPanel profiles={profiles ?? []} glass={glass} /></TabsContent>}
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
