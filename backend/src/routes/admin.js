const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { logAudit } = require("../services/audit");
const { sendEmail } = require("../services/notifications");
const { runEscalations } = require("../services/escalations");

const router = express.Router();

router.get("/users", requireRole("ADMIN"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return res.json({ users });
});

router.post("/shared-goals", requireRole("ADMIN"), async (req, res) => {
  const { cycleYear, employeeIds, goal } = req.body;
  if (!cycleYear || !Array.isArray(employeeIds) || employeeIds.length === 0 || !goal) {
    return res.status(400).json({ message: "cycleYear, employeeIds, and goal are required." });
  }

  if (Number(goal.weightage) < 10) {
    return res.status(400).json({ message: "Shared goal weightage must be at least 10%." });
  }

  // create a single SharedGoal record and link created goals to it
  const shared = await prisma.sharedGoal.create({
    data: {
      thrustArea: goal.thrustArea || null,
      title: goal.title,
      description: goal.description || null,
      uom: goal.uom || "NUMERIC",
      performance: goal.performance || "MIN",
      targetValue: Number(goal.targetValue),
      weightage: Number(goal.weightage),
      deadline: goal.deadline ? new Date(goal.deadline) : null,
      createdById: req.user.id,
    },
  });

  const results = [];

  for (const employeeId of employeeIds) {
    const employee = await prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee || employee.role !== "EMPLOYEE") {
      results.push({ employeeId, status: "skipped", reason: "Invalid employee" });
      continue;
    }

    const sheet = await prisma.goalSheet.findFirst({
      where: { employeeId, cycleYear: Number(cycleYear) },
    });

    if (sheet && sheet.status === "APPROVED") {
      results.push({ employeeId, status: "skipped", reason: "Goals locked" });
      continue;
    }

    const targetSheet = sheet
      ? sheet
      : await prisma.goalSheet.create({
          data: {
            employeeId,
            cycleYear: Number(cycleYear),
            status: "DRAFT",
          },
        });

    const createdGoal = await prisma.goal.create({
      data: {
        goalSheetId: targetSheet.id,
        thrustArea: goal.thrustArea,
        title: goal.title,
        description: goal.description,
        uom: goal.uom,
        performance: goal.performance || "MIN",
        targetValue: Number(goal.targetValue),
        weightage: Number(goal.weightage),
        deadline: goal.deadline ? new Date(goal.deadline) : null,
        source: "ADMIN_SHARED",
        createdById: req.user.id,
        sharedGoalId: shared.id,
      },
    });

    await logAudit({
      actorId: req.user.id,
      entityType: "GOAL",
      entityId: createdGoal.id,
      action: "ADMIN_PUSH",
      newValue: goal.title,
    });

    await sendEmail({
      to: employee.email,
      subject: "New shared goal added",
      text: `A shared goal ("${goal.title}") was added to your goal sheet for cycle ${cycleYear}.`,
    });

    results.push({ employeeId, status: "created" });
  }

  return res.json({ results });
});

router.get("/audit", requireRole("ADMIN"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });

  return res.json({ logs });
});

router.post("/escalations/run", requireRole("ADMIN"), async (req, res) => {
  const result = await runEscalations({ actorId: req.user.id });
  return res.json(result);
});

module.exports = router;
