import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  IoChatbubbleEllipsesOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloseOutline,
  IoRefreshOutline,
  IoSend,
  IoTrashOutline,
} from "react-icons/io5";
import ReactMarkdown from "react-markdown";
import {
  clearChatHistory,
  getChatbotModels,
  streamChatMessage,
} from "../services/api";
import type { ChatAnime } from "../types/anime";
import { ChatAnimeCard } from "./ChatAnimeCard";

const SESSION_STORAGE_KEY = "nekorec_chat_session";
const STREAM_STALL_MS = 75000;

const WELCOME_MESSAGE: ChatMessage = {
  from: "bot",
  text: "Hi! I'm NekoRec 🐱 Ask me for anime suggestions.",
};

const STATUS_LABEL: Record<string, string> = {
  thinking: "Thinking…",
  searching: "Searching the anime library…",
};

type ChatMessage = {
  from: "user" | "bot";
  text: string;
  anime?: ChatAnime[];
  streaming?: boolean;
  error?: boolean;
};

const getSessionId = (): string => {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

const resetSessionId = (): string => {
  const sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
};

const TypingDots = () => (
  <span className="flex items-center gap-1">
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
      style={{ animationDelay: "0ms" }}
    />
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
      style={{ animationDelay: "150ms" }}
    />
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
      style={{ animationDelay: "300ms" }}
    />
  </span>
);

const BotAvatar = () => (
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base shadow-md">
    🐱
  </div>
);

const AnimeSources = ({ anime }: { anime: ChatAnime[] }) => {
  const [expanded, setExpanded] = useState(false);

  if (anime.length === 0) return null;

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        {expanded ? (
          <IoChevronUpOutline size={14} />
        ) : (
          <IoChevronDownOutline size={14} />
        )}
        {expanded
          ? "Hide suggestions"
          : `Show ${anime.length} suggestion${anime.length > 1 ? "s" : ""}`}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex w-full flex-col gap-2 pt-2">
              {anime.map((item, i) => (
                <ChatAnimeCard
                  key={`${item.id ?? item.title}-${i}`}
                  anime={item}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MessageRow = ({
  message,
  status,
  onRetry,
}: {
  message: ChatMessage;
  status: string | null;
  onRetry: () => void;
}) => {
  const isUser = message.from === "user";

  return (
    <div
      className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && <BotAvatar />}
      <div
        className={`flex max-w-[80%] flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-colors ${
            isUser
              ? "rounded-br-sm bg-accent text-white"
              : message.error
                ? "rounded-bl-sm border border-red-400/40 bg-red-500/10 text-text"
                : "rounded-bl-sm border border-primary/20 bg-background text-text"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {message.text ? (
                <div className="chat-prose">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              ) : null}
              {message.streaming && (
                <span className="flex items-center gap-2 py-0.5 text-xs text-text-light">
                  <TypingDots />
                  {!message.text && <span>{STATUS_LABEL[status ?? ""] ?? "Thinking…"}</span>}
                </span>
              )}
            </div>
          )}
        </div>

        {!isUser && message.anime && message.anime.length > 0 && (
          <AnimeSources anime={message.anime} />
        )}

        {!isUser && message.error && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 self-start rounded-full border border-primary/30 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
          >
            <IoRefreshOutline size={14} /> Retry
          </button>
        )}
      </div>
    </div>
  );
};

const ChatbotUi = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<
    { id: string; label: string }[]
  >([]);
  const [selectedModel, setSelectedModel] = useState(
    "mistralai/devstral-2512:free"
  );
  const [sessionId, setSessionId] = useState<string>(() => getSessionId());

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const handleGetModels = async () => {
    try {
      const res = await getChatbotModels();
      const modelsArray = res.data.models || [];
      setAvailableModels(modelsArray);
      if (modelsArray.length > 0) {
        setSelectedModel(modelsArray[0].id);
      }
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  useEffect(() => {
    handleGetModels();
  }, []);

  const updateLastBotMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].from === "bot") {
          copy[i] = updater(copy[i]);
          break;
        }
      }
      return copy;
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setLastUserMessage(text);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { from: "user", text },
      { from: "bot", text: "", streaming: true, anime: [] },
    ]);
    setIsStreaming(true);
    setStatus("thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        controller.abort();
      }, STREAM_STALL_MS);
    };
    armWatchdog();

    try {
      await streamChatMessage(text, selectedModel, sessionId, {
        signal: controller.signal,
        onStatus: (stage) => {
          setStatus(stage);
          armWatchdog();
        },
        onToken: (token) => {
          setStatus(null);
          armWatchdog();
          updateLastBotMessage((msg) => ({ ...msg, text: msg.text + token }));
        },
        onSources: (anime) => {
          armWatchdog();
          updateLastBotMessage((msg) => ({ ...msg, anime }));
        },
        onError: (message) =>
          updateLastBotMessage((msg) => ({
            ...msg,
            text: message,
            error: true,
          })),
      });
    } catch (error) {
      if (stalled) {
        updateLastBotMessage((msg) => ({
          ...msg,
          text: msg.text || "This is taking longer than expected. Please try again.",
          error: true,
        }));
      } else if (!controller.signal.aborted) {
        console.error("Error streaming message:", error);
        updateLastBotMessage((msg) => ({
          ...msg,
          text: msg.text || "Sorry, I couldn't get a response.",
          error: true,
        }));
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
      setIsStreaming(false);
      setStatus(null);
      updateLastBotMessage((msg) => ({ ...msg, streaming: false }));
      abortRef.current = null;
    }
  };

  const handleSendMessage = () => {
    sendMessage(input);
  };

  const handleRetry = () => {
    if (isStreaming || !lastUserMessage) return;
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length && copy[copy.length - 1].from === "bot") copy.pop();
      if (copy.length && copy[copy.length - 1].from === "user") copy.pop();
      return copy;
    });
    sendMessage(lastUserMessage);
  };

  const handleClearChat = async () => {
    abortRef.current?.abort();
    const currentSession = sessionId;
    setMessages([WELCOME_MESSAGE]);
    setSessionId(resetSessionId());
    setIsStreaming(false);
    setStatus(null);
    setLastUserMessage(null);

    try {
      await clearChatHistory(currentSession);
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  };

  return (
    <div className="fixed bottom-4 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="
              fixed z-50 flex flex-col overflow-hidden
              bottom-0 right-0 left-0 top-0 m-0 rounded-none w-full h-full
              md:bottom-4 md:right-8 md:left-auto md:top-auto md:m-0
              md:max-h-[700px] md:w-[400px] md:rounded-2xl md:border
              md:border-white/10 md:shadow-2xl
              bg-card
            "
            style={{ resize: "both", minWidth: "320px" }}
          >
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-accent px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow">
                  🐱
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">NekoRec</p>
                  <span className="flex items-center gap-1.5 text-[11px] text-white/85">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-300" />
                    {isStreaming ? "typing…" : "online"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="flex items-center gap-1 rounded-full px-2.5 py-2 text-xs text-white/85 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <IoTrashOutline size={16} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close"
                  className="rounded-full p-2 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <IoCloseOutline size={20} />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-4"
            >
              {messages.map((message, i) => (
                <MessageRow
                  key={i}
                  message={message}
                  status={status}
                  onRetry={handleRetry}
                />
              ))}
            </div>

            <div className="border-t border-primary/15 bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-full border border-primary/30 bg-background px-4 py-2.5 text-sm text-text placeholder-text-light outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
                  placeholder="Ask for an anime…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isStreaming}
                />

                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  title="Model"
                  className="max-w-[90px] cursor-pointer rounded-full border border-primary/30 bg-background px-2 py-2 text-[11px] text-text outline-none md:max-w-[120px]"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSendMessage}
                  disabled={isStreaming || !input.trim()}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isStreaming ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <IoSend size={18} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          onClick={() => setIsOpen(true)}
          aria-label="Open Chatbot"
          className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent p-4 text-white shadow-lg hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <IoChatbubbleEllipsesOutline size={26} />
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-accent" />
          </span>
        </motion.button>
      )}
    </div>
  );
};

export default ChatbotUi;
