import React, { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import { apiRequest } from "../../api/client";

const emptyGoal = {
  thrustArea: "",
  title: "",
  description: "",
  uom: "NUMERIC",
  performance: "MIN",
  targetValue: 0,
  weightage: 10,
  deadline: "",
};

const uomOptions = ["NUMERIC", "PERCENTAGE", "TIMELINE", "ZERO_BASED"];
const performanceOptions = ["MIN", "MAX"];

export default function EmployeeDashboard() {
  const [sheet, setSheet] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [goals, setGoals] = useState([emptyGoal]);
  const [trend, setTrend] = useState([]);
  const [message, setMessage] = useState("");
  const [draftToast, setDraftToast] = useState("");
  const [suggestingIndex, setSuggestingIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  const locked = sheet?.status === "APPROVED";
  const goalEditingLocked = sheet && !["DRAFT", "RETURNED"].includes(sheet.status);

  const weightageTotal = useMemo(
    () => goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0),
    [goals]
  );

  const loadSheet = async () => {
    setLoading(true);
    try {
      const [data, trendData] = await Promise.all([
        apiRequest("/goalsheets/me"),
        apiRequest("/dashboard/trends"),
      ]);
      setSheet(data.sheet);
      setCycle(data.cycle);
      setTrend(trendData.trend || []);
      if (data.sheet?.goals?.length) {
        setGoals(
          data.sheet.goals.map((goal) => ({
            ...goal,
            deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
          }))
        );
      } else {
        setGoals([emptyGoal]);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheet();
  }, []);

  const draftKey = useMemo(
    () => `aq_draft_${cycle?.year || "current"}`,
    [cycle?.year]
  );

  useEffect(() => {
    if (!draftKey || loading) return;
    if (sheet?.goals?.length) return;
    if (sheet && !["DRAFT", "RETURNED"].includes(sheet.status)) return;
    const stored = localStorage.getItem(draftKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        setGoals(parsed);
        setDraftToast("Draft restored.");
      }
    } catch (error) {
      // Ignore malformed storage entries.
    }
  }, [draftKey, loading, sheet]);

  useEffect(() => {
    if (!draftKey || loading || goalEditingLocked) return;
    localStorage.setItem(draftKey, JSON.stringify(goals));
  }, [draftKey, goals, loading, goalEditingLocked]);

  useEffect(() => {
    if (!draftToast) return;
    const timer = setTimeout(() => setDraftToast(""), 3500);
    return () => clearTimeout(timer);
  }, [draftToast]);

  const handleGoalChange = (index, field, value) => {
    setGoals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addGoal = () => setGoals((prev) => [...prev, { ...emptyGoal }]);

  const removeGoal = async (index) => {
    const target = goals[index];
    if (!target) return;
    if (goalEditingLocked) return;
    if (target.source === "ADMIN_SHARED") return;
    if (target.id) {
      try {
        await apiRequest(`/goals/${target.id}`, { method: "DELETE" });
        await loadSheet();
      } catch (error) {
        setMessage(error.message);
        return;
      }
      return;
    }
    setGoals((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveDraft = async () => {
    setMessage("");
    const payload = {
      cycleYear: cycle?.year || new Date().getFullYear(),
      goals: goals.map((goal) => ({
        ...goal,
        targetValue: Number(goal.targetValue),
        weightage: Number(goal.weightage),
        deadline: goal.deadline || null,
      })),
    };
    try {
      const data = await apiRequest("/goalsheets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSheet(data.sheet);
      setMessage("Draft saved.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitSheet = async () => {
    if (!sheet) return;
    try {
      await apiRequest(`/goalsheets/${sheet.id}/submit`, { method: "PUT" });
      setMessage("Submitted for approval.");
      if (draftKey) localStorage.removeItem(draftKey);
      await loadSheet();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateAchievement = async (achievementId, updates) => {
    try {
      await apiRequest(`/achievements/${achievementId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await loadSheet();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateLocalAchievement = (achievementId, field, value) => {
    setSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        goals: prev.goals.map((goal) => ({
          ...goal,
          achievements: goal.achievements.map((achievement) =>
            achievement.id === achievementId
              ? { ...achievement, [field]: value }
              : achievement
          ),
        })),
      };
    });
  };

  const getQuarterWindow = (quarter) => {
    if (!cycle) return null;
    const bounds = {
      Q1: [cycle.q1Start, cycle.q2Start],
      Q2: [cycle.q2Start, cycle.q3Start],
      Q3: [cycle.q3Start, cycle.q4Start],
      Q4: [cycle.q4Start, cycle.q4End],
    };
    return bounds[quarter] || null;
  };

  const isQuarterOpen = (quarter) => {
    const window = getQuarterWindow(quarter);
    if (!window) return true;
    const [start, end] = window;
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
  };

  const getCycleProgress = () => {
    if (!cycle?.q1Start || !cycle?.q4End) return 0;
    const start = new Date(cycle.q1Start).getTime();
    const end = new Date(cycle.q4End).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 1;
    return (now - start) / (end - start);
  };

  const getGoalHealth = (goal) => {
    const scores = goal.achievements
      ? goal.achievements.map((item) => item.computedScore).filter((score) => score != null)
      : [];
    const achievementPercent = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
    const cycleProgress = getCycleProgress();
    const delta = achievementPercent - cycleProgress;
    if (delta >= 0.05) return { label: "On track", icon: "🟢", tone: "text-moss" };
    if (delta >= -0.15) return { label: "Watch", icon: "🟡", tone: "text-sun" };
    return { label: "At risk", icon: "🔴", tone: "text-coral" };
  };

  const suggestGoal = async (index) => {
    const goal = goals[index];
    if (!goal) return;
    setSuggestingIndex(index);
    try {
      const result = await apiRequest("/goals/suggest", {
        method: "POST",
        body: JSON.stringify({
          thrustArea: goal.thrustArea,
          description: goal.description,
        }),
      });
      const suggestion = result.suggestion;
      if (!suggestion) return;
      setGoals((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          title: suggestion.title || next[index].title,
          uom: suggestion.uom || next[index].uom,
          performance: suggestion.performance || next[index].performance,
          targetValue: suggestion.targetValue ?? next[index].targetValue,
        };
        return next;
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSuggestingIndex(null);
    }
  };

  return (
    <Layout
      title="Employee Goal Studio"
      subtitle="Shape your goals, track quarterly progress, and stay aligned with your manager."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Cycle" value={cycle?.year || "--"} tone="sun" />
        <StatCard label="Status" value={sheet?.status || "Draft"} tone="sea" />
        <StatCard label="Weightage" value={`${weightageTotal}%`} tone="moss" />
      </section>

      <section className="card px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="subtle-label">Analytics</p>
            <h2 className="section-title">Quarterly Trend</h2>
          </div>
          <p className="text-sm text-ink/50">Score out of 100</p>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <XAxis dataKey="quarter" stroke="#0d1025" />
              <YAxis domain={[0, 100]} stroke="#0d1025" />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#3a6ea5" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="subtle-label">Goal Sheet</p>
            <h2 className="section-title">Draft & Submit</h2>
          </div>
          <div className="flex gap-3">
              <button
              className="rounded-2xl border border-ink/10 px-4 py-2 text-sm font-medium"
              onClick={addGoal}
                disabled={goalEditingLocked}
            >
              Add goal
            </button>
              <button
              className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-haze"
              onClick={saveDraft}
                disabled={goalEditingLocked}
            >
              Save draft
            </button>
              <button
              className="rounded-2xl bg-coral px-4 py-2 text-sm font-semibold text-white"
              onClick={submitSheet}
                disabled={!sheet || goalEditingLocked}
            >
              Submit
            </button>
          </div>
        </div>
        {message ? <p className="text-sm text-coral">{message}</p> : null}
        {draftToast ? <p className="text-sm text-moss">{draftToast}</p> : null}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-ink/60">
            <span>Weightage validation</span>
            <span>{weightageTotal}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-ink/10">
            <div
              className={`h-2 rounded-full ${
                weightageTotal === 100 ? "bg-moss" : "bg-coral"
              }`}
              style={{ width: `${Math.min(Math.max(weightageTotal, 0), 100)}%` }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-ink/60">
                <th className="py-2">Thrust</th>
                <th>Title</th>
                <th>Description</th>
                <th>UoM</th>
                <th>Perf</th>
                <th>Target</th>
                <th>Weight</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal, index) => (
                <tr key={goal.id || index} className="border-t border-ink/10">
                  <td className="py-3">
                      <input
                      className="w-32 rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.thrustArea}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "thrustArea", e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-40 rounded-xl border border-ink/10 px-2 py-1"
                        value={goal.title}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                        onChange={(e) => handleGoalChange(index, "title", e.target.value)}
                      />
                      <button
                        className="rounded-xl border border-ink/10 px-2 py-1 text-xs"
                        onClick={() => suggestGoal(index)}
                        disabled={
                          goalEditingLocked ||
                          goal.source === "ADMIN_SHARED" ||
                          suggestingIndex === index
                        }
                      >
                        ✨ Suggest
                      </button>
                    </div>
                  </td>
                  <td>
                      <input
                      className="w-56 rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.description}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "description", e.target.value)}
                    />
                  </td>
                  <td>
                      <select
                      className="rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.uom}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "uom", e.target.value)}
                    >
                      {uomOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                      <select
                      className="rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.performance}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "performance", e.target.value)}
                    >
                      {performanceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                      <input
                      type="number"
                      className="w-20 rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.targetValue}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "targetValue", e.target.value)}
                    />
                  </td>
                  <td>
                      <input
                      type="number"
                      className="w-16 rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.weightage}
                        disabled={goalEditingLocked}
                      onChange={(e) => handleGoalChange(index, "weightage", e.target.value)}
                    />
                  </td>
                  <td>
                      <input
                      type="date"
                      className="rounded-xl border border-ink/10 px-2 py-1"
                      value={goal.deadline || ""}
                        disabled={goalEditingLocked || goal.source === "ADMIN_SHARED"}
                      onChange={(e) => handleGoalChange(index, "deadline", e.target.value)}
                    />
                  </td>
                  <td className="py-3">
                    <button
                      className="rounded-xl border border-ink/10 px-2 py-1 text-xs"
                      onClick={() => removeGoal(index)}
                      disabled={
                        goalEditingLocked ||
                        goals.length === 1 ||
                        goal.source === "ADMIN_SHARED"
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card px-6 py-6 space-y-4">
        <div>
          <p className="subtle-label">Quarterly Check-ins</p>
          <h2 className="section-title">Actuals & Status</h2>
        </div>
        {locked && sheet?.goals?.length ? (
          <div className="space-y-6">
            {sheet.goals.map((goal) => (
              <div key={goal.id} className="rounded-2xl border border-ink/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink/50">{goal.thrustArea}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{goal.title}</p>
                      <span className={`text-xs ${getGoalHealth(goal).tone}`}>
                        {getGoalHealth(goal).icon} {getGoalHealth(goal).label}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-ink/50">Target {goal.targetValue}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {goal.achievements.map((achievement) => (
                    <div key={achievement.id} className="rounded-2xl border border-ink/10 p-3">
                      <p className="subtle-label">{achievement.quarter}</p>
                      {!isQuarterOpen(achievement.quarter) ? (
                        <p className="mt-1 text-xs text-coral">Window closed</p>
                      ) : null}
                      <input
                        type="number"
                        className="mt-2 w-full rounded-xl border border-ink/10 px-2 py-1"
                        value={achievement.actualValue ?? ""}
                        onChange={(e) =>
                          updateLocalAchievement(achievement.id, "actualValue", e.target.value)
                        }
                        onBlur={(e) =>
                          updateAchievement(achievement.id, { actualValue: e.target.value })
                        }
                        disabled={!locked || !isQuarterOpen(achievement.quarter)}
                      />
                      <select
                        className="mt-2 w-full rounded-xl border border-ink/10 px-2 py-1"
                        value={achievement.status}
                        onChange={(e) =>
                          updateAchievement(achievement.id, { status: e.target.value })
                        }
                        disabled={!locked || !isQuarterOpen(achievement.quarter)}
                      >
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="ON_TRACK">On Track</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                      <input
                        type="date"
                        className="mt-2 w-full rounded-xl border border-ink/10 px-2 py-1"
                        value={achievement.completionDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          updateLocalAchievement(achievement.id, "completionDate", e.target.value)
                        }
                        onBlur={(e) =>
                          updateAchievement(achievement.id, { completionDate: e.target.value })
                        }
                        disabled={!locked || !isQuarterOpen(achievement.quarter)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/60">Quarterly check-ins unlock after approval.</p>
        )}
      </section>
    </Layout>
  );
}
