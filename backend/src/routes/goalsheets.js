const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { validateGoals } = require("../services/validation");
const { logAudit } = require("../services/audit");
const { getActiveCycle } = require("../services/cycle");
const { sendEmail } = require("../services/notifications");

const router = express.Router();

router.get("/me", async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  const sheet = await prisma.goalSheet.findFirst({
    where: {
      employeeId: req.user.id,
      cycleYear: cycle.year,
    },
    include: {
      goals: {
        include: {
          achievements: true,
        },
      },
    },
  });

  return res.json({ sheet, cycle });
});

router.get("/team", requireRole("MANAGER"), async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  const sheets = await prisma.goalSheet.findMany({
    where: {
      cycleYear: cycle.year,
      employee: { managerId: req.user.id },
    },
    include: {
      employee: true,
      goals: {
        include: { achievements: { include: { checkins: true } } },
      },
    },
  });

  return res.json({ sheets, cycle });
});

router.get("/all", requireRole("ADMIN"), async (req, res) => {
  const cycle = await getActiveCycle(req.query.cycleYear);
  if (!cycle) {
    return res.status(404).json({ message: "Cycle not found" });
  }

  const sheets = await prisma.goalSheet.findMany({
    where: { cycleYear: cycle.year },
    include: {
      employee: true,
      goals: true,
    },
  });

  return res.json({ sheets, cycle });
});

router.post("/", requireRole("EMPLOYEE"), async (req, res) => {
  const { cycleYear, goals } = req.body;
  const validation = validateGoals(goals);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const sheetYear = Number(cycleYear);
  if (!sheetYear) {
    return res.status(400).json({ message: "cycleYear is required" });
  }

  const existing = await prisma.goalSheet.findFirst({
    where: {
      employeeId: req.user.id,
      cycleYear: sheetYear,
    },
    include: { goals: true },
  });

  if (existing && existing.status === "APPROVED") {
    return res.status(400).json({ message: "Goals are locked." });
  }

  const dataGoals = goals.map((goal) => ({
    thrustArea: goal.thrustArea,
    title: goal.title,
    description: goal.description,
    uom: goal.uom,
    performance: goal.performance || "MIN",
    targetValue: Number(goal.targetValue),
    weightage: Number(goal.weightage),
    deadline: goal.deadline ? new Date(goal.deadline) : null,
    source: goal.source || "EMPLOYEE",
    createdById: req.user.id,
  }));

  const result = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.achievement.deleteMany({
        where: { goalId: { in: existing.goals.map((goal) => goal.id) } },
      });
      await tx.goal.deleteMany({ where: { goalSheetId: existing.id } });

      return tx.goalSheet.update({
        where: { id: existing.id },
        data: {
          status: "DRAFT",
          goals: { create: dataGoals },
        },
        include: { goals: true },
      });
    }

    return tx.goalSheet.create({
      data: {
        employeeId: req.user.id,
        cycleYear: sheetYear,
        status: "DRAFT",
        goals: { create: dataGoals },
      },
      include: { goals: true },
    });
  });

  return res.status(201).json({ sheet: result });
});

router.put("/:id/submit", requireRole("EMPLOYEE"), async (req, res) => {
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: req.params.id },
    include: { goals: true },
  });

  if (!sheet || sheet.employeeId !== req.user.id) {
    return res.status(404).json({ message: "Goal sheet not found." });
  }

  if (!["DRAFT", "RETURNED"].includes(sheet.status)) {
    return res.status(400).json({ message: "Cannot submit in current state." });
  }

  const validation = validateGoals(sheet.goals);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const updated = await prisma.goalSheet.update({
    where: { id: sheet.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  const employee = await prisma.user.findUnique({
    where: { id: sheet.employeeId },
    include: { manager: true },
  });
  await sendEmail({
    to: employee?.manager?.email,
    subject: "Goal sheet submitted for approval",
    text: `${employee?.name} submitted goals for cycle ${sheet.cycleYear}.`,
  });

  return res.json({ sheet: updated });
});

router.put("/:id/approve", requireRole("MANAGER"), async (req, res) => {
  const { goals } = req.body;
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: req.params.id },
    include: { goals: true, employee: true },
  });

  if (!sheet) {
    return res.status(404).json({ message: "Goal sheet not found." });
  }

  if (sheet.employee.managerId !== req.user.id) {
    return res.status(403).json({ message: "Not your report." });
  }

  if (sheet.status !== "SUBMITTED") {
    return res.status(400).json({ message: "Only submitted sheets can be approved." });
  }

  const updatedGoals = sheet.goals.map((goal) => {
    const update = goals?.find((item) => item.id === goal.id);
    if (!update) return goal;
    return {
      ...goal,
      targetValue: update.targetValue == null ? goal.targetValue : Number(update.targetValue),
      weightage: update.weightage == null ? goal.weightage : Number(update.weightage),
    };
  });

  const validation = validateGoals(updatedGoals);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  await prisma.$transaction(async (tx) => {
    for (const goal of updatedGoals) {
      const existing = sheet.goals.find((item) => item.id === goal.id);
      if (!existing) continue;
      if (existing.targetValue !== goal.targetValue) {
        await logAudit({
          client: tx,
          actorId: req.user.id,
          entityType: "GOAL",
          entityId: goal.id,
          action: "UPDATE",
          field: "targetValue",
          oldValue: existing.targetValue,
          newValue: goal.targetValue,
        });
      }
      if (existing.weightage !== goal.weightage) {
        await logAudit({
          client: tx,
          actorId: req.user.id,
          entityType: "GOAL",
          entityId: goal.id,
          action: "UPDATE",
          field: "weightage",
          oldValue: existing.weightage,
          newValue: goal.weightage,
        });
      }
      await tx.goal.update({
        where: { id: goal.id },
        data: {
          targetValue: goal.targetValue,
          weightage: goal.weightage,
        },
      });
    }

    await tx.goalSheet.update({
      where: { id: sheet.id },
      data: { status: "APPROVED", lockedAt: new Date(), approvedAt: new Date() },
    });
  });

  await sendEmail({
    to: sheet.employee.email,
    subject: "Goals approved",
    text: `Your goals for cycle ${sheet.cycleYear} have been approved by your manager.`,
  });

  return res.json({ message: "Approved" });
});

router.put("/:id/return", requireRole("MANAGER"), async (req, res) => {
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: req.params.id },
    include: { employee: true },
  });

  if (!sheet) {
    return res.status(404).json({ message: "Goal sheet not found." });
  }

  if (sheet.employee.managerId !== req.user.id) {
    return res.status(403).json({ message: "Not your report." });
  }

  const updated = await prisma.goalSheet.update({
    where: { id: sheet.id },
    data: { status: "RETURNED", submittedAt: null, approvedAt: null },
  });

  await sendEmail({
    to: sheet.employee.email,
    subject: "Goals returned for rework",
    text: `Your goals for cycle ${sheet.cycleYear} were returned for updates.`,
  });

  return res.json({ sheet: updated });
});

router.put("/:id/unlock", requireRole("ADMIN"), async (req, res) => {
  const sheet = await prisma.goalSheet.findUnique({
    where: { id: req.params.id },
  });

  if (!sheet) {
    return res.status(404).json({ message: "Goal sheet not found." });
  }

  const updated = await prisma.goalSheet.update({
    where: { id: sheet.id },
    data: { status: "DRAFT", lockedAt: null, approvedAt: null },
  });

  await logAudit({
    actorId: req.user.id,
    entityType: "GOAL_SHEET",
    entityId: sheet.id,
    action: "UNLOCK",
  });

  return res.json({ sheet: updated });
});

module.exports = router;
