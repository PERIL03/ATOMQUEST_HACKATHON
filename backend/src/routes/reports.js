const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { getActiveCycle } = require("../services/cycle");

const router = express.Router();

router.get("/planned-actual.csv", requireRole("ADMIN"), async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  const sheets = await prisma.goalSheet.findMany({
    where: { cycleYear: cycle.year },
    include: {
      employee: { include: { manager: true } },
      goals: { include: { achievements: true } },
    },
  });

  const rows = [
    [
      "Employee",
      "Manager",
      "Goal Title",
      "Target",
      "Weightage",
      "Q1 Actual",
      "Q2 Actual",
      "Q3 Actual",
      "Q4 Actual",
    ],
  ];

  for (const sheet of sheets) {
    for (const goal of sheet.goals) {
      const getQuarter = (quarter) =>
        goal.achievements.find((a) => a.quarter === quarter)?.actualValue ?? "";
      rows.push([
        sheet.employee.name,
        sheet.employee.manager?.name || "",
        goal.title,
        goal.targetValue,
        goal.weightage,
        getQuarter("Q1"),
        getQuarter("Q2"),
        getQuarter("Q3"),
        getQuarter("Q4"),
      ]);
    }
  }

  const csv = rows.map((row) => row.map((value) => `"${value ?? ""}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=planned-actual.csv");
  return res.send(csv);
});

module.exports = router;
