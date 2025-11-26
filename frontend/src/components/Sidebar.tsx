import React from "react";

export default function Sidebar() {
  return (
    <aside className="w-72 bg-white border-r p-4 hidden md:block">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Luffy</h2>
        <p className="text-sm text-slate-500">AI Assistant</p>
      </div>

      <div className="space-y-2">
        <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">New chat</button>
        <div className="pt-4 text-xs text-slate-400">Recent</div>
        <div className="mt-2 space-y-1">
          <div className="px-3 py-2 rounded bg-slate-50">Example chat 1</div>
          <div className="px-3 py-2 rounded bg-slate-50">Example chat 2</div>
        </div>
      </div>
    </aside>
  );
}
