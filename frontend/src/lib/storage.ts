export type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts?: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: Msg[];
  pinned: boolean;      // new
  createdAt: number;    // for sorting
  updatedAt: number;
};


const KEY = "luffy_chats_v1";

export function loadChatsLocal(): Chat[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Chat[]) : [];
  } catch (e) {
    console.error("loadChatsLocal error", e);
    return [];
  }
}

export function saveChatsLocal(chats: Chat[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(chats));
  } catch (e) {
    console.error("saveChatsLocal error", e);
  }
}

export function newChatTemplate(title = "New chat"): Chat {
  const id = Date.now().toString();
  const sys: Msg = {
    id: id + "-sys",
    role: "system",
    text: "Hey — I am Luffy. How can I help?",
    ts: Date.now()
  };

  return {
    id,
    title,
    pinned: false,
    createdAt: Date.now(),
    messages: [sys],
    updatedAt: Date.now()
  };
}



