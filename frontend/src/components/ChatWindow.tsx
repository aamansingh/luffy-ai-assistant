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
    // Use latest state snapshot
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
        console.warn(
          "generate-title request failed with status",
          gRes.status
        );
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

  // --- Send message --------------------------------------------------------

  async function sendMessage() {
    if (!input.trim() || !activeChatId) return;

    const text = input.trim();
    const chatId = activeChatId;

    setInput("");
    setLoading(true);

    const userMsg: Msg = {
      id: Date.now().toString() + "-u",
      role: "user",
      text,
      ts: Date.now(),
    };

    // Optimistic user message
    appendMessage(chatId, userMsg);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => null);
      const replyText = data?.reply ?? "No response";

      const botMsg: Msg = {
        id: Date.now().toString() + "-a",
        role: "assistant",
        text: replyText,
        ts: Date.now(),
      };

      appendMessage(chatId, botMsg);
      setTimeout(scrollToBottom, 50);

      // Generate title once if needed
      await maybeGenerateTitle(chatId, text);
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

  // --- Render -------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Inter, Roboto, sans-serif",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 260,
          borderRight: "1px solid #e6e9ef",
          padding: 16,
          boxSizing: "border-box",
          background: "#fff",
        }}
      >
        <h3 style={{ margin: "6px 0 12px 0" }}>Luffy</h3>
        <button
          onClick={newChat}
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        >
          + New chat
        </button>
        <button
          onClick={clearHistory}
          style={{ display: "block", width: "100%", marginBottom: 8 }}
        >
          Clear history
        </button>

        <div style={{ marginTop: 12 }}>
          {[...chats]
            .sort((a, b) => {
              // Pinned first, then newest by updatedAt
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return b.updatedAt - a.updatedAt;
            })
            .map((c) => (
              <div
                key={c.id}
                onClick={() => setActiveChatId(c.id)}
                style={{
                  padding: 10,
                  marginBottom: 8,
                  borderRadius: 8,
                  background:
                    c.id === activeChatId ? "#f0f6ff" : "#fafafa",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {c.title}
                    {c.pinned ? " 📌" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(c.updatedAt).toLocaleString()}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinChat(c.id);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                    title={c.pinned ? "Unpin" : "Pin"}
                  >
                    📌
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      renameChat(c.id);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                    title="Rename"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(c.id);
                    }}
                    style={{
                      fontSize: 12,
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid #f4a3a3",
                      background: "#ffecec",
                      color: "#c00",
                      cursor: "pointer",
                    }}
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#f6f8fb",
        }}
      >
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid #e6e9ef",
            background: "#fff",
          }}
        >
          <h2 style={{ margin: 0 }}>Luffy — AI Assistant</h2>
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {!activeChat ? (
            <div>Select or create a chat</div>
          ) : (
            <div>
              {activeChat.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    marginBottom: 18,
                    display: "flex",
                    justifyContent:
                      m.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background:
                        m.role === "user" ? "#1d4ed8" : "#fff",
                      color: m.role === "user" ? "#fff" : "#111",
                      boxShadow:
                        m.role === "assistant"
                          ? "0 1px 3px rgba(16,24,40,0.06)"
                          : undefined,
                    }}
                  >
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {m.text}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color:
                          m.role === "user"
                            ? "rgba(255,255,255,0.8)"
                            : "#666",
                        marginTop: 6,
                        textAlign: "right",
                      }}
                    >
                      {m.ts
                        ? new Date(m.ts).toLocaleTimeString()
                        : ""}
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid #e6e9ef",
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "#fff",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDownSend}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e6e9ef",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            style={{ padding: "10px 16px", borderRadius: 8 }}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
