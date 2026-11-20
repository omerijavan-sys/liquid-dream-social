import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone, Video, Send, Sparkles, Search, Mic, MicOff, PenLine, Loader2, Paperclip, Square, Play as PlayIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { beginCall } from "@/utils/calls";
import { useOnline } from "@/contexts/OnlineContext";
import { Button } from "@/components/ui/button";
import { SwipeRow, MessageActionSheet, linkify, firstUrl } from "@/components/MessageGestures";
import { openLink } from "@/utils/openLink";
import GroupChat from "@/components/GroupChat";
import NewGroupSheet from "@/components/NewGroupSheet";
import { themeById } from "@/utils/chatThemes";
import { Users } from "lucide-react";
import { X, Globe } from "lucide-react";

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const speechRecognitionWindow = window as Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface ChatUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url?: string | null;
  lastMsg?: string;
  lastTime?: string;
  unread?: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read?: boolean;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | "post" | "reel" | null;
  shared_ref?: string | null;
  reply_to?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  reactions?: Record<string, string[]> | null;
  hidden_by?: string[] | null;
}

const MSG_COLS = "id, sender_id, receiver_id, content, created_at, read, media_url, media_type, shared_ref, reply_to, edited_at, deleted_at, reactions, hidden_by";

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ids: onlineIds } = useOnline();
  const [conversations, setConversations] = useState<ChatUser[]>([]);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; theme: string }>>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const loadGroups = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_group_members" as never).select("group_id, chat_groups(id, name, theme)").eq("user_id", user.id);
    const rows = ((data ?? []) as unknown as Array<{ chat_groups: { id: string; name: string; theme: string } | null }>).map(r => r.chat_groups).filter(Boolean) as Array<{ id: string; name: string; theme: string }>;
    setGroups(rows);
  }, [user]);
  useEffect(() => { void loadGroups(); }, [loadGroups, activeGroup]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [msg, setMsg] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sheetMsg, setSheetMsg] = useState<Message | null>(null);
  const [starred, setStarred] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem("primegram:starred") || "[]")); } catch { return new Set(); } });
  const [searchUser, setSearchUser] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [aiModeChats, setAiModeChats] = useState<Set<string>>(() => {
    try {
      const saved = user ? localStorage.getItem(`ai-mode-chats:${user.id}`) : null;
      return new Set(JSON.parse(saved || localStorage.getItem("ai-mode-chats") || "[]"));
    } catch { return new Set(); }
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const preserveScrollRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [voiceSearch, setVoiceSearch] = useState(false);

  useEffect(() => () => speechRecognitionRef.current?.stop(), []);

  // Deep link: /messages?to=<userId> opens that person's direct chat.
  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get("to");
    if (!to || !user || to === user.id) return;
    let cancelled = false;
    supabase.from("profiles").select("user_id, display_name, username, avatar_url").eq("user_id", to).maybeSingle()
      .then(({ data }) => { if (data && !cancelled) setActiveChat(data as ChatUser); });
    return () => { cancelled = true; };
  }, [user]);

  const toggleVoiceSearch = () => {
    if (voiceSearch) {
      speechRecognitionRef.current?.stop();
      return;
    }
    const Recognition = speechRecognitionWindow.SpeechRecognition || speechRecognitionWindow.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice search is not supported in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setSearchUser(transcript);
    };
    recognition.onerror = () => {
      setVoiceSearch(false);
      toast.error("Voice search could not recognize that. Try again.");
    };
    recognition.onend = () => {
      setVoiceSearch(false);
      speechRecognitionRef.current = null;
    };
    speechRecognitionRef.current = recognition;
    setVoiceSearch(true);
    try {
      recognition.start();
    } catch (error) {
      speechRecognitionRef.current = null;
      setVoiceSearch(false);
      toast.error(error instanceof Error ? error.message : "Voice search could not start.");
    }
  };

  const toggleAiMode = (chatId: string) => {
    setAiModeChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) { next.delete(chatId); toast.success("AI Mode off"); }
      else { next.add(chatId); toast.success("AI Mode on — replies will be labeled as AI-generated"); }
      if (user) localStorage.setItem(`ai-mode-chats:${user.id}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Build the conversation list: people you've chatted with (latest first,
  // with unread counts) plus people you follow, then keep it live.
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: msgs }, { data: follows }] = await Promise.all([
        supabase
          .from("messages")
          .select("sender_id, receiver_id, content, created_at, read")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
      ]);

      const partnerIds = new Set<string>();
      const meta = new Map<string, { lastMsg: string; lastTime: string; unread: number }>();
      for (const m of msgs || []) {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!meta.has(other)) {
          meta.set(other, { lastMsg: m.content, lastTime: m.created_at, unread: 0 });
        }
        if (m.receiver_id === user.id && !m.read) {
          const entry = meta.get(other);
          if (entry) entry.unread += 1;
        }
        partnerIds.add(other);
      }
      for (const f of follows || []) partnerIds.add(f.following_id);

      if (partnerIds.size === 0) { setConversations([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", Array.from(partnerIds));

      const list = (profiles || []).map(p => ({ ...p, ...meta.get(p.user_id) }));
      list.sort((a, b) => {
        if (a.lastTime && b.lastTime) return b.lastTime.localeCompare(a.lastTime);
        if (a.lastTime) return -1;
        if (b.lastTime) return 1;
        return 0;
      });
      setConversations(list);
    };

    load();

    // Live refresh when any message involving me arrives or is read.
    const ch = supabase
      .channel(`conv-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Ring the recipient, then open the liquid-glass call screen (real WebRTC)
  const startCall = async (recipient: ChatUser, audioOnly = false) => {
    if (!user) return;
    try {
      navigate(await beginCall(user.id, recipient.user_id, audioOnly));
    } catch (err) {
      toast.error("Could not start the call. Please try again.");
    }
  };


  useEffect(() => {
    if (!searchUser.trim() || !user) { setSearchResults([]); return; }
    const search = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .neq("user_id", user.id)
        .or(`username.ilike.%${searchUser}%,display_name.ilike.%${searchUser}%`)
        .limit(10);
      if (data) setSearchResults(data);
    };
    search();
  }, [searchUser, user]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeChat || !user) return;
    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);
    setHasOlderMessages(false);
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(MSG_COLS)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.user_id}),and(sender_id.eq.${activeChat.user_id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: false })
        .limit(61);
      if (cancelled) return;
      if (error) {
        toast.error(error.message || "Couldn't load this conversation.");
      } else {
        const rows = data ?? [];
        setHasOlderMessages(rows.length > 60);
        setMessages(rows.slice(0, 60).reverse() as Message[]);
        setLoadingMessages(false);
        void supabase.from("messages").update({ read: true })
          .eq("sender_id", activeChat.user_id).eq("receiver_id", user.id).eq("read", false)
          .then(({ error: readError }) => {
            if (readError) toast.error("Couldn't update message read status.");
          });
      }
      setLoadingMessages(false);
    };
    void fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${activeChat.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (
          (newMsg.sender_id === user.id && newMsg.receiver_id === activeChat.user_id) ||
          (newMsg.sender_id === activeChat.user_id && newMsg.receiver_id === user.id)
        ) {
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          if (newMsg.sender_id === activeChat.user_id) {
            void supabase.from("messages").update({ read: true }).eq("id", newMsg.id);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const upd = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === upd.id ? { ...m, ...upd } : m));
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeChat, user]);

  useEffect(() => {
    if (preserveScrollRef.current) {
      preserveScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadOlderMessages = async () => {
    if (!activeChat || !user || !messages[0] || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    const { data, error } = await supabase
      .from("messages")
      .select(MSG_COLS)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.user_id}),and(sender_id.eq.${activeChat.user_id},receiver_id.eq.${user.id})`)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(61);
    if (error) {
      toast.error(error.message || "Couldn't load earlier messages.");
    } else {
      const rows = data ?? [];
      setHasOlderMessages(rows.length > 60);
      preserveScrollRef.current = true;
      setMessages(previous => [...rows.slice(0, 60).reverse() as Message[], ...previous]);
    }
    setLoadingOlderMessages(false);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadAndSend = async (blob: Blob, ext: string, type: "image" | "video" | "audio") => {
    if (!activeChat || !user) return;
    if (blob.size > 50 * 1024 * 1024) { toast.error("File is too large (50 MB max)."); return; }
    setUploading(true);
    try {
      const path = `${user.id}/dm_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type || undefined });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const label = type === "image" ? "📷 Photo" : type === "video" ? "🎥 Video" : "🎤 Voice message";
      const { data, error } = await supabase.from("messages").insert({
        sender_id: user.id, receiver_id: activeChat.user_id, content: label, media_url: publicUrl, media_type: type,
      } as never).select().single();
      if (error) throw error;
      if (data) setMessages(prev => prev.some(m => m.id === (data as Message).id) ? prev : [...prev, data as Message]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) { toast.error("Choose a photo or video."); return; }
    void uploadAndSend(file, file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg"), isVideo ? "video" : "image");
  };

  const toggleVoiceNote = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) void uploadAndSend(blob, blob.type.includes("mp4") ? "m4a" : "webm", "audio");
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission is needed to record a voice message.");
    }
  };

  const rpcCall = (fn: string, args: Record<string, unknown>) =>
    (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args);

  const patchMsg = (id: string, patch: Partial<Message>) => setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

  const sendMessage = async () => {
    if (!msg.trim() || !activeChat || !user) return;
    const content = msg.trim();
    if (editing) {
      const target = editing;
      setMsg(""); setEditing(null);
      const { error } = await rpcCall("message_edit", { _id: target.id, _content: content });
      if (error) { toast.error(error.message); return; }
      patchMsg(target.id, { content, edited_at: new Date().toISOString() });
      return;
    }
    const reply = replyTo;
    setMsg(""); setReplyTo(null);
    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeChat.user_id,
      content,
      ...(reply ? { reply_to: reply.id } : {}),
    } as never).select(MSG_COLS).single();
    if (error) { setMsg(content); setReplyTo(reply); toast.error("Message not sent. Try again."); return; }
    if (data) setMessages(prev => prev.some(m => m.id === (data as Message).id) ? prev : [...prev, data as unknown as Message]);
  };

  const reactTo = async (m: Message, emoji: string) => {
    setSheetMsg(null);
    const { data, error } = await rpcCall("message_react", { _id: m.id, _emoji: emoji });
    if (error) toast.error(error.message); else patchMsg(m.id, { reactions: data as Record<string, string[]> });
  };
  const deleteMsg = async (m: Message, everyone: boolean) => {
    setSheetMsg(null);
    const { error } = await rpcCall("message_delete", { _id: m.id, _for_everyone: everyone });
    if (error) { toast.error(error.message); return; }
    if (everyone) patchMsg(m.id, { deleted_at: new Date().toISOString(), content: "", media_url: null, reactions: {} });
    else setMessages(prev => prev.filter(x => x.id !== m.id));
  };
  const toggleStar = (m: Message) => {
    setSheetMsg(null);
    setStarred(prev => {
      const n = new Set(prev); if (n.has(m.id)) n.delete(m.id); else n.add(m.id);
      try { localStorage.setItem("primegram:starred", JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  };
  const forwardMsg = async (m: Message) => {
    setSheetMsg(null);
    const text = m.content || m.media_url || "";
    try {
      if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast.success("Copied — paste it into another chat"); }
    } catch { /* cancelled */ }
  };

  if (activeChat) {
    return (
          <div className="relative flex h-dvh flex-col overflow-hidden bg-[#050505]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_28%,rgba(124,58,237,.12),transparent_35%),radial-gradient(ellipse_at_88%_22%,rgba(34,211,238,.1),transparent_35%),radial-gradient(ellipse_at_55%_100%,rgba(212,175,55,.07),transparent_44%)]" />
            <div className="liquid-glass-elevated safe-area-top">
              <div className="flex items-center gap-3 px-4 py-3 relative z-10">
                <button onClick={() => setActiveChat(null)} className="depth-press rounded-full p-1.5 hover:bg-amber-300/10 active:scale-90">
                  <ArrowLeft className="w-5 h-5 text-amber-200" />
                </button>
                <button onClick={() => navigate(`/profile/${activeChat.user_id}`)} aria-label={`Open ${activeChat.username || "user"}'s profile`} className="w-9 h-9 shrink-0 rounded-full border border-amber-200/30 bg-gradient-to-br from-amber-300/25 to-amber-700/20 flex items-center justify-center text-amber-200 text-sm font-semibold shadow-[0_0_14px_rgba(212,175,55,.2)]">
                  {(activeChat.display_name || "U")[0].toUpperCase()}
                </button>
                <button
                  onClick={() => navigate(`/profile/${activeChat.user_id}`)}
                  className="flex-1 min-w-0 truncate text-left text-headline text-amber-100 text-sm"
                  aria-label={`Open ${activeChat.username || activeChat.display_name || "user"}'s profile`}
                >
                  {activeChat.display_name || activeChat.username || "User"}
                  <span className="flex items-center gap-1.5 text-xs text-white/55"><span className={`h-1.5 w-1.5 rounded-full ${onlineIds.includes(activeChat.user_id) ? "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,.9)]" : "bg-white/25"}`} />{onlineIds.includes(activeChat.user_id) ? "Online" : "Offline"}</span>
                  {aiModeChats.has(activeChat.user_id) && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">AI ON</span>
                  )}
                </button>
                <button
                  onClick={() => toggleAiMode(activeChat.user_id)}
                  title="AI Mode — chats on your behalf, learns your style"
                  className={`depth-press w-8 h-8 rounded-full flex items-center justify-center ${aiModeChats.has(activeChat.user_id) ? "bg-gradient-to-br from-primary to-primary/60" : "liquid-glass-subtle"}`}
                >
                  <Sparkles className={`w-4 h-4 ${aiModeChats.has(activeChat.user_id) ? "text-primary-foreground" : "text-foreground"}`} />
                </button>
                <Button variant="ghost" size="icon" aria-label="Start audio call" title="Audio call" onClick={() => startCall(activeChat, true)} className="depth-press w-8 h-8 shrink-0 rounded-full liquid-glass-subtle">
                  <Phone className="w-4 h-4 text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Start video call" title="Video call" onClick={() => startCall(activeChat)} className="depth-press w-8 h-8 shrink-0 rounded-full liquid-glass-subtle">
                  <Video className="w-4 h-4 text-foreground" />
                </Button>
              </div>
            </div>

            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {hasOlderMessages && (
                <button onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages} className="mx-auto flex items-center gap-2 rounded-full border border-amber-200/20 bg-white/[0.03] px-4 py-2 text-xs text-amber-100/80 disabled:opacity-50">
                  {loadingOlderMessages && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loadingOlderMessages ? "Loading…" : "Load earlier messages"}
                </button>
              )}
              {loadingMessages && (
                <div className="flex items-center justify-center py-8 text-amber-200/70" role="status" aria-label="Loading messages">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-10">No messages yet. Say hello!</div>
              )}
              {messages.filter(m => !(m.hidden_by ?? []).includes(user?.id ?? "")).map((m, idx, list) => {
                const mine = m.sender_id === user?.id;
                const isLastMine = mine && !list.slice(idx + 1).some((x) => x.sender_id === user?.id);
                const deleted = !!m.deleted_at;
                const parent = m.reply_to ? messages.find(x => x.id === m.reply_to) : null;
                const link = !deleted && m.content && !m.media_type ? firstUrl(m.content) : null;
                const reactionEntries = Object.entries(m.reactions ?? {}).filter(([, u]) => u.length > 0);
                return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <SwipeRow className="max-w-[78%]" onReply={() => { if (!deleted) { setReplyTo(m); setEditing(null); } }} onLongPress={() => { if (!deleted) setSheetMsg(m); }}>
                  <div className={`break-words whitespace-pre-wrap px-4 py-2.5 rounded-2xl text-sm ${
                    deleted ? "border border-white/10 bg-white/[0.02] italic text-white/40" :
                    mine ? "border border-amber-200/30 bg-gradient-to-br from-amber-300/20 to-amber-700/15 text-amber-50 shadow-[0_4px_18px_rgba(212,175,55,.12)]" : "border border-white/10 bg-white/[0.03] text-white shadow-[0_6px_20px_rgba(0,0,0,.2)] backdrop-blur-xl"
                  }`}>
                    {deleted ? "🚫 This message was deleted" : (<>
                    {m.reply_to && (
                      <div className="mb-1.5 max-w-full overflow-hidden rounded-lg border-l-2 border-amber-300/70 bg-black/25 px-2 py-1 text-[11px] text-white/65">
                        <div className="font-semibold text-amber-200/80">{parent ? (parent.sender_id === user?.id ? "You" : activeChat.display_name || "Them") : "Message"}</div>
                        <div className="truncate">{parent ? (parent.deleted_at ? "Deleted message" : parent.content || (parent.media_type ? `📎 ${parent.media_type}` : "")) : "Original message unavailable"}</div>
                      </div>
                    )}
                    {m.media_type === "image" && m.media_url && <button type="button" onClick={() => openLink(m.media_url!)}><img src={m.media_url} alt="Photo" className="mb-1 max-h-64 rounded-xl object-cover" /></button>}
                    {m.media_type === "video" && m.media_url && <video src={m.media_url} controls playsInline className="mb-1 max-h-64 rounded-xl" />}
                    {m.media_type === "audio" && m.media_url && <audio src={m.media_url} controls className="h-10 max-w-full" />}
                    {(m.media_type === "post" || m.media_type === "reel") && (
                      <button
                        onClick={() => navigate(m.media_type === "reel" ? `/reels?r=${m.shared_ref}` : `/?post=${m.shared_ref}`)}
                        className="mb-1 block w-56 overflow-hidden rounded-xl border border-white/10 bg-black/30 text-left"
                      >
                        {m.media_url && (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m.media_url)
                          ? <video src={m.media_url} className="h-36 w-full object-cover" muted playsInline />
                          : <img src={m.media_url} alt="" className="h-36 w-full object-cover" />)}
                        <span className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-white/80"><PlayIcon className="h-3 w-3" />Open {m.media_type}</span>
                      </button>
                    )}
                    {!(m.media_type === "image" || m.media_type === "video" || m.media_type === "audio") && linkify(m.content)}
                    {link && (
                      <button type="button" onClick={() => openLink(link)} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-left text-[11px] text-sky-200">
                        <Globe className="h-4 w-4 shrink-0" /><span className="truncate">{link.replace(/^https?:\/\//, "")}</span>
                      </button>
                    )}
                    {m.edited_at && <span className="ml-2 text-[10px] text-white/40">edited</span>}
                    </>)}
                  </div>
                  {reactionEntries.length > 0 && !deleted && (
                    <div className={`-mt-2 flex gap-1 ${mine ? "justify-end pr-2" : "justify-start pl-2"}`}>
                      {reactionEntries.map(([e, u]) => (
                        <button key={e} onClick={() => void reactTo(m, e)} className={`rounded-full border px-1.5 py-0.5 text-xs backdrop-blur-xl ${u.includes(user?.id ?? "") ? "border-amber-300/60 bg-amber-300/20" : "border-white/15 bg-black/60"}`}>
                          {e}{u.length > 1 ? ` ${u.length}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  </SwipeRow>
                  {isLastMine && (
                    <span className={`text-[10px] mt-1 ${m.read ? "text-amber-200" : "text-white/40"}`}>
                      {m.read ? "✓✓ Seen" : "✓ Sent"}
                    </span>
                  )}
                </div>
              );})}
              <div ref={bottomRef} />
            </div>

            {sheetMsg && (
              <MessageActionSheet
                mine={sheetMsg.sender_id === user?.id}
                canEdit={sheetMsg.sender_id === user?.id && !sheetMsg.media_type && !sheetMsg.media_url}
                starred={starred.has(sheetMsg.id)}
                onClose={() => setSheetMsg(null)}
                onReact={(e) => void reactTo(sheetMsg, e)}
                onReply={() => { setReplyTo(sheetMsg); setEditing(null); setSheetMsg(null); }}
                onCopy={() => { void navigator.clipboard?.writeText(sheetMsg.content || sheetMsg.media_url || ""); toast.success("Copied"); setSheetMsg(null); }}
                onEdit={() => { setEditing(sheetMsg); setReplyTo(null); setMsg(sheetMsg.content); setSheetMsg(null); }}
                onDeleteEveryone={() => void deleteMsg(sheetMsg, true)}
                onDeleteMe={() => void deleteMsg(sheetMsg, false)}
                onForward={() => void forwardMsg(sheetMsg)}
                onStar={() => toggleStar(sheetMsg)}
              />
            )}
            <div className="relative z-10 px-4 py-3 safe-area-bottom">
              {(replyTo || editing) && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200/20 bg-black/55 px-3 py-2 text-xs text-white/70 backdrop-blur-xl">
                  <div className="min-w-0 flex-1 border-l-2 border-amber-300/70 pl-2">
                    <div className="font-semibold text-amber-200/90">{editing ? "Editing message" : `Replying to ${replyTo!.sender_id === user?.id ? "yourself" : activeChat.display_name || "them"}`}</div>
                    <div className="truncate">{(editing ?? replyTo)!.content || "📎 Media"}</div>
                  </div>
                  <button aria-label="Cancel" onClick={() => { setReplyTo(null); setEditing(null); if (editing) setMsg(""); }}><X className="h-4 w-4" /></button>
                </div>
              )}
              <div className="flex gap-2 rounded-2xl border border-amber-200/20 bg-black/55 p-1.5 shadow-[0_0_22px_rgba(212,175,55,.1)] backdrop-blur-xl">
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading || recording} aria-label="Attach photo or video" className="depth-press flex h-10 w-10 items-center justify-center rounded-xl text-amber-200 hover:bg-amber-300/10 disabled:opacity-40">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <button onClick={() => void toggleVoiceNote()} disabled={uploading} aria-label={recording ? "Stop and send voice message" : "Record voice message"} className={`depth-press flex h-10 w-10 items-center justify-center rounded-xl ${recording ? "bg-red-500 text-white animate-pulse" : "text-amber-200 hover:bg-amber-300/10"}`}>
                  {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Message..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
                <button onClick={sendMessage} aria-label="Send message" className="depth-press flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 text-black shadow-[0_0_14px_rgba(252,211,77,.3)] transition-transform hover:scale-105 active:scale-90">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
    );
  }

  if (activeGroup) return <GroupChat groupId={activeGroup} onClose={() => { setActiveGroup(null); void loadGroups(); }} />;

  const displayList = searchUser.trim() ? searchResults : conversations;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] pb-24">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_25%,rgba(124,58,237,.12),transparent_36%),radial-gradient(ellipse_at_85%_18%,rgba(34,211,238,.11),transparent_36%),radial-gradient(ellipse_at_58%_92%,rgba(212,175,55,.07),transparent_42%)]" />
      <div className="liquid-glass-elevated safe-area-top">
        <div className="flex items-center gap-3 px-5 py-4 relative z-10">
          <button onClick={() => navigate("/")} aria-label="Back to home" className="depth-press rounded-full p-1.5 hover:bg-amber-300/10 active:scale-90"><ArrowLeft className="w-5 h-5 text-amber-200" /></button>
          <span className="text-headline text-amber-100 text-base flex-1">Messages</span>
          <button onClick={() => setNewGroupOpen(true)} aria-label="New group" className="depth-press flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200"><Users className="h-4 w-4" />New group</button>
        </div>
      </div>

      <div className="relative z-10 px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-amber-200/25 bg-white/[0.035] px-3 shadow-[0_0_22px_rgba(212,175,55,.1)] backdrop-blur-xl transition-all focus-within:border-amber-200/55 focus-within:shadow-[0_0_28px_rgba(212,175,55,.18)]">
          <Search className="h-4 w-4 shrink-0 text-amber-200" />
        <input
          ref={searchInputRef}
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          placeholder="Search users..."
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/40 outline-none"
        />
          <button onClick={toggleVoiceSearch} aria-label={voiceSearch ? "Stop voice search" : "Search by voice"} className={`depth-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${voiceSearch ? "bg-amber-300/20 text-amber-100 shadow-[0_0_14px_rgba(252,211,77,.5)]" : "text-amber-200 hover:bg-amber-300/10"}`}>
            {voiceSearch ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 drop-shadow-[0_0_6px_rgba(252,211,77,.8)]" />}
          </button>
        </div>
      </div>

      <div className="relative z-10 space-y-2 px-4">
        {!searchUser.trim() && groups.map((g) => (
          <button key={g.id} onClick={() => setActiveGroup(g.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-black" style={{ background: themeById(g.theme).mine }}><Users className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-amber-100">{g.name}</span><span className="text-xs text-white/50">Group chat</span></span>
          </button>
        ))}
        {displayList.length === 0 && (
          <div className="text-center text-white/50 text-sm py-10">
            {searchUser.trim() ? "No users found" : "No conversations yet. Search for users to start chatting!"}
          </div>
        )}
        {displayList.map((conv, i) => (
          <motion.div
            key={conv.user_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(252,211,77,.13),0_8px_24px_rgba(0,0,0,.2)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200/35 hover:shadow-[inset_0_1px_0_rgba(252,211,77,.2),0_0_24px_rgba(212,175,55,.12)] active:scale-[.99]"
          >
            <button onClick={() => navigate(`/profile/${conv.user_id}`)} aria-label={`Open ${conv.username || "user"}'s profile`} className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-200/25 bg-gradient-to-br from-amber-300/25 to-amber-700/20 text-lg font-semibold text-amber-100 shadow-[0_0_14px_rgba(212,175,55,.12)]">
              {conv.avatar_url ? <img src={conv.avatar_url} alt="" className="h-full w-full object-cover" /> : (conv.display_name || conv.username || "U")[0].toUpperCase()}
              {onlineIds.includes(conv.user_id) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#090909] bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,.9)]" />}
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => navigate(`/profile/${conv.user_id}`)} className="text-left text-sm font-semibold text-amber-100 transition-colors group-hover:text-amber-200">
                {conv.display_name || conv.username || "User"}
              </button>
              <button onClick={() => setActiveChat(conv)} className="block w-full truncate text-left text-sm text-white/80">
                {conv.lastMsg || `@${conv.username || "user"}`}
              </button>
              {onlineIds.includes(conv.user_id) && <span className="text-[10px] text-amber-200/70">Online now</span>}
            </div>
            {!!conv.unread && <button onClick={() => setActiveChat(conv)} aria-label={`${conv.unread} unread messages`} className="rounded-full border border-amber-200/30 bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-100 shadow-[0_0_12px_rgba(252,211,77,.25)]">{conv.unread}</button>}
          </motion.div>
        ))}
      </div>
      {newGroupOpen && <NewGroupSheet onClose={() => setNewGroupOpen(false)} onCreated={(id) => { setNewGroupOpen(false); setActiveGroup(id); }} />}
      <button
        type="button"
        aria-label="Compose message"
        title="Compose message"
        onClick={() => {
          searchInputRef.current?.focus();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="depth-press fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/35 bg-black/70 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_0_24px_rgba(212,175,55,.28)] backdrop-blur-xl transition-transform hover:scale-105 hover:shadow-[0_0_32px_rgba(252,211,77,.4)] active:scale-90"
      >
        <PenLine className="h-5 w-5 drop-shadow-[0_0_7px_rgba(252,211,77,.9)]" />
      </button>
    </div>
  );
};

export default MessagesPage;
