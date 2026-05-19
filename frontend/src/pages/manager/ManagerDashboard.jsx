import React, { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import { apiRequest } from "../../api/client";

export default function ManagerDashboard() {
  const [sheets, setSheets] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [message, setMessage] = useState("");
  const [teamTrend, setTeamTrend] = useState([]);
  const [averageTrend, setAverageTrend] = useState([]);

  const getCheckinComment = (achievement) => {
    if (!achievement.checkins || achievement.checkins.length === 0) return "";
    return achievement.checkins[0].comment || "";
  };

  const loadSheets = async () => {
    try {
      const [data, trends] = await Promise.all([
        apiRequest("/goalsheets/team"),
        apiRequest("/dashboard/trends"),
      ]);
      setSheets(data.sheets);
      setCycle(data.cycle);
      setTeamTrend(trends.team || []);
      setAverageTrend(trends.average || []);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadSheets();
  }, []);

  const approveSheet = async (sheet) => {
    try {
      await apiRequest(`/goalsheets/${sheet.id}/approve`, {
        method: "PUT",
        body: JSON.stringify({ goals: sheet.goals }),
      });
      setMessage("Approved.");
      await loadSheets();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const returnSheet = async (sheetId) => {
    try {
      await apiRequest(`/goalsheets/${sheetId}/return`, { method: "PUT" });
      setMessage("Returned for rework.");
      await loadSheets();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateGoalField = (sheetId, goalId, field, value) => {
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        return {
          ...sheet,
          goals: sheet.goals.map((goal) =>
            goal.id === goalId ? { ...goal, [field]: value } : goal
          ),
        };
      })
    );
  };

  const saveCheckIn = async (achievementId, comment) => {
    try {
      await apiRequest("/checkins", {
        method: "POST",
        body: JSON.stringify({ achievementId, comment }),
      });
      setMessage("Check-in saved.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <Layout
      title="Manager Control Room"
      subtitle="Approve goals, adjust targets, and leave quarterly check-in notes."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Cycle" value={cycle?.year || "--"} tone="sun" />
        <StatCard label="Team Sheets" value={sheets.length} tone="sea" />
        <StatCard
          label="Awaiting Approval"
          value={sheets.filter((sheet) => sheet.status === "SUBMITTED").length}
          tone="moss"
        />
      </section>
      <section className="card px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="subtle-label">Analytics</p>
            <h2 className="section-title">Team QoQ Trend</h2>
          </div>
          <p className="text-sm text-ink/50">Average score</p>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={averageTrend}>
              <XAxis dataKey="quarter" stroke="#0d1025" />
              <YAxis domain={[0, 100]} stroke="#0d1025" />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2f7f6d" strokeWidth={3} />
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
      {message ? <p className="text-sm text-coral">{message}</p> : null}
      <section className="space-y-6">
        {sheets.map((sheet) => (
          <div key={sheet.id} className="card px-6 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="subtle-label">{sheet.employee.name}</p>
                <h2 className="section-title">{sheet.employee.email}</h2>
                <p className="text-sm text-ink/60">Status: {sheet.status}</p>
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-2xl border border-ink/10 px-4 py-2 text-sm"
                  onClick={() => returnSheet(sheet.id)}
                  disabled={sheet.status !== "SUBMITTED"}
                >
                  Return
                </button>
                <button
                  className="rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-haze"
                  onClick={() => approveSheet(sheet)}
                  disabled={sheet.status !== "SUBMITTED"}
                >
                  Approve
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-ink/50">
                    <th className="py-2">Goal</th>
                    <th>Target</th>
                    <th>Weightage</th>
                    <th>UoM</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.goals.map((goal) => (
                    <tr key={goal.id} className="border-t border-ink/10">
                      <td className="py-3">{goal.title}</td>
                      <td>
                        <input
                          type="number"
                          className="w-24 rounded-xl border border-ink/10 px-2 py-1"
                          value={goal.targetValue}
                          onChange={(e) =>
                            updateGoalField(sheet.id, goal.id, "targetValue", e.target.value)
                          }
                          disabled={sheet.status !== "SUBMITTED"}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="w-16 rounded-xl border border-ink/10 px-2 py-1"
                          value={goal.weightage}
                          onChange={(e) =>
                            updateGoalField(sheet.id, goal.id, "weightage", e.target.value)
                          }
                          disabled={sheet.status !== "SUBMITTED"}
                        />
                      </td>
                      <td>{goal.uom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              {sheet.goals.map((goal) => (
                <div key={goal.id} className="rounded-2xl border border-ink/10 p-4">
                  <p className="text-sm text-ink/50">{goal.title}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    {goal.achievements.map((achievement) => (
                      <div key={achievement.id} className="rounded-2xl border border-ink/10 p-3">
                        <p className="subtle-label">{achievement.quarter}</p>
                        <p className="text-sm text-ink/60">Actual {achievement.actualValue ?? "-"}</p>
                        <textarea
                          className="mt-2 w-full rounded-xl border border-ink/10 px-2 py-1 text-sm"
                          rows={2}
                          placeholder="Check-in comment"
                          defaultValue={getCheckinComment(achievement)}
                          onBlur={(e) => saveCheckIn(achievement.id, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </Layout>
  );
}
