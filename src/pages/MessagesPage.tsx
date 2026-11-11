import { authHeader } from "@/utils/authFetch";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Phone, Video, Send, Sparkles, Search, Mic, MicOff, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { beginCall } from "@/utils/calls";
import { useOnline } from "@/contexts/OnlineContext";
import { Button } from "@/components/ui/button";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;

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
}

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ids: onlineIds } = useOnline();
  const [conversations, setConversations] = useState<ChatUser[]>([]);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msg, setMsg] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [aiModeChats, setAiModeChats] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ai-mode-chats") || "[]")); } catch { return new Set(); }
  });
  const aiReplyingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [voiceSearch, setVoiceSearch] = useState(false);

  useEffect(() => () => speechRecognitionRef.current?.stop(), []);

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
      else { next.add(chatId); toast.success("AI Mode on — I'll learn your style and reply for you"); }
      localStorage.setItem("ai-mode-chats", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const aiAutoReply = async (incoming: Message, chat: ChatUser) => {
    if (!user || aiReplyingRef.current) return;
    aiReplyingRef.current = true;
    try {
      // Learn personality from this user's last 40 sent messages across all chats
      const { data: myMsgs } = await supabase
        .from("messages")
        .select("content")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      const styleSamples = (myMsgs || []).map((m: any) => m.content).filter(Boolean).reverse().join("\n");
      const system = `You are impersonating the user in a chat. Reply as them, mirroring their tone, vocabulary, slang, emoji use, message length, and punctuation. Keep replies short (1-2 sentences) unless context demands more. Never reveal you are an AI.\n\nHere are recent messages the user sent (their style):\n${styleSamples}`;
      const recent = messages.slice(-10).map(m => ({
        role: (m.sender_id === user.id ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      }));
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: await authHeader() },
        body: JSON.stringify({ messages: [{ role: "system", content: system }, ...recent, { role: "user", content: incoming.content }] }),
      });
      if (!resp.ok) throw new Error("AI reply failed");
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buf = "", reply = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) reply += c;
          } catch {}
        }
      }
      const text = reply.trim();
      if (text) {
        await supabase.from("messages").insert({ sender_id: user.id, receiver_id: chat.user_id, content: text });
      }
    } catch (e) { console.error(e); }
    finally { aiReplyingRef.current = false; }
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
          .limit(500),
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
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.user_id}),and(sender_id.eq.${activeChat.user_id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
      // Mark their messages to me as read so they see "Seen".
      await supabase.from("messages").update({ read: true })
        .eq("sender_id", activeChat.user_id).eq("receiver_id", user.id).eq("read", false);
    };
    fetchMessages();

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
          // AI Mode auto-reply when message comes from the other party
          if (newMsg.sender_id === activeChat.user_id && aiModeChats.has(activeChat.user_id)) {
            aiAutoReply(newMsg, activeChat);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const upd = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === upd.id ? { ...m, ...upd } : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChat, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!msg.trim() || !activeChat || !user) return;
    const content = msg.trim();
    setMsg("");
    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeChat.user_id,
      content,
    }).select().single();
    if (error) { setMsg(content); toast.error("Message not sent. Try again."); return; }
    if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
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
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-10">No messages yet. Say hello!</div>
              )}
              {messages.map((m, idx) => {
                const mine = m.sender_id === user?.id;
                const isLastMine = mine && !messages.slice(idx + 1).some((x) => x.sender_id === user?.id);
                return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[75%] break-words whitespace-pre-wrap px-4 py-2.5 rounded-2xl text-sm ${
                    mine ? "border border-amber-200/30 bg-gradient-to-br from-amber-300/20 to-amber-700/15 text-amber-50 shadow-[0_4px_18px_rgba(212,175,55,.12)]" : "border border-white/10 bg-white/[0.03] text-white shadow-[0_6px_20px_rgba(0,0,0,.2)] backdrop-blur-xl"
                  }`}>
                    {m.content}
                  </div>
                  {isLastMine && (
                    <span className={`text-[10px] mt-1 ${m.read ? "text-amber-200" : "text-white/40"}`}>
                      {m.read ? "✓✓ Seen" : "✓ Sent"}
                    </span>
                  )}
                </div>
              );})}
              <div ref={bottomRef} />
            </div>

            <div className="relative z-10 px-4 py-3 safe-area-bottom">
              <div className="flex gap-2 rounded-2xl border border-amber-200/20 bg-black/55 p-1.5 shadow-[0_0_22px_rgba(212,175,55,.1)] backdrop-blur-xl">
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

  const displayList = searchUser.trim() ? searchResults : conversations;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] pb-24">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_25%,rgba(124,58,237,.12),transparent_36%),radial-gradient(ellipse_at_85%_18%,rgba(34,211,238,.11),transparent_36%),radial-gradient(ellipse_at_58%_92%,rgba(212,175,55,.07),transparent_42%)]" />
      <div className="liquid-glass-elevated safe-area-top">
        <div className="flex items-center gap-3 px-5 py-4 relative z-10">
          <button onClick={() => navigate("/")} aria-label="Back to home" className="depth-press rounded-full p-1.5 hover:bg-amber-300/10 active:scale-90"><ArrowLeft className="w-5 h-5 text-amber-200" /></button>
          <span className="text-headline text-amber-100 text-base flex-1">Messages</span>
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
