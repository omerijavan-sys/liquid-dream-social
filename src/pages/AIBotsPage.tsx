import { authHeader } from "@/utils/authFetch";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, Lightbulb, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import GlassTabBar from "@/components/GlassTabBar";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;
const STORAGE_KEY = "primegram:ai-bot-conversations";

type Message = { role: "user" | "assistant"; content: string };
type BotProfile = { id: string; name: string; description: string; prompt: string };

const bots: BotProfile[] = [
  {
    id: "creative",
    name: "Creative Spark",
    description: "Captions, stories, and fresh content ideas",
    prompt: "You are Creative Spark, a friendly AI assistant for social content creation. Help brainstorm original captions, story ideas, and creative concepts. Be encouraging, concise, and transparent that you are an AI.",
  },
  {
    id: "study",
    name: "Study Buddy",
    description: "Explain topics and help organize learning",
    prompt: "You are Study Buddy, a patient AI learning assistant. Explain concepts clearly, ask helpful follow-up questions, and support study planning. Be transparent that you are an AI and do not claim to be a human teacher.",
  },
  {
    id: "chat",
    name: "Friendly Chat",
    description: "A positive AI companion for everyday conversation",
    prompt: "You are Friendly Chat, a warm and respectful AI conversation partner. Keep replies natural and considerate. Be transparent that you are an AI, and encourage the user to reach out to trusted people for important personal support.",
  },
];

const loadConversations = (): Record<string, Message[]> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const conversations: Record<string, Message[]> = {};
    for (const [botId, candidate] of Object.entries(stored as Record<string, unknown>)) {
      if (!Array.isArray(candidate)) continue;
      conversations[botId] = candidate.filter((message: unknown): message is Message =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant") &&
        "content" in message &&
        typeof message.content === "string",
      ).slice(-60);
    }
    return conversations;
  } catch {
    return {};
  }
};

const AIBotsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeBot, setActiveBot] = useState(bots[0]);
  const [conversations, setConversations] = useState<Record<string, Message[]>>(loadConversations);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => conversations[activeBot.id] || [], [conversations, activeBot.id]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeBot.id]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    if (!user) {
      toast.error("Sign in to chat with AI bots");
      return;
    }

    const bot = activeBot;
    const history = conversations[bot.id] || [];
    const userMessage: Message = { role: "user", content };
    const nextHistory = [...history, userMessage].slice(-60);
    setConversations((current) => ({ ...current, [bot.id]: nextHistory }));
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: await authHeader() },
        body: JSON.stringify({
          messages: [
            { role: "system", content: bot.prompt },
            ...nextHistory,
          ],
        }),
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json().catch(() => ({}));
        const message = typeof errorBody === "object" && errorBody !== null && "error" in errorBody && typeof errorBody.error === "string"
          ? errorBody.error
          : `AI chat failed (HTTP ${response.status})`;
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("The AI chat service returned no response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data).choices?.[0]?.delta?.content;
            if (typeof chunk !== "string" || !chunk) continue;
            reply += chunk;
            const assistantMessage: Message = { role: "assistant", content: reply };
            setConversations((current) => ({ ...current, [bot.id]: [...nextHistory, assistantMessage] }));
          } catch {
            // Ignore non-JSON SSE lines.
          }
        }
      }
      if (!reply.trim()) throw new Error("The AI bot returned an empty reply");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reach the AI bot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="liquid-glass-elevated safe-area-top sticky top-0 z-20">
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="depth-press">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-headline text-foreground">AI Bots</h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {bots.map((bot) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => setActiveBot(bot)}
              aria-pressed={activeBot.id === bot.id}
              className={`rounded-2xl border p-3 text-left transition-colors ${activeBot.id === bot.id ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}
            >
              <span className="flex items-center gap-2 font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" />{bot.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{bot.description}</span>
            </button>
          ))}
        </div>

        <section className="flex min-h-[55vh] flex-col rounded-2xl border border-primary/20 bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Lightbulb className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold text-foreground">{activeBot.name}</p>
              <p className="text-xs text-muted-foreground">AI bot · not a human</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto py-2">
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Say hello to {activeBot.name} to start chatting.</p>
            )}
            {messages.map((message, index) => (
              <div key={`${activeBot.id}-${index}`} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {message.content}
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="w-fit rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Thinking…</div>
            )}
            <div ref={bottomRef} />
          </div>
          {!user ? (
            <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-center">
              <p className="text-sm text-muted-foreground">Sign in to start a conversation.</p>
              <Button className="mt-2" onClick={() => navigate("/auth")}>Sign in</Button>
            </div>
          ) : (
            <form onSubmit={send} className="mt-3 flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Message ${activeBot.name}…`}
                aria-label={`Message ${activeBot.name}`}
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={2000}
                disabled={loading}
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Conversations are saved in this browser. AI replies can be inaccurate.</p>
        </section>
      </main>
      <GlassTabBar />
    </div>
  );
};

export default AIBotsPage;
