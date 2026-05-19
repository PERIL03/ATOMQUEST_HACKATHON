import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navByRole = {
  EMPLOYEE: [{ label: "My Goals", path: "/employee" }],
  MANAGER: [{ label: "Team View", path: "/manager" }],
  ADMIN: [{ label: "Admin Ops", path: "/admin" }],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="card-dark w-64 shrink-0 px-6 py-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">Portal</p>
        <h2 className="text-2xl font-semibold">GoalOS</h2>
      </div>
      <div className="mt-8 space-y-3">
        {navByRole[user?.role || "EMPLOYEE"].map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-10 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
        <p className="font-semibold text-white">{user?.name}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">{user?.role}</p>
      </div>
      <button
        onClick={handleLogout}
        className="mt-6 w-full rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
      >
        Sign out
      </button>
    </aside>
  );
}
