import React from "react";
import Sidebar from "./Sidebar.tsx";
import ChatWindow from "./ChatWindow";

export default function ChatLayout() {
  return (
    <div className="min-h-screen flex bg-slate-100">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
