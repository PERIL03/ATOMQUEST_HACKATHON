import React from "react";

export default function StatCard({ label, value, tone }) {
  const toneClass =
    tone === "sun"
      ? "border-sun/40"
      : tone === "sea"
      ? "border-sea/40"
      : "border-moss/40";

  return (
    <div className={`card px-5 py-4 border ${toneClass}`}>
      <p className="subtle-label">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
