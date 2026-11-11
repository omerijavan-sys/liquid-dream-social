import { authHeader } from "@/utils/authFetch";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;
const replyQueues = new Map<string, Promise<void>>();

interface IncomingMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
}

export function isAiAutoReplyEnabled(userId: string, chatId: string): boolean {
  try {
    const key = `ai-mode-chats:${userId}`;
    const saved = localStorage.getItem(key) ?? localStorage.getItem("ai-mode-chats") ?? "[]";
    return new Set<string>(JSON.parse(saved)).has(chatId);
  } catch {
    return false;
  }
}

export function replyWithAi(
  user: User,
  incoming: IncomingMessage,
): Promise<void> {
  const replyKey = `${user.id}:${incoming.sender_id}`;
  const previous = replyQueues.get(replyKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => sendReplyWithAi(user, incoming));
  replyQueues.set(replyKey, current);
  return current.finally(() => {
    if (replyQueues.get(replyKey) === current) replyQueues.delete(replyKey);
  });
}

async function sendReplyWithAi(user: User, incoming: IncomingMessage): Promise<void> {
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("sender_id, content")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${incoming.sender_id}),and(sender_id.eq.${incoming.sender_id},receiver_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: false })
      .limit(16);
    if (historyError) throw historyError;

    const { data: styleSamples, error: styleError } = await supabase
      .from("messages")
      .select("content")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (styleError) throw styleError;

    const recent = (history ?? []).reverse().map(message => ({
      role: (message.sender_id === user.id ? "assistant" : "user") as "assistant" | "user",
      content: message.content,
    }));
    const name = user.user_metadata?.nickname || user.user_metadata?.full_name || "the user";
    const system = `Write a short suggested reply for ${name}, matching their tone and keeping the conversation natural. Never invent personal facts, commitments, or sensitive information. The recipient must be told this is an AI-generated reply. Recent messages written by ${name} for style:\n${(styleSamples ?? []).map(message => message.content).reverse().join("\n")}`;

    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: await authHeader() },
      body: JSON.stringify({ messages: [{ role: "system", content: system }, ...recent] }),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw new Error(details?.error || `AI reply failed (${response.status}).`);
    }
    if (!response.body) throw new Error("AI reply did not include a response stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    let complete = false;
    while (!complete) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer) {
        lines.push(buffer);
        buffer = "";
      }
      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          complete = true;
          break;
        }
        const chunk = JSON.parse(json).choices?.[0]?.delta?.content;
        if (typeof chunk === "string") reply += chunk;
      }
      if (done) complete = true;
    }

    const text = reply.trim();
    if (!text) throw new Error("AI reply returned no text.");
    const { error: insertError } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: incoming.sender_id,
      content: `AI assistant replying for ${name}: ${text}`,
    });
    if (insertError) throw insertError;
}
