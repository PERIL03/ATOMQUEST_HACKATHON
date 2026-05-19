const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { computeScore } = require("../services/scoring");
const { getActiveCycle } = require("../services/cycle");
const { logAudit } = require("../services/audit");

const router = express.Router();

function getQuarterWindow(quarter, cycle) {
  if (!cycle) return null;
  const bounds = {
    Q1: [cycle.q1Start, cycle.q2Start],
    Q2: [cycle.q2Start, cycle.q3Start],
    Q3: [cycle.q3Start, cycle.q4Start],
    Q4: [cycle.q4Start, cycle.q4End],
  };
  return bounds[quarter] || null;
}

router.patch("/:id", requireRole("EMPLOYEE"), async (req, res) => {
  const achievement = await prisma.achievement.findUnique({
    where: { id: req.params.id },
    include: { goal: { include: { goalSheet: true } } },
  });

  if (!achievement || achievement.goal.goalSheet.employeeId !== req.user.id) {
    return res.status(404).json({ message: "Achievement not found." });
  }

  if (achievement.goal.goalSheet.status !== "APPROVED") {
    return res.status(400).json({ message: "Quarterly updates unlock after approval." });
  }

  const { actualValue, status, completionDate } = req.body;
  const cycle = await getActiveCycle(achievement.goal.goalSheet.cycleYear);
  const startDate = cycle?.q1Start || achievement.goal.goalSheet.createdAt;
  const window = getQuarterWindow(achievement.quarter, cycle);
  const now = new Date();
  if (window) {
    const [start, end] = window;
    if (now < start || now > end) {
      return res.status(400).json({ message: "Quarter window is closed." });
    }
  }

  const computedScore = computeScore({
    uom: achievement.goal.uom,
    performance: achievement.goal.performance,
    actualValue: actualValue == null ? achievement.actualValue : Number(actualValue),
    targetValue: achievement.goal.targetValue,
    completionDate: completionDate ? new Date(completionDate) : achievement.completionDate,
    deadline: achievement.goal.deadline,
    startDate,
  });

  const updated = await prisma.achievement.update({
    where: { id: achievement.id },
    data: {
      actualValue: actualValue == null ? achievement.actualValue : Number(actualValue),
      status: status || achievement.status,
      completionDate: completionDate ? new Date(completionDate) : achievement.completionDate,
      computedScore,
    },
  });

  await logAudit({
    actorId: req.user.id,
    entityType: "ACHIEVEMENT",
    entityId: achievement.id,
    action: "UPDATE",
    field: "actualValue",
    oldValue: achievement.actualValue,
    newValue: updated.actualValue,
  });

  // If this achievement is for a shared goal, propagate the updates to all linked goals
  try {
    const goalRecord = await prisma.goal.findUnique({ where: { id: achievement.goalId } });
    if (goalRecord && goalRecord.sharedGoalId) {
      const linkedGoals = await prisma.goal.findMany({ where: { sharedGoalId: goalRecord.sharedGoalId } });
      for (const linked of linkedGoals) {
        if (linked.id === achievement.goalId) continue;
        const existing = await prisma.achievement.findFirst({ where: { goalId: linked.id, quarter: achievement.quarter } });
        const otherComputed = computeScore({
          uom: linked.uom,
          performance: linked.performance,
          actualValue: updated.actualValue,
          targetValue: linked.targetValue,
          completionDate: updated.completionDate,
          deadline: linked.deadline,
          startDate,
        });
        if (existing) {
          await prisma.achievement.update({
            where: { id: existing.id },
            data: {
              actualValue: updated.actualValue,
              status: updated.status,
              completionDate: updated.completionDate,
              computedScore: otherComputed,
            },
          });
        } else {
          await prisma.achievement.create({
            data: {
              goalId: linked.id,
              quarter: updated.quarter,
              actualValue: updated.actualValue,
              status: updated.status,
              completionDate: updated.completionDate,
              computedScore: otherComputed,
            },
          });
        }
      }
    }
  } catch (err) {
    // non-fatal; log and continue
    console.error("Shared-goal sync failed:", err);
  }

  return res.json({ achievement: updated });
});

module.exports = router;
