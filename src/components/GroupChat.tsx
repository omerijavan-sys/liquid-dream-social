import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Phone, Video as VideoIcon, Loader2, Palette, Paperclip, Send, Users, X, LogOut, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { themeById } from "@/utils/chatThemes";
import { openLink } from "@/utils/openLink";
import ThemePicker from "@/components/ThemePicker";
import PeoplePicker, { type Person } from "@/components/PeoplePicker";
import HangoutBar from "@/features/hangout/HangoutBar";
import { MessageActionSheet, SwipeRow, linkify } from "@/components/MessageGestures";

interface GMsg {
  id: string; group_id: string; sender_id: string; content: string; media_url?: string | null; media_type?: string | null;
  reply_to?: string | null; reactions?: Record<string, string[]> | null; edited_at?: string | null; deleted_at?: string | null; created_at: string;
}
interface Member { user_id: string; role: string }
const COLS = "id, group_id, sender_id, content, media_url, media_type, reply_to, reactions, edited_at, deleted_at, created_at";
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

const GroupChat = ({ groupId, onClose }: { groupId: string; onClose: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startCall = async (audio: boolean) => {
    if (!user) return;
    const { data, error } = await supabase.from("group_calls" as never).insert({ group_id: groupId, started_by: user.id, audio } as never).select("id").single() as { data: { id: string } | null; error: { message: string } | null };
    if (error || !data) { toast.error(error?.message ?? "Couldn't start the group call"); return; }
    navigate(`/gcall/${data.id}${audio ? "?audio=1" : ""}`);
  };
  const [group, setGroup] = useState<{ name: string; theme: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [msgs, setMsgs] = useState<GMsg[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<GMsg | null>(null);
  const [editing, setEditing] = useState<GMsg | null>(null);
  const [sheet, setSheet] = useState<GMsg | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [adding, setAdding] = useState<Map<string, Person>>(new Map());
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = useMemo(() => themeById(group?.theme), [group?.theme]);

  const loadPeople = async (ids: string[]) => {
    const need = ids.filter((i) => !people[i]);
    if (!need.length) return;
    const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", need);
    setPeople((p) => ({ ...p, ...Object.fromEntries(((data ?? []) as Person[]).map((x) => [x.user_id, x])) }));
  };
  const loadMembers = async () => {
    const { data } = await supabase.from("chat_group_members" as never).select("user_id, role").eq("group_id", groupId);
    const m = (data ?? []) as Member[]; setMembers(m); void loadPeople(m.map((x) => x.user_id));
  };

  useEffect(() => {
    let dead = false;
    void (async () => {
      const { data: g } = await supabase.from("chat_groups" as never).select("name, theme").eq("id", groupId).maybeSingle();
      if (dead) return; if (!g) { toast.error("This group isn't available."); onClose(); return; }
      setGroup(g as { name: string; theme: string });
      await loadMembers();
      const { data } = await supabase.from("group_messages" as never).select(COLS).eq("group_id", groupId).order("created_at", { ascending: false }).limit(100);
      if (!dead) { const rows = ((data ?? []) as GMsg[]).reverse(); setMsgs(rows); void loadPeople([...new Set(rows.map((r) => r.sender_id))]); }
    })();
    const ch = supabase.channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (p) => {
        const m = p.new as GMsg; setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]); void loadPeople([m.sender_id]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (p) => {
        const m = p.new as GMsg; setMsgs((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_groups", filter: `id=eq.${groupId}` }, (p) => {
        const g = p.new as { name: string; theme: string }; setGroup({ name: g.name, theme: g.theme });
      })
      .subscribe();
    return () => { dead = true; void supabase.removeChannel(ch); };
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const nameOf = (id: string) => id === user?.id ? "You" : people[id]?.display_name || people[id]?.username || "Member";
  const patch = (id: string, p: Partial<GMsg>) => setMsgs((prev) => prev.map((m) => m.id === id ? { ...m, ...p } : m));

  const send = async () => {
    const content = text.trim(); if (!content || !user) return;
    if (editing) {
      const t = editing; setText(""); setEditing(null);
      const { error } = await rpc("group_message_edit", { _id: t.id, _content: content });
      if (error) toast.error(error.message); else patch(t.id, { content, edited_at: new Date().toISOString() });
      return;
    }
    const r = replyTo; setText(""); setReplyTo(null);
    const { data, error } = await supabase.from("group_messages" as never).insert({ group_id: groupId, sender_id: user.id, content, ...(r ? { reply_to: r.id } : {}) } as never).select(COLS).single();
    if (error) { setText(content); setReplyTo(r); toast.error("Message not sent. Try again."); return; }
    const m = data as unknown as GMsg; setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
  };

  const sendMedia = async (file: File) => {
    if (!user) return;
    const type = file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "image" : null;
    if (!type) return toast.error("Choose a photo or video");
    setUploading(true);
    try {
      const path = `${user.id}/group_${Date.now()}.${file.name.split(".").pop()}`;
      const up = await supabase.storage.from("media").upload(path, file); if (up.error) throw up.error;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { data, error } = await supabase.from("group_messages" as never).insert({ group_id: groupId, sender_id: user.id, content: type === "image" ? "📷 Photo" : "🎥 Video", media_url: url, media_type: type } as never).select(COLS).single();
      if (error) throw error; const m = data as unknown as GMsg; setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(false); }
  };

  const react = async (m: GMsg, e: string) => { setSheet(null); const { data, error } = await rpc("group_message_react", { _id: m.id, _emoji: e }); if (error) toast.error(error.message); else patch(m.id, { reactions: data as Record<string, string[]> }); };
  const del = async (m: GMsg) => { setSheet(null); const { error } = await rpc("group_message_delete", { _id: m.id }); if (error) toast.error(error.message); else patch(m.id, { deleted_at: new Date().toISOString(), content: "", media_url: null, reactions: {} }); };
  const setTheme = async (id: string) => { setGroup((g) => g ? { ...g, theme: id } : g); const { error } = await rpc("group_set_theme", { _gid: groupId, _theme: id }); if (error) toast.error(error.message); };
  const addPeople = async () => {
    const ids = [...adding.keys()]; if (!ids.length) return;
    const { error } = await rpc("group_add_members", { _gid: groupId, _members: ids });
    if (error) return toast.error(error.message);
    setAdding(new Map()); toast.success("Added"); void loadMembers();
  };
  const leave = async () => { const { error } = await rpc("group_leave", { _gid: groupId }); if (error) toast.error(error.message); else { toast.success("You left the group"); onClose(); } };
  const isAdmin = members.find((m) => m.user_id === user?.id)?.role === "admin";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col text-white" style={{ background: theme.bg }}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={onClose} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={() => setInfoOpen(true)} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold">{group?.name ?? "…"}</p><p className="text-[11px] text-white/60">{members.length} members</p></button>
        <button onClick={() => void startCall(true)} aria-label="Group voice call" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Phone className="h-4 w-4" /></button>
        <button onClick={() => void startCall(false)} aria-label="Group video call" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><VideoIcon className="h-4 w-4" /></button>
        <button onClick={() => setThemeOpen(true)} aria-label="Change theme" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Palette className="h-4 w-4" /></button>
        <button onClick={() => setInfoOpen(true)} aria-label="Members" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Users className="h-4 w-4" /></button>
      </div>

      <HangoutBar groupId={groupId} myName={people[user?.id ?? ""]?.display_name || people[user?.id ?? ""]?.username || "Someone"} />

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-white/50">No messages yet. Say hello to the group!</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id; const deleted = !!m.deleted_at; const parent = m.reply_to ? msgs.find((x) => x.id === m.reply_to) : null;
          const rx = Object.entries(m.reactions ?? {}).filter(([, u]) => u.length > 0);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="mb-0.5 ml-1 text-[11px] text-white/60">{nameOf(m.sender_id)}</span>}
              <SwipeRow className="max-w-[78%]" onReply={() => { if (!deleted) { setReplyTo(m); setEditing(null); } }} onLongPress={() => { if (!deleted) setSheet(m); }}>
                <div className={`whitespace-pre-wrap break-words rounded-2xl border px-4 py-2.5 text-sm ${deleted ? "border-white/10 italic text-white/40" : "border-white/15"}`} style={deleted ? undefined : { background: mine ? theme.mine : theme.theirs }}>
                  {deleted ? "🚫 This message was deleted" : (<>
                    {parent && <div className="mb-1.5 overflow-hidden rounded-lg border-l-2 border-white/60 bg-black/25 px-2 py-1 text-[11px] text-white/75"><b>{nameOf(parent.sender_id)}</b><div className="truncate">{parent.deleted_at ? "Deleted message" : parent.content}</div></div>}
                    {m.media_type === "image" && m.media_url && <button type="button" onClick={() => openLink(m.media_url!)}><img src={m.media_url} alt="" className="mb-1 max-h-64 rounded-xl object-cover" /></button>}
                    {m.media_type === "video" && m.media_url && <video src={m.media_url} controls playsInline className="mb-1 max-h-64 rounded-xl" />}
                    {!m.media_type && linkify(m.content)}
                    {m.edited_at && <span className="ml-2 text-[10px] text-white/50">edited</span>}
                  </>)}
                </div>
                {rx.length > 0 && !deleted && <div className={`-mt-2 flex gap-1 ${mine ? "justify-end pr-2" : "pl-2"}`}>{rx.map(([e, u]) => <button key={e} onClick={() => void react(m, e)} className="rounded-full border border-white/20 bg-black/60 px-1.5 py-0.5 text-xs">{e}{u.length > 1 ? ` ${u.length}` : ""}</button>)}</div>}
              </SwipeRow>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {(replyTo || editing) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-xs backdrop-blur-xl">
            <div className="min-w-0 flex-1 border-l-2 border-white/60 pl-2"><b>{editing ? "Editing message" : `Replying to ${nameOf(replyTo!.sender_id)}`}</b><div className="truncate text-white/70">{(editing ?? replyTo)!.content}</div></div>
            <button aria-label="Cancel" onClick={() => { setReplyTo(null); setEditing(null); if (editing) setText(""); }}><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex gap-2 rounded-2xl border border-white/20 bg-black/55 p-1.5 backdrop-blur-xl">
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendMedia(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach" className="flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void send()} placeholder="Message the group…" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-white/40" />
          <button onClick={() => void send()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-xl text-black" style={{ background: theme.accent }}><Send className="h-4 w-4" /></button>
        </div>
      </div>

      {sheet && <MessageActionSheet mine={sheet.sender_id === user?.id} canEdit={sheet.sender_id === user?.id && !sheet.media_url} starred={false} onClose={() => setSheet(null)}
        onReact={(e) => void react(sheet, e)} onReply={() => { setReplyTo(sheet); setEditing(null); setSheet(null); }}
        onCopy={() => { void navigator.clipboard?.writeText(sheet.content); toast.success("Copied"); setSheet(null); }}
        onEdit={() => { setEditing(sheet); setReplyTo(null); setText(sheet.content); setSheet(null); }}
        onDeleteEveryone={() => void del(sheet)} onDeleteMe={() => { setMsgs((p) => p.filter((x) => x.id !== sheet.id)); setSheet(null); }}
        onForward={() => { void navigator.clipboard?.writeText(sheet.content); toast.success("Copied — paste it into another chat"); setSheet(null); }} onStar={() => { toast.success("Starred"); setSheet(null); }} />}
      {themeOpen && <ThemePicker value={group?.theme ?? "gold"} onPick={(id) => void setTheme(id)} onClose={() => setThemeOpen(false)} />}

      {infoOpen && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60" onClick={() => setInfoOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85%] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl border border-white/15 bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-2xl">
            <div className="flex items-center justify-between"><p className="font-semibold">{group?.name} · {members.length} members</p><button onClick={() => setInfoOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            <div className="space-y-1">{members.map((m) => <div key={m.user_id} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm"><span>{nameOf(m.user_id)}</span>{m.role === "admin" && <span className="text-[10px] text-emerald-300">admin</span>}</div>)}</div>
            {isAdmin && (<div className="space-y-2 border-t border-white/10 pt-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4" />Add people</p>
              <PeoplePicker selected={new Set(adding.keys())} exclude={members.map((m) => m.user_id)} onToggle={(p) => setAdding((prev) => { const n = new Map(prev); if (n.has(p.user_id)) n.delete(p.user_id); else n.set(p.user_id, p); return n; })} />
              {adding.size > 0 && <button onClick={() => void addPeople()} className="w-full rounded-xl bg-emerald-400 py-2 text-sm font-semibold text-black">Add {adding.size}</button>}
            </div>)}
            <button onClick={() => void leave()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 py-2 text-sm text-red-300"><LogOut className="h-4 w-4" />Leave group</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default GroupChat;
