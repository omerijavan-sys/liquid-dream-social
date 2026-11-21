import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, Plus, Search, Send, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Group = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

type Person = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

const GroupChats = ({ userId }: { userId: string }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadGroups = useCallback(async () => {
    const membershipQuery = supabase.from("chat_group_members" as never).select("group_id").eq("user_id", userId);
    const { data: memberships, error: memberError } = await membershipQuery as unknown as {
      data: Array<{ group_id: string }> | null;
      error: { message: string } | null;
    };
    if (memberError) {
      toast.error(memberError.message || "Could not load your groups.");
      setLoading(false);
      return;
    }
    const groupIds = (memberships ?? []).map((row) => row.group_id);
    if (!groupIds.length) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const groupQuery = supabase.from("chat_groups" as never).select("id, name, avatar_url, created_at").in("id", groupIds).order("created_at", { ascending: false });
    const { data, error } = await groupQuery as unknown as { data: Group[] | null; error: { message: string } | null };
    if (error) toast.error(error.message || "Could not load your groups.");
    setGroups(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (!photo) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const loadMessages = async () => {
      const query = supabase.from("group_messages" as never).select("id, group_id, sender_id, content, created_at").eq("group_id", selectedGroup.id).order("created_at", { ascending: true }).limit(200);
      const { data, error } = await query as unknown as { data: GroupMessage[] | null; error: { message: string } | null };
      if (cancelled) return;
      if (error) toast.error(error.message || "Could not load group messages.");
      setMessages(data ?? []);
    };
    void loadMessages();
    const channel = supabase.channel(`group-chat-${selectedGroup.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${selectedGroup.id}` }, (payload) => {
        const incoming = payload.new as GroupMessage;
        setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [selectedGroup]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const profilesQuery = supabase.from("profiles").select("user_id, display_name, username, avatar_url").neq("user_id", userId)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`).limit(12);
      const { data, error } = await profilesQuery;
      if (cancelled) return;
      setPeople(error ? [] : data ?? []);
      setSearching(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, userId]);

  const togglePerson = (person: Person) => {
    setSelectedPeople((current) => current.some((item) => item.user_id === person.user_id)
      ? current.filter((item) => item.user_id !== person.user_id)
      : current.length >= 49 ? current : [...current, person]);
  };

  const resetCreateForm = () => {
    setGroupName("");
    setPhoto(null);
    setSearch("");
    setPeople([]);
    setSelectedPeople([]);
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) return;
    setCreating(true);
    let avatarUrl: string | null = null;
    let uploadedPath: string | null = null;
    try {
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${userId}/group_${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("media").upload(uploadedPath, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("media").getPublicUrl(uploadedPath).data.publicUrl;
      }
      const callRpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await callRpc("create_chat_group", {
        _name: name,
        _avatar_url: avatarUrl,
        _member_ids: selectedPeople.map((person) => person.user_id),
      });
      if (error) throw error;
      const created: Group = { id: String(data), name, avatar_url: avatarUrl, created_at: new Date().toISOString() };
      setGroups((current) => [created, ...current]);
      setSelectedGroup(created);
      setCreateOpen(false);
      resetCreateForm();
      toast.success("Group created.");
    } catch (error) {
      if (uploadedPath) void supabase.storage.from("media").remove([uploadedPath]);
      toast.error(error instanceof Error ? error.message : "Could not create the group.");
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async () => {
    const content = message.trim();
    if (!content || !selectedGroup || sending) return;
    setMessage("");
    setSending(true);
    const insert = supabase.from("group_messages" as never).insert({ group_id: selectedGroup.id, sender_id: userId, content } as never).select("id, group_id, sender_id, content, created_at").single();
    const { data, error } = await insert as unknown as { data: GroupMessage | null; error: { message: string } | null };
    if (error) {
      setMessage(content);
      toast.error(error.message || "Message not sent. Try again.");
    } else if (data) {
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
    }
    setSending(false);
  };

  if (selectedGroup) {
    return (
      <section className="relative flex h-[calc(100dvh-7rem)] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-amber-200/15 bg-[#070707]/90 shadow-[0_12px_50px_rgba(0,0,0,.35)]" aria-label={`${selectedGroup.name} group chat`}>
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <button type="button" onClick={() => setSelectedGroup(null)} aria-label="Back to groups" className="rounded-full p-2 text-amber-200 hover:bg-amber-200/10"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-200/25 bg-amber-200/10 text-amber-100">
            {selectedGroup.avatar_url ? <img src={selectedGroup.avatar_url} alt={`${selectedGroup.name} group`} className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-amber-100">{selectedGroup.name}</h2>
            <p className="text-xs text-white/45">Group conversation</p>
          </div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && <p className="py-10 text-center text-sm text-white/45">No messages yet. Start the conversation.</p>}
          {messages.map((item) => {
            const own = item.sender_id === userId;
            return <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${own ? "border border-amber-200/25 bg-amber-200/10 text-amber-50" : "border border-white/10 bg-white/[0.04] text-white/90"}`}>
                {!own && <span className="mb-1 block text-[10px] text-amber-200/70">Member</span>}
                {item.content}
              </p>
            </div>;
          })}
          <div ref={bottomRef} />
        </div>
        <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage(); } }} maxLength={4000} aria-label="Group message" placeholder="Write a message…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-200/40" />
          <Button type="submit" size="icon" aria-label="Send group message" disabled={!message.trim() || sending} className="h-11 w-11 rounded-2xl bg-amber-300 text-black hover:bg-amber-200 disabled:opacity-50"><Send className="h-4 w-4" /></Button>
        </form>
      </section>
    );
  }

  return (
    <section aria-label="Your group chats">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">Your groups</h2>
          <p className="mt-1 text-xs text-white/45">Conversations with your people</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} className="rounded-full bg-amber-300 px-4 text-xs font-semibold text-black hover:bg-amber-200"><Plus className="mr-1.5 h-4 w-4" />Create group</Button>
      </div>
      {loading ? <div className="flex justify-center py-12 text-amber-200" role="status"><Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading groups</span></div> : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200/20 bg-white/[0.02] px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-amber-100"><Users className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-white/85">No group chats yet</p>
          <p className="mt-1 text-xs text-white/45">Start one and bring your circle together.</p>
        </div>
      ) : <div className="space-y-2">
        {groups.map((group) => <button key={group.id} type="button" onClick={() => setSelectedGroup(group)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-amber-200/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-200/25 bg-amber-200/10 text-amber-100">
            {group.avatar_url ? <img src={group.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
          </div>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-amber-100">{group.name}</span><span className="mt-1 block text-xs text-white/45">Open conversation</span></span>
          <ArrowLeft className="h-4 w-4 rotate-180 text-white/35" aria-hidden="true" />
        </button>)}
      </div>}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-amber-200/15 bg-[#0b0b0d] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Create a group</DialogTitle>
            <DialogDescription className="text-white/55">Choose a name, add a group photo, and invite people.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => photoRef.current?.click()} aria-label="Add a group profile picture" className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-amber-200/40 bg-amber-200/10 text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                {photoPreview ? <img src={photoPreview} alt="Group photo preview" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6" />}
                <span className="sr-only">Add group profile picture</span>
              </button>
              <div className="min-w-0"><p className="text-sm font-medium text-white/90">Group photo</p><p className="mt-1 text-xs text-white/45">Optional · JPG, PNG, or WebP up to 5 MB</p></div>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (!file) return;
                if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
                if (file.size > 5 * 1024 * 1024) { toast.error("Group photos must be 5 MB or smaller."); return; }
                setPhoto(file);
              }} />
              {photo && <button type="button" aria-label="Remove group photo" onClick={() => setPhoto(null)} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>}
            </div>
            <label className="block space-y-2 text-xs font-medium text-white/70">Group name
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} placeholder="e.g. Weekend plans" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-200/40" />
            </label>
            <div className="space-y-2">
              <label htmlFor="group-member-search" className="text-xs font-medium text-white/70">Add people <span className="text-white/40">({selectedPeople.length}/49)</span></label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 focus-within:border-amber-200/40"><Search className="h-4 w-4 text-amber-200/70" /><input id="group-member-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or username" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35" /></div>
              {selectedPeople.length > 0 && <div className="flex flex-wrap gap-2">{selectedPeople.map((person) => <button type="button" key={person.user_id} onClick={() => togglePerson(person)} className="flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-amber-200/10 px-2.5 py-1 text-xs text-amber-100">{person.display_name || person.username || "Member"}<X className="h-3 w-3" /><span className="sr-only">Remove {person.display_name || person.username || "member"}</span></button>)}</div>}
              {search.trim().length >= 2 && <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-1">
                {searching ? <p className="px-3 py-4 text-center text-xs text-white/45">Searching…</p> : people.length ? people.map((person) => {
                  const selected = selectedPeople.some((item) => item.user_id === person.user_id);
                  return <button type="button" key={person.user_id} onClick={() => togglePerson(person)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] ${selected ? "bg-amber-200/10" : ""}`}>
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs text-amber-100">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : (person.display_name || person.username || "U")[0].toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white/90">{person.display_name || person.username || "User"}</span><span className="block truncate text-xs text-white/40">@{person.username || "user"}</span></span>
                    <span className="text-xs text-amber-200">{selected ? "Added" : "Add"}</span>
                  </button>;
                }) : <p className="px-3 py-4 text-center text-xs text-white/45">No users found.</p>}
              </div>}
            </div>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="text-white/70 hover:bg-white/10">Cancel</Button><Button type="button" disabled={!groupName.trim() || creating} onClick={() => void createGroup()} className="bg-amber-300 text-black hover:bg-amber-200">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create group</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default GroupChats;
