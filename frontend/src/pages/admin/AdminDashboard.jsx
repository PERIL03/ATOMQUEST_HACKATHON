import React, { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import { apiRequest } from "../../api/client";

const sharedGoalTemplate = {
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

export default function AdminDashboard() {
  const [completion, setCompletion] = useState(null);
  const [audit, setAudit] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [goal, setGoal] = useState(sharedGoalTemplate);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [message, setMessage] = useState("");
  const [orgTrend, setOrgTrend] = useState([]);
  const [teamTrend, setTeamTrend] = useState([]);
  const [managerTrend, setManagerTrend] = useState([]);

  const getLatestScore = (trend) => {
    const order = ["Q1", "Q2", "Q3", "Q4"];
    const sorted = [...trend].sort(
      (a, b) => order.indexOf(a.quarter) - order.indexOf(b.quarter)
    );
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i].score > 0) return sorted[i].score;
    }
    return sorted[sorted.length - 1]?.score || 0;
  };

  const getQoQDelta = (trend) => {
    const order = ["Q1", "Q2", "Q3", "Q4"];
    const sorted = [...trend].sort(
      (a, b) => order.indexOf(a.quarter) - order.indexOf(b.quarter)
    );
    const nonZero = sorted.filter((point) => point.score > 0);
    if (nonZero.length >= 2) {
      const last = nonZero[nonZero.length - 1].score;
      const prev = nonZero[nonZero.length - 2].score;
      return last - prev;
    }
    if (nonZero.length === 1) return nonZero[0].score;
    return 0;
  };

  const topManagers = [...managerTrend]
    .map((manager) => ({
      ...manager,
      latestScore: getLatestScore(manager.trend || []),
      delta: getQoQDelta(manager.trend || []),
    }))
    .sort((a, b) => b.latestScore - a.latestScore)
    .slice(0, 3);

  const biggestDelta = [...managerTrend]
    .map((manager) => ({
      ...manager,
      delta: getQoQDelta(manager.trend || []),
    }))
    .sort((a, b) => b.delta - a.delta)[0];

  const deltaTone = (delta) => {
    if (delta > 0) return "text-moss";
    if (delta < 0) return "text-coral";
    return "text-ink/60";
  };

  const deltaArrow = (delta) => {
    if (delta > 0) return "▲";
    if (delta < 0) return "▼";
    return "■";
  };

  const loadData = async () => {
    try {
      const [dash, logs, allSheets, trends, users] = await Promise.all([
        apiRequest("/dashboard/completion"),
        apiRequest("/admin/audit"),
        apiRequest("/goalsheets/all"),
        apiRequest("/dashboard/trends"),
        apiRequest("/admin/users"),
      ]);
      setCompletion(dash);
      setAudit(logs.logs);
      setSheets(allSheets.sheets);
      setCycle(allSheets.cycle);
      setOrgTrend(trends.average || []);
      setTeamTrend(trends.team || []);
      setManagerTrend(trends.managerGroups || []);
      setEmployees(users.users || []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pushSharedGoal = async () => {
    try {
      await apiRequest("/admin/shared-goals", {
        method: "POST",
        body: JSON.stringify({
          cycleYear: cycle?.year || new Date().getFullYear(),
          employeeIds: selectedEmployeeIds,
          goal: { ...goal, targetValue: Number(goal.targetValue), weightage: Number(goal.weightage) },
        }),
      });
      setMessage("Shared goal pushed.");
      setGoal(sharedGoalTemplate);
      setSelectedEmployeeIds([]);
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const unlockSheet = async (sheetId) => {
    try {
      await apiRequest(`/goalsheets/${sheetId}/unlock`, { method: "PUT" });
      setMessage("Sheet unlocked.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const runEscalations = async () => {
    try {
      const result = await apiRequest("/admin/escalations/run", { method: "POST" });
      setMessage(`Escalations processed: ${result.escalations || 0}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <Layout
      title="Admin Mission Control"
      subtitle="Manage cycles, push shared goals, and audit progress for every team."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Goals" value={completion?.totalGoals || 0} tone="sun" />
        <StatCard label="Completed" value={completion?.completed || 0} tone="sea" />
        <StatCard label="Completion" value={`${completion?.completionRate || 0}%`} tone="moss" />
      </section>
      <section className="card px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="subtle-label">Analytics</p>
            <h2 className="section-title">Org QoQ Trend</h2>
          </div>
          <p className="text-sm text-ink/50">Average score</p>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={orgTrend}>
              <XAxis dataKey="quarter" stroke="#0d1025" />
              <YAxis domain={[0, 100]} stroke="#0d1025" />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#3a6ea5" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {teamTrend.map((member) => (
            <div key={member.employeeId} className="rounded-2xl border border-ink/10 px-4 py-3">
              <p className="text-sm font-semibold">{member.name}</p>
              <div className="mt-2 flex gap-3 text-xs text-ink/60">
                {member.trend.map((point) => (
                  <span key={point.quarter}>
                    {point.quarter}: {point.score}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="card px-6 py-6">
        <div>
          <p className="subtle-label">Manager Effectiveness</p>
          <h2 className="section-title">Team QoQ by Manager</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Top 3 Managers</p>
            <div className="mt-3 space-y-2">
              {topManagers.map((manager, index) => (
                <div key={manager.managerId} className="flex items-center justify-between text-sm">
                  <span>
                    {index + 1}. {manager.managerName}
                  </span>
                  <span className="text-ink/60">{manager.latestScore}</span>
                </div>
              ))}
              {topManagers.length === 0 ? (
                <p className="text-sm text-ink/50">No manager data yet.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-ink/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Biggest QoQ Gain</p>
            {biggestDelta ? (
              <div className="mt-3 text-sm">
                <p className="font-semibold">{biggestDelta.managerName}</p>
                <p className={`text-ink/60 ${deltaTone(biggestDelta.delta)}`}>
                  {deltaArrow(biggestDelta.delta)} Delta: {biggestDelta.delta}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink/50">No trend data yet.</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {managerTrend.map((manager) => (
            <div key={manager.managerId} className="rounded-2xl border border-ink/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{manager.managerName}</p>
                <span className={`text-xs ${deltaTone(getQoQDelta(manager.trend || []))}`}>
                  {deltaArrow(getQoQDelta(manager.trend || []))} {getQoQDelta(manager.trend || [])}
                </span>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-ink/60">
                {manager.trend.map((point) => (
                  <span key={point.quarter}>
                    {point.quarter}: {point.score}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {message ? <p className="text-sm text-coral">{message}</p> : null}
      <section className="card px-6 py-6 space-y-4">
        <div>
          <p className="subtle-label">Shared Goals</p>
          <h2 className="section-title">Push to Employees</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-ink/60">Select employees</p>
            <select
              className="h-36 w-full rounded-2xl border border-ink/10 px-3 py-2"
              multiple
              value={selectedEmployeeIds}
              onChange={(e) =>
                setSelectedEmployeeIds(
                  Array.from(e.target.selectedOptions).map((option) => option.value)
                )
              }
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-ink/50">
              {selectedEmployeeIds.length} selected
            </p>
          </div>
          <input
            className="rounded-2xl border border-ink/10 px-3 py-2"
            placeholder="Thrust area"
            value={goal.thrustArea}
            onChange={(e) => setGoal((prev) => ({ ...prev, thrustArea: e.target.value }))}
          />
          <input
            className="rounded-2xl border border-ink/10 px-3 py-2"
            placeholder="Goal title"
            value={goal.title}
            onChange={(e) => setGoal((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            className="rounded-2xl border border-ink/10 px-3 py-2"
            placeholder="Description"
            value={goal.description}
            onChange={(e) => setGoal((prev) => ({ ...prev, description: e.target.value }))}
          />
          <select
            className="rounded-2xl border border-ink/10 px-3 py-2"
            value={goal.uom}
            onChange={(e) => setGoal((prev) => ({ ...prev, uom: e.target.value }))}
          >
            {uomOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-ink/10 px-3 py-2"
            value={goal.performance}
            onChange={(e) => setGoal((prev) => ({ ...prev, performance: e.target.value }))}
          >
            {performanceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="rounded-2xl border border-ink/10 px-3 py-2"
            placeholder="Target"
            value={goal.targetValue}
            onChange={(e) => setGoal((prev) => ({ ...prev, targetValue: e.target.value }))}
          />
          <input
            type="number"
            className="rounded-2xl border border-ink/10 px-3 py-2"
            placeholder="Weightage"
            value={goal.weightage}
            onChange={(e) => setGoal((prev) => ({ ...prev, weightage: e.target.value }))}
          />
          <input
            type="date"
            className="rounded-2xl border border-ink/10 px-3 py-2"
            value={goal.deadline}
            onChange={(e) => setGoal((prev) => ({ ...prev, deadline: e.target.value }))}
          />
        </div>
        <button
          className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-haze"
          onClick={pushSharedGoal}
          disabled={selectedEmployeeIds.length === 0}
        >
          Push Shared Goal
        </button>
      </section>

      <section className="card px-6 py-6 space-y-4">
        <div>
          <p className="subtle-label">Unlock Goals</p>
          <h2 className="section-title">Override Lock</h2>
        </div>
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className="flex items-center justify-between rounded-2xl border border-ink/10 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{sheet.employee.name}</p>
                <p className="text-xs text-ink/50">{sheet.status}</p>
              </div>
              <button
                className="rounded-2xl border border-ink/10 px-3 py-1 text-xs"
                onClick={() => unlockSheet(sheet.id)}
              >
                Unlock
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card px-6 py-6 space-y-3">
        <div>
          <p className="subtle-label">Audit Trail</p>
          <h2 className="section-title">Recent Changes</h2>
        </div>
        <div className="space-y-2">
          {audit.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-ink/10 px-4 py-3 text-sm">
              <p>
                <span className="font-semibold">{entry.actor?.name}</span> {entry.action} {entry.entityType}
              </p>
              <p className="text-xs text-ink/50">
                {entry.field ? `${entry.field}: ` : ""}{entry.oldValue || ""} → {entry.newValue || ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card px-6 py-6 space-y-3">
        <div>
          <p className="subtle-label">Reporting</p>
          <h2 className="section-title">Export</h2>
        </div>
        <a
          className="inline-flex w-fit items-center rounded-2xl bg-sea px-4 py-2 text-sm font-semibold text-white"
          href={`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/reports/planned-actual.csv`}
        >
          Download Planned vs Actual CSV
        </a>
      </section>

      <section className="card px-6 py-6 space-y-3">
        <div>
          <p className="subtle-label">Escalations</p>
          <h2 className="section-title">Run Checks</h2>
        </div>
        <button
          className="w-fit rounded-2xl bg-coral px-4 py-2 text-sm font-semibold text-white"
          onClick={runEscalations}
        >
          Run Escalation Rules
        </button>
      </section>
    </Layout>
  );
}
