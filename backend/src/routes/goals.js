const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { validateGoals } = require("../services/validation");

const router = express.Router();

function fallbackSuggestion({ thrustArea, description }) {
  const baseTitle = thrustArea ? `${thrustArea} improvement` : "Performance uplift";
  const hint = description ? description.split(".")[0].trim() : "impactful delivery";
  return {
    title: `${baseTitle}: ${hint}`,
    uom: "PERCENTAGE",
    performance: "MIN",
    targetValue: 15,
  };
}

async function suggestGoalFromLlm({ thrustArea, description }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || typeof fetch !== "function") {
    return fallbackSuggestion({ thrustArea, description });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = `Suggest a concise employee goal. Return JSON with title, uom, performance, targetValue.\nThrust area: ${thrustArea}\nDescription: ${description}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You create SMART employee goals. Reply only with JSON fields: title, uom, performance, targetValue.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return fallbackSuggestion({ thrustArea, description });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return fallbackSuggestion({ thrustArea, description });
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || fallbackSuggestion({ thrustArea, description }).title,
      uom: parsed.uom || "PERCENTAGE",
      performance: parsed.performance || "MIN",
      targetValue: Number(parsed.targetValue || 10),
    };
  } catch (error) {
    return fallbackSuggestion({ thrustArea, description });
  }
}

router.post("/suggest", requireRole("EMPLOYEE"), async (req, res) => {
  const { thrustArea, description } = req.body;
  if (!thrustArea && !description) {
    return res.status(400).json({ message: "Provide thrustArea or description." });
  }

  const suggestion = await suggestGoalFromLlm({
    thrustArea: thrustArea || "",
    description: description || "",
  });

  return res.json({ suggestion });
});

router.patch("/:id", requireRole("EMPLOYEE"), async (req, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: { goalSheet: { include: { goals: true } } },
  });

  if (!goal || goal.goalSheet.employeeId !== req.user.id) {
    return res.status(404).json({ message: "Goal not found." });
  }

  if (goal.goalSheet.status === "APPROVED") {
    return res.status(400).json({ message: "Goals are locked." });
  }

  const updates = req.body;
  const allowedFields = [
    "thrustArea",
    "title",
    "description",
    "uom",
    "performance",
    "targetValue",
    "weightage",
    "deadline",
  ];

  if (goal.source === "ADMIN_SHARED") {
    const hasIllegalChange = Object.keys(updates).some((key) => key !== "weightage");
    if (hasIllegalChange) {
      return res.status(400).json({ message: "Only weightage can be edited for shared goals." });
    }
  }

  const data = {};
  for (const key of allowedFields) {
    if (updates[key] == null) continue;
    if (key === "deadline") {
      data.deadline = updates.deadline ? new Date(updates.deadline) : null;
    } else if (key === "targetValue" || key === "weightage") {
      data[key] = Number(updates[key]);
    } else {
      data[key] = updates[key];
    }
  }

  const projectedGoals = goal.goalSheet.goals.map((item) =>
    item.id === goal.id ? { ...item, ...data } : item
  );

  const validation = validateGoals(projectedGoals);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data,
  });

  return res.json({ goal: updated });
});

router.delete("/:id", requireRole("EMPLOYEE"), async (req, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: { goalSheet: true },
  });

  if (!goal || goal.goalSheet.employeeId !== req.user.id) {
    return res.status(404).json({ message: "Goal not found." });
  }

  if (goal.goalSheet.status === "APPROVED") {
    return res.status(400).json({ message: "Goals are locked." });
  }

  if (goal.source === "ADMIN_SHARED") {
    return res.status(400).json({ message: "Shared goals cannot be deleted." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.achievement.deleteMany({ where: { goalId: goal.id } });
    await tx.goal.delete({ where: { id: goal.id } });
  });

  return res.json({ deleted: true });
});

module.exports = router;
