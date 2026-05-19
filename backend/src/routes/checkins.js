const express = require("express");

const { prisma } = require("../utils/prisma");
const { requireRole } = require("../middleware/roles");
const { sendEmail } = require("../services/notifications");

const router = express.Router();

router.post("/", requireRole("MANAGER"), async (req, res) => {
  const { achievementId, comment } = req.body;
  if (!achievementId || !comment) {
    return res.status(400).json({ message: "achievementId and comment required." });
  }

  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
    include: { goal: { include: { goalSheet: { include: { employee: true } } } } },
  });

  if (!achievement) {
    return res.status(404).json({ message: "Achievement not found." });
  }

  if (achievement.goal.goalSheet.employee.managerId !== req.user.id) {
    return res.status(403).json({ message: "Not your report." });
  }

  const existing = await prisma.checkIn.findFirst({
    where: { achievementId, managerId: req.user.id },
  });

  const checkin = existing
    ? await prisma.checkIn.update({
        where: { id: existing.id },
        data: { comment },
      })
    : await prisma.checkIn.create({
        data: { achievementId, managerId: req.user.id, comment },
      });

  const employeeEmail = achievement.goal.goalSheet.employee.email;
  await sendEmail({
    to: employeeEmail,
    subject: "Manager check-in added",
    text: `Your manager left a check-in comment for ${achievement.goal.title} (${achievement.quarter}).`,
  });

  return res.json({ checkin });
});

module.exports = router;
