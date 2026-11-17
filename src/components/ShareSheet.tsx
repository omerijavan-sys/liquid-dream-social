import { useEffect, useState } from "react";
import { Link2, Send, Share2, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ShareTarget {
  kind: "post" | "reel";
  id: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  caption?: string | null;
  username?: string | null;
  link: string;
}

interface Person { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }

const ShareSheet = ({ target, open, onOpenChange }: { target: ShareTarget; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    void (async () => {
      const q = query.trim();
      if (q.length >= 2) {
        const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url")
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq("user_id", user.id).limit(15);
        setPeople((data ?? []) as Person[]);
        return;
      }
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).limit(30);
      const ids = (follows ?? []).map(f => f.following_id);
      if (!ids.length) { setPeople([]); return; }
      const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", ids);
      setPeople((data ?? []) as Person[]);
    })();
  }, [open, query, user]);

  const sendTo = async (p: Person) => {
    if (!user || sent.has(p.user_id)) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: p.user_id,
      content: `Shared a ${target.kind}${target.caption ? `: ${target.caption.slice(0, 80)}` : ""}`,
      media_type: target.kind,
      media_url: target.mediaUrl ?? null,
      shared_ref: target.id,
    } as never);
    if (error) { toast.error(error.message.includes("can't message") ? "You can't message this user." : "Couldn't send. Try again."); return; }
    setSent(prev => new Set(prev).add(p.user_id));
    toast.success(`Sent to ${p.display_name || p.username || "user"}`);
  };

  const addToStory = async () => {
    if (!user || !target.mediaUrl) { toast.error("This item has no media to put in a story."); return; }
    setBusy(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      media_url: target.mediaUrl,
      media_type: "story",
      caption: `Shared from @${target.username || "primegram"}`,
    });
    setBusy(false);
    if (error) { toast.error("Couldn't add to your story."); return; }
    toast.success("Added to your story");
    onOpenChange(false);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(target.link); toast.success("Link copied"); } catch { toast.error("Couldn't copy link"); }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Primegram", text: target.caption || "Check this out on Primegram", url: target.link });
      else await copyLink();
    } catch { /* cancelled */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogTitle>Share {target.kind}</DialogTitle>
        <div className="grid grid-cols-3 gap-2">
          <button disabled={busy} onClick={() => void addToStory()} className="depth-press flex flex-col items-center gap-1 rounded-xl border border-border/40 p-3 text-xs"><Sparkles className="h-5 w-5 text-primary" />Your story</button>
          <button onClick={() => void copyLink()} className="depth-press flex flex-col items-center gap-1 rounded-xl border border-border/40 p-3 text-xs"><Link2 className="h-5 w-5 text-primary" />Copy link</button>
          <button onClick={() => void nativeShare()} className="depth-press flex flex-col items-center gap-1 rounded-xl border border-border/40 p-3 text-xs"><Share2 className="h-5 w-5 text-primary" />More apps</button>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people to send to" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          {people.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Search for someone, or follow people to see them here.</p>}
          <div className="space-y-1">
            {people.map(p => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-xl p-2">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.display_name || p.username || "U")[0].toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm">{p.display_name || p.username}</span>
                <button onClick={() => void sendTo(p)} disabled={sent.has(p.user_id)} className="depth-press flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                  <Send className="h-3 w-3" />{sent.has(p.user_id) ? "Sent" : "Send"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareSheet;
