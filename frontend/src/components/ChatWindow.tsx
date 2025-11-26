// src/components/ChatWindow.tsx
import React, { useEffect, useRef, useState } from "react";
import { loadChatsLocal, newChatTemplate, saveChatsLocal } from "../lib/storage";
import type { Chat, Msg } from "../lib/storage";

type MinimalChat = Chat;

export default function ChatWindow() {
  const [chats, setChats] = useState<MinimalChat[]>(() => loadChatsLocal());
  const [activeChatId, setActiveChatId] = useState<string | null>(() => chats[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (chats.length === 0) {
      const c = newChatTemplate();
      setChats([c]);
      setActiveChatId(c.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveChatsLocal(chats);
  }, [chats]);

  useEffect(() => {
    scrollToBottom();
  }, [activeChatId, chats]);

  const activeChat = chats.find(c => c.id === activeChatId) ?? null;

  function upsertChat(chat: Chat) {
    setChats(prev => {
      const idx = prev.findIndex(c => c.id === chat.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = chat;
        return copy;
      } else {
        return [chat, ...prev];
      }
    });
  }

  function appendMessage(chatId: string, msg: Msg) {
    setChats(prev =>
      prev.map(c => (c.id === chatId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c))
    );
  }

  async function sendMessage() {
    if (!input.trim() || !activeChatId) return;
    const text = input.trim();
    setInput("");
    setLoading(true);

    // create user message
    const userMsg: Msg = { id: Date.now().toString() + "-u", role: "user", text, ts: Date.now() };

    // 1) Optimistically append user message (functional update)
    setChats(prevChats => {
      return prevChats.map(c => {
        if (c.id !== activeChatId) return c;
        return { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() };
      });
    });

    // Scroll (give the DOM a moment)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      // 2) send to backend
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json().catch(() => null);
      const replyText = data?.reply ?? "No response";

      const botMsg: Msg = { id: Date.now().toString() + "-a", role: "assistant", text: replyText, ts: Date.now() };

      // 3) append bot reply (functional update)
      setChats(prevChats => {
        return prevChats.map(c => {
          if (c.id !== activeChatId) return c;
          return { ...c, messages: [...c.messages, botMsg], updatedAt: Date.now() };
        });
      });

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

      // 4) Generate a title for the chat (only if it's still the default)

      try {
  // 1) Find the active chat from state only (single source of truth)
  const chatToUpdate = chats.find(ch => ch.id === activeChatId);

  // 2) Decide if we should generate a title
  const shouldGenerateTitle =
    chatToUpdate &&
    (
      typeof chatToUpdate.title !== "string" ||
      chatToUpdate.title.trim() === "" ||
      /^New chat/i.test(chatToUpdate.title) // adjust if your default title differs
    );

  if (!shouldGenerateTitle) {
    // Nothing to do, title already set
    return;
  }

  // 3) Call your /api/generate-title endpoint
  const gRes = await fetch("/api/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }) // or use the whole conversation if you want
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

  // 4) Update state AND localStorage in one place (state is the source of truth)
  setChats(prev => {
    const updated = prev.map(c =>
      c.id === activeChatId
        ? { ...c, title: newTitle, updatedAt: Date.now() }
        : c
    );

    try {
      localStorage.setItem("luffy_chats_v1", JSON.stringify(updated));
    } catch (e) {
      console.warn("failed to persist chats to localStorage", e);
    }

    return updated;
  });

} catch (e) {
  console.warn("title generation failed", e);
}


      // try {
      //   // Only request a generated title if current chat title looks like the default
      //   const latestChatsRaw = localStorage.getItem("luffy_chats_v1");
      //   const latestChats = latestChatsRaw ? (JSON.parse(latestChatsRaw) as any[]) : [];
      //   const chatToUpdate = latestChats.find(ch => ch.id === activeChatId) ?? chats.find(ch => ch.id === activeChatId);

      //   const shouldGenerateTitle =
      //     chatToUpdate &&
      //     (typeof chatToUpdate.title !== "string" ||
      //       chatToUpdate.title.trim() === "" ||
      //       /^New chat/i.test(chatToUpdate.title)); // adjust pattern if your default differs

      //   if (shouldGenerateTitle) {
      //     // Call generate-title endpoint with the user message (or assistant reply if you prefer)
      //     const gRes = await fetch("/api/generate-title", {
      //       method: "POST",
      //       headers: { "Content-Type": "application/json" },
      //       body: JSON.stringify({ message: text })
      //     });

      //     const gData = await gRes.json().catch(() => null);
      //     const newTitle = (gData && gData.title) ? String(gData.title).trim() : null;

      //     if (newTitle) {
      //       // apply title update to local state (functional update)
      //       setChats(prev => prev.map(c => (c.id === activeChatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c)));
      //       // persist to localStorage (saveChatsLocal effect will run, but ensure local copy)
      //       const updated = (latestChats.length ? latestChats : prevChatsFromState(chats)).map((c: any) =>
      //         c.id === activeChatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
      //       );
      //       localStorage.setItem("luffy_chats_v1", JSON.stringify(updated));
      //     }
      //   }
      // } catch (e) {
      //   console.warn("title generation failed", e);
      // }

      // 5) attempt background sync (non-blocking)
      try {
        const raw = localStorage.getItem("luffy_chats_v1");
        const local = raw ? (JSON.parse(raw) as any[]) : [];
        const chatToSync = local.find(ch => ch.id === activeChatId);
        if (chatToSync) {
          fetch("/api/chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat: chatToSync })
          }).catch(e => console.warn("sync chat failed", e));
        }
      } catch (e) {
        console.warn("background sync error", e);
      }
    } catch (err) {
      console.error("sendMessage error", err);
      const networkMsg: Msg = { id: Date.now().toString() + "-err", role: "assistant", text: "Network error", ts: Date.now() };
      setChats(prevChats => prevChats.map(c => (c.id === activeChatId ? { ...c, messages: [...c.messages, networkMsg], updatedAt: Date.now() } : c)));
    } finally {
      setLoading(false);
    }
  }

  // helper: if local storage is empty, convert current state to array for persistence
  function prevChatsFromState(currentState: MinimalChat[]) {
    return currentState.map(c => ({ ...c }));
  }

  function newChat() {
    const c = newChatTemplate();
    setChats(prev => [c, ...prev]);
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

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, Roboto, sans-serif" }}>
      <div style={{ width: 260, borderRight: "1px solid #e6e9ef", padding: 16, boxSizing: "border-box", background:"#fff" }}>
        <h3 style={{ margin: "6px 0 12px 0" }}>Luffy</h3>
        <button onClick={newChat} style={{ display: "block", width: "100%", marginBottom: 8 }}>+ New chat</button>
        <button onClick={clearHistory} style={{ display: "block", width: "100%", marginBottom: 8 }}>Clear history</button>

        <div style={{ marginTop: 12 }}>
          {chats.map(c => (
            <div
              key={c.id}
              onClick={() => setActiveChatId(c.id)}
              style={{
                padding: 10,
                marginBottom: 8,
                borderRadius: 8,
                background: c.id === activeChatId ? "#f0f6ff" : "#fafafa",
                cursor: "pointer"
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "#666" }}>{new Date(c.updatedAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f6f8fb" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #e6e9ef", background:"#fff" }}>
          <h2 style={{ margin: 0 }}>Luffy — AI Assistant</h2>
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {!activeChat ? <div>Select or create a chat</div> : (
            <div>
              {activeChat.messages.map(m => (
                <div key={m.id} style={{ marginBottom: 18, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "70%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: m.role === "user" ? "#1d4ed8" : "#fff",
                    color: m.role === "user" ? "#fff" : "#111",
                    boxShadow: m.role === "assistant" ? "0 1px 3px rgba(16,24,40,0.06)" : undefined
                  }}>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.text}</div>
                    <div style={{ fontSize: 11, color: m.role === "user" ? "rgba(255,255,255,0.8)" : "#666", marginTop: 6, textAlign: "right" }}>
                      {m.ts ? new Date(m.ts).toLocaleTimeString() : ""}
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #e6e9ef", display: "flex", gap: 8, alignItems: "center", background:"#fff" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDownSend}
            placeholder="Type a message..."
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e6e9ef" }}
          />
          <button onClick={sendMessage} disabled={loading} style={{ padding: "10px 16px", borderRadius: 8 }}>
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
