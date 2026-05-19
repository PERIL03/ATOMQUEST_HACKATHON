const express = require("express");

const { prisma } = require("../utils/prisma");
const { getActiveCycle } = require("../services/cycle");

const router = express.Router();

router.get("/completion", async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  const where = { cycleYear: cycle.year };
  if (req.user.role === "EMPLOYEE") {
    where.employeeId = req.user.id;
  }
  if (req.user.role === "MANAGER") {
    where.employee = { managerId: req.user.id };
  }

  const sheets = await prisma.goalSheet.findMany({
    where,
    include: { goals: { include: { achievements: true } } },
  });

  let totalGoals = 0;
  let completed = 0;
  for (const sheet of sheets) {
    for (const goal of sheet.goals) {
      totalGoals += 1;
      const latest = goal.achievements.find((a) => a.status === "COMPLETED");
      if (latest) completed += 1;
    }
  }

  const completionRate = totalGoals === 0 ? 0 : Math.round((completed / totalGoals) * 100);
  return res.json({ totalGoals, completed, completionRate });
});

function computeTrend(goals) {
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const totals = {
    Q1: { score: 0, weight: 0 },
    Q2: { score: 0, weight: 0 },
    Q3: { score: 0, weight: 0 },
    Q4: { score: 0, weight: 0 },
  };

  for (const goal of goals) {
    for (const achievement of goal.achievements || []) {
      const quarter = achievement.quarter;
      const score = achievement.computedScore ?? 0;
      totals[quarter].score += score * goal.weightage;
      totals[quarter].weight += goal.weightage;
    }
  }

  return quarters.map((quarter) => {
    const total = totals[quarter];
    const value = total.weight === 0 ? 0 : Math.round((total.score / total.weight) * 100);
    return { quarter, score: value };
  });
}

router.get("/trends", async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  if (req.user.role === "EMPLOYEE") {
    const sheet = await prisma.goalSheet.findFirst({
      where: { cycleYear: cycle.year, employeeId: req.user.id },
      include: { goals: { include: { achievements: true } } },
    });
    return res.json({ trend: computeTrend(sheet?.goals || []) });
  }

  const where = { cycleYear: cycle.year };
  if (req.user.role === "MANAGER") {
    where.employee = { managerId: req.user.id };
  }

  const sheets = await prisma.goalSheet.findMany({
    where,
    include: {
      employee: { include: { manager: true } },
      goals: { include: { achievements: true } },
    },
  });

  const team = sheets.map((sheet) => ({
    employeeId: sheet.employee.id,
    name: sheet.employee.name,
    trend: computeTrend(sheet.goals || []),
  }));

  const average = ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
    const scores = team.map((entry) => entry.trend.find((t) => t.quarter === quarter)?.score || 0);
    const value = scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return { quarter, score: value };
  });

  let managerGroups = [];
  if (req.user.role === "ADMIN") {
    const grouped = new Map();
    for (const sheet of sheets) {
      const managerId = sheet.employee.managerId || "unassigned";
      const managerName = sheet.employee.manager?.name || "Unassigned";
      if (!grouped.has(managerId)) {
        grouped.set(managerId, { managerId, managerName, goals: [] });
      }
      grouped.get(managerId).goals.push(...sheet.goals);
    }

    managerGroups = Array.from(grouped.values()).map((group) => ({
      managerId: group.managerId,
      managerName: group.managerName,
      trend: computeTrend(group.goals),
    }));
  }

  return res.json({ team, average, managerGroups });
});

module.exports = router;
