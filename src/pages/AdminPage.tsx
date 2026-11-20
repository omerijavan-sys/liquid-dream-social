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
  BadgeCheck, Search, ScrollText, Loader2, Banknote,
} from "lucide-react";
import { toast } from "sonner";

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading } = useRoles();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const enabled = isAdmin;

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
    enabled,
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

  const { data: tickets } = useQuery({
    queryKey: ["admin", "tickets"],
    enabled,
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
    enabled,
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

  if (!isAdmin) {
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

  const stats = [
    { label: "Users", value: profiles?.length ?? 0, icon: Users },
    { label: "Posts", value: posts?.length ?? 0, icon: FileText },
    { label: "Reels", value: reels?.length ?? 0, icon: Video },
    { label: "Open reports", value: (reports ?? []).filter((r: any) => r.status === "open").length, icon: Flag },
    { label: "Pending withdrawals", value: (withdrawals ?? []).filter((w: any) => w.status === "pending").length, icon: Banknote },
    { label: "Payout queue (KES)", value: (withdrawals ?? []).filter((w: any) => w.status === "pending").reduce((a: number, w: any) => a + Number(w.amount || 0), 0).toLocaleString(), icon: Banknote },
    { label: "New users (7d)", value: (profiles ?? []).filter((p: any) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 7 * 864e5).length, icon: Users },
    { label: "Open tickets", value: ((tickets ?? []) as any[]).filter((t: any) => t.status !== "resolved").length, icon: Flag },
  ];

  const glass = "border-white/10 bg-white/5 backdrop-blur-2xl";

  return (
    <div className="min-h-screen relative pb-24">
      <LiquidBackground />
      <div className="relative z-10">
        <header className={`sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b ${glass}`}>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Primegram Admin</h1>
            <Badge variant="secondary" className="ml-1">official</Badge>
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
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="tickets">Support ({(tickets ?? []).filter((t: any) => t.status === "open").length})</TabsTrigger>
              <TabsTrigger value="audit">Audit log</TabsTrigger>
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
                    <select
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
                    </select>
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
                    <p className="text-sm text-muted-foreground break-words">{r.reason}</p>
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

            <TabsContent value="withdrawals" className="mt-4 space-y-3">
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
            </TabsContent>

            <TabsContent value="tickets" className="mt-4 space-y-3">
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
            </TabsContent>

            <TabsContent value="audit" className="mt-4 space-y-2">
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
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
