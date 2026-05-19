import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const demoUsers = [
  { label: "Employee", email: "alice@atomquest.demo" },
  { label: "Manager", email: "manager@atomquest.demo" },
  { label: "Admin", email: "admin@atomquest.demo" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      if (user.role === "EMPLOYEE") navigate("/employee");
      if (user.role === "MANAGER") navigate("/manager");
      if (user.role === "ADMIN") navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-shell flex items-center justify-center px-6">
      <div className="card w-full max-w-2xl p-8">
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="subtle-label">AtomQuest Hackathon</p>
            <h1 className="mt-2 text-3xl font-semibold">Goal Setting & Tracking Portal</h1>
            <p className="mt-3 text-ink/70">
              Role-aware dashboards, quarterly tracking, and audit-ready workflows.
            </p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="subtle-label">Email</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="subtle-label">Password</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink/10 px-4 py-3"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-coral">{error}</p> : null}
              <button
                className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-haze hover:opacity-90"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-white/60 p-6">
            <p className="subtle-label">Demo logins</p>
            <div className="mt-4 space-y-3">
              {demoUsers.map((user) => (
                <button
                  key={user.label}
                  type="button"
                  className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-left text-sm font-medium hover:bg-ink/5"
                  onClick={() => setEmail(user.email)}
                >
                  {user.label}
                  <span className="block text-xs text-ink/50">{user.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-xs text-ink/60">Password for all demo users: Password123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
