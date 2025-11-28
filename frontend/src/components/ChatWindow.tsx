// src/components/ChatWindow.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  loadChatsLocal,
  newChatTemplate,
  saveChatsLocal,
} from "../lib/storage";
import type { Chat, Msg } from "../lib/storage";

type MinimalChat = Chat;

export default function ChatWindow() {
  const [chats, setChats] = useState<MinimalChat[]>(() => loadChatsLocal());
  const [activeChatId, setActiveChatId] = useState<string | null>(() =>
    chats[0]?.id ?? null
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // voice state
  const [listening, setListening] = useState(false);
  const [autoConversation, setAutoConversation] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const autoConversationRef = useRef(false);

  // track TTS speaking state for barge-in control
  const speakingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // Ensure at least one chat exists
  useEffect(() => {
    if (chats.length === 0) {
      const c = newChatTemplate();
      setChats([c]);
      setActiveChatId(c.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chats whenever they change
  useEffect(() => {
    saveChatsLocal(chats);
  }, [chats]);

  // Scroll on chat or messages change
  useEffect(() => {
    scrollToBottom();
  }, [activeChatId, chats]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  // --- Core helpers --------------------------------------------------------

  function appendMessage(chatId: string, msg: Msg) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
          : c
      )
    );
  }

  async function maybeGenerateTitle(chatId: string, text: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const isDefaultTitle =
      typeof chat.title !== "string" ||
      chat.title.trim() === "" ||
      /^New chat/i.test(chat.title);

    if (!isDefaultTitle) return;

    try {
      const gRes = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!gRes.ok) {
        console.warn("generate-title request failed with status", gRes.status);
        return;
      }

      const gData = await gRes.json().catch((err) => {
        console.warn("failed to parse generate-title JSON", err);
        return null;
      });

      const newTitle =
        gData && typeof gData.title === "string"
          ? gData.title.trim()
          : null;

      if (!newTitle) {
        console.warn("generate-title returned no valid title", gData);
        return;
      }

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, title: newTitle, updatedAt: Date.now() }
            : c
        )
      );
    } catch (e) {
      console.warn("title generation failed", e);
    }
  }

  // TTS helper: speak assistant replies, with barge-in aware onEnd
  function speak(text: string, onEnd?: () => void) {
    if (!text || !text.trim()) return;
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    try {
      // cancel any previous speech and mark it as stopped
      synth.cancel();
      speakingRef.current = false;

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 1.02;
      utter.pitch = 1;

      speakingRef.current = true;

      utter.onend = () => {
        // if we were force-stopped (barge-in), don't run onEnd
        if (!speakingRef.current) return;
        speakingRef.current = false;
        if (onEnd) onEnd();
      };

      synth.speak(utter);
    } catch (e) {
      console.warn("speech synthesis failed", e);
    }
  }

  // --- Send message core (used by text + voice) ---------------------------

  async function sendMessageFromText(text: string, fromVoice = false) {
    const trimmed = text.trim();
    if (!trimmed || !activeChatId) return;

    const chatId = activeChatId;

    setLoading(true);

    const userMsg: Msg = {
      id: Date.now().toString() + "-u",
      role: "user",
      text: trimmed,
      ts: Date.now(),
    };

    appendMessage(chatId, userMsg);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json().catch(() => null);
      const replyText = data?.reply ?? "No response";

      // If this came from voice, after speaking we may want to restart recognition
      const afterSpeak =
        fromVoice && autoConversationRef.current
          ? () => {
              if (autoConversationRef.current) {
                startVoiceInput(true);
              }
            }
          : undefined;

      speak(replyText, afterSpeak);

      const botMsg: Msg = {
        id: Date.now().toString() + "-a",
        role: "assistant",
        text: replyText,
        ts: Date.now(),
      };

      appendMessage(chatId, botMsg);
      setTimeout(scrollToBottom, 50);

      await maybeGenerateTitle(chatId, trimmed);
    } catch (err) {
      console.error("sendMessage error", err);
      const networkMsg: Msg = {
        id: Date.now().toString() + "-err",
        role: "assistant",
        text: "Network error",
        ts: Date.now(),
      };
      appendMessage(chatId, networkMsg);
    } finally {
      setLoading(false);
    }
  }

  // UI send via text input
  async function sendMessage() {
    const text = input.trim();
    if (!text || !activeChatId) return;
    setInput("");
    await sendMessageFromText(text, false);
  }

  // --- Chat management: new / clear ---------------------------------------

  function newChat() {
    const c = newChatTemplate();
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
  }

  function clearHistory() {
    const c = newChatTemplate();
    setChats([c]);
    setActiveChatId(c.id);
  }

  function onKeyDownSend(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // --- Chat list actions: delete / pin / rename ---------------------------

  function deleteChat(id: string) {
    if (!window.confirm("Delete this chat?")) return;

    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);

      try {
        localStorage.setItem("luffy_chats_v1", JSON.stringify(next));
      } catch (e) {
        console.warn("failed to persist chats after delete", e);
      }

      if (id === activeChatId) {
        if (next.length > 0) {
          setActiveChatId(next[0].id);
        } else {
          setActiveChatId(null);
        }
      }

      return next;
    });
  }

  function togglePinChat(id: string) {
    setChats((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      );

      try {
        localStorage.setItem("luffy_chats_v1", JSON.stringify(next));
      } catch (e) {
        console.warn("failed to persist chats after pin toggle", e);
      }

      return next;
    });
  }

  function renameChat(id: string) {
    setChats((prev) => {
      const target = prev.find((c) => c.id === id);
      const currentTitle = target?.title ?? "";

      const input = window.prompt("Rename chat", currentTitle);
      if (!input) return prev;

      const newTitle = input.trim();
      if (!newTitle) return prev;

      const next = prev.map((c) =>
        c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
      );

      try {
        localStorage.setItem("luffy_chats_v1", JSON.stringify(next));
      } catch (e) {
        console.warn("failed to persist chats after rename", e);
      }

      return next;
    });
  }

  // --- Voice input (Web Speech API) + conversation loop + barge-in --------

  function startVoiceInput(autoSend: boolean) {
    if (recognitionRef.current) {
      // already listening
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;

    // HARD BARGE-IN: stop any ongoing speech the moment we begin listening
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }

    setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript || "";

      if (autoSend) {
        // Don't keep it in the input, just send
        sendMessageFromText(transcript, true);
      } else {
        setInput((prev) =>
          prev ? `${prev.trim()} ${transcript}` : transcript
        );
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("speech recognition error", event.error);
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      // In continuous mode we restart AFTER TTS ends, not here.
    };

    recognition.start();
  }

  function toggleConversationMode() {
    if (autoConversationRef.current) {
      // turn OFF conversation mode
      autoConversationRef.current = false;
      setAutoConversation(false);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      setListening(false);

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      speakingRef.current = false;
    } else {
      // turn ON conversation mode
      autoConversationRef.current = true;
      setAutoConversation(true);
      startVoiceInput(true);
    }
  }

  // --- Render -------------------------------------------------------------

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold tracking-tight">Luffy</h3>
          <p className="text-xs text-slate-500">Your personal dev buddy</p>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2 border-b border-slate-100">
          <button
            onClick={newChat}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-medium py-2.5 hover:bg-blue-700 transition"
          >
            + New chat
          </button>
          <button
            onClick={clearHistory}
            className="w-full rounded-full border border-slate-200 text-xs text-slate-600 py-2 hover:bg-slate-50 transition"
          >
            Clear history
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {[...chats]
            .sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return b.updatedAt - a.updatedAt;
            })
            .map((c) => {
              const isActive = c.id === activeChatId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveChatId(c.id)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm cursor-pointer transition ${
                    isActive
                      ? "bg-blue-50 text-slate-900"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                        {c.title?.charAt(0)?.toUpperCase() || "L"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-[13px]">
                            {c.title || "New chat"}
                            {c.pinned && (
                              <span className="ml-1 text-[11px] text-amber-500">
                                📌
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {new Date(c.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinChat(c.id);
                      }}
                      className="rounded-md border border-slate-200 bg-white text-[11px] px-1.5 py-1 hover:bg-slate-50"
                      title={c.pinned ? "Unpin" : "Pin"}
                    >
                      📌
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        renameChat(c.id);
                      }}
                      className="rounded-md border border-slate-200 bg-white text-[11px] px-1.5 py-1 hover:bg-slate-50"
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(c.id);
                      }}
                      className="rounded-md border border-rose-200 bg-rose-50 text-[11px] px-1.5 py-1 text-rose-600 hover:bg-rose-100"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center px-6">
          <div>
            <h2 className="text-sm font-semibold">Luffy — AI Assistant</h2>
            {activeChat && (
              <p className="text-[11px] text-slate-400">
                {activeChat.title || "New chat"}
              </p>
            )}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 bg-slate-50">
          {!activeChat ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Select or create a chat to get started.
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {activeChat.messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex mb-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex max-w-[75%] gap-2 ${
                        isUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* avatar */}
                      <div className="mt-1">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                            isUser
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isUser ? "You" : "AI"}
                        </div>
                      </div>

                      {/* bubble */}
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          isUser
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-white text-slate-900 border border-slate-200 rounded-bl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {m.text}
                        </p>
                        <p
                          className={`mt-1 text-[10px] text-right ${
                            isUser ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {m.ts
                            ? new Date(m.ts).toLocaleTimeString()
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {/* Input */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDownSend}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition"
            />

            {/* Conversation mode button */}
            <button
              onClick={toggleConversationMode}
              className={`flex items-center justify-center rounded-full border px-3 py-2 text-sm transition ${
                autoConversation
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={
                autoConversation
                  ? listening
                    ? "Listening… tap to stop voice conversation"
                    : "Voice conversation active"
                  : "Start continuous voice conversation"
              }
            >
              {autoConversation ? (listening ? "🎙️" : "🟢") : "🎤"}
            </button>

            <button
              onClick={sendMessage}
              disabled={loading}
              className="rounded-full bg-blue-600 text-white text-sm font-medium px-4 py-2.5 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "…" : "Send"}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
