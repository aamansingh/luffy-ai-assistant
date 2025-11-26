# Luffy AI Assistant 🤖

Luffy is a personal AI assistant designed to feel like a fast, no-nonsense dev buddy — not a bloated chatbot.  
It runs on your machine, talks to AI models, and helps you with coding, notes, and experiments.

---

## 🚀 Features

- 💬 **Chat-based assistant** with persistent conversations
- 🧠 **Memory**: stores context so Luffy can remember past chats (per session / per user)
- 🏷️ **Auto-generated chat titles using Gemini** for each new conversation
- 🌐 **API backend** for handling chat, titles, and future tools
- 💻 (Optional) **Frontend UI** to manage chats visually (if you add one)
- 🔧 Designed to support:
  - Voice I/O (speech-to-text & text-to-speech)
  - Tools (file search, system commands, external APIs)
  - Multiple AI providers (OpenAI, Gemini, etc.)

---

## 🧱 Tech Stack

- **Backend:** Node.js + Express (API server)
- **Frontend (optional for now):** React / Vite (chat UI)
- **Database / Storage:** (Update: e.g. JSON, SQLite, or MongoDB if you add it)
- **AI Providers:** OpenAI, Gemini (for title generation)
- **Auth / Config:** Environment variables

> Update this section as you solidify the implementation. Don’t leave lies in here.

---

## 📁 Project Structure

Example (update to match your repo):

```bash
luffy-ai-assistant/
├─ backend/
│  ├─ src/
│  │  ├─ index.ts
│  │  ├─ routes/
│  │  ├─ services/
│  │  └─ utils/
│  ├─ package.json
│  └─ README.md
├─ frontend/          # (if/when you add UI)
│  ├─ src/
│  ├─ package.json
│  └─ README.md
├─ .gitignore
├─ README.md
└─ package.json       # if using root-level tooling


# Test change for PR workflow

This line is added to test pull request workflow.
