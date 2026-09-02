"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChatMessages } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { streamChat, ResearchApiError, type ChatSource } from "./researchApi";
import { useQueryClient } from "@tanstack/react-query";
import { researchQueryKeys } from "./useResearchQueries";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  paperId?: string;
  onClose: () => void;
}

export function ChatPanel({ paperId, onClose }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useResearchToast();
  const queryClient = useQueryClient();

  const history = useChatMessages(sessionId ?? null);

  useEffect(() => {
    if (history.data) {
      setMessages(
        history.data.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      );
    }
  }, [history.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const message = input.trim();
    if (!message || isStreaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      await streamChat({
        sessionId,
        paperId,
        message,
        onSources: (newSources, newSessionId) => {
          setSources(newSources);
          if (!sessionId) setSessionId(newSessionId);
        },
        onDelta: (accumulated) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: accumulated };
            return next;
          });
        },
      });
      queryClient.invalidateQueries({ queryKey: researchQueryKeys.chatSessions });
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Chat failed. Please try again.");
      setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant placeholder
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>{paperId ? "Chat with this paper" : "Chat with your library"}</CardTitle>
        <button onClick={onClose} className="rounded p-1 text-mist hover:bg-surface hover:text-ink" aria-label="Close chat">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-mist">
            Ask a question grounded in {paperId ? "this paper's" : "your uploaded papers'"} actual text — answers cite the
            passages they come from.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto bg-signal/10 text-ink" : "bg-surface text-ink"
            }`}
          >
            {m.content || (isStreaming && i === messages.length - 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "")}
          </div>
        ))}
        {sources.length > 0 && (
          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-mist">
              <FileText className="h-3.5 w-3.5" /> Sources used in the last answer
            </p>
            <ul className="space-y-1">
              {sources.map((s, i) => (
                <li key={i} className="text-xs text-mist">
                  Page {s.pageIndex ?? "?"}: <span className="italic">&ldquo;{s.snippet.slice(0, 100)}…&rdquo;</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 flex shrink-0 gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask a question…"
          disabled={isStreaming}
        />
        <Button size="md" onClick={() => void handleSend()} disabled={isStreaming || !input.trim()} aria-label="Send message">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}
