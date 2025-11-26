import React from "react";

export default function MessageBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`max-w-[80%] ${isUser ? "ml-auto text-right" : "mr-auto text-left"}`}>
      <div className={`inline-block rounded-lg px-4 py-2 ${isUser ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"}`}>
        {text}
      </div>
    </div>
  );
}

