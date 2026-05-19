import React from "react";
import Sidebar from "./Sidebar";

export default function Layout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen gradient-shell">
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-10">
        <Sidebar />
        <main className="flex-1 space-y-6">
          <header className="card px-6 py-6">
            <p className="subtle-label">AtomQuest</p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-ink/70">{subtitle}</p> : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
