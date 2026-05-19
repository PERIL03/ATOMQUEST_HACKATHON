const { prisma } = require("../utils/prisma");
const { getActiveCycle } = require("./cycle");
const { logAudit } = require("./audit");
const { sendEmail } = require("./notifications");

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

async function alreadyEscalated(sheetId, action) {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const existing = await prisma.auditLog.findFirst({
    where: {
      entityType: "GOAL_SHEET",
      entityId: sheetId,
      action,
      createdAt: { gte: since },
    },
  });
  return Boolean(existing);
}

async function runEscalations({ actorId } = {}) {
  const cycle = await getActiveCycle();
  if (!cycle) return { run: false, message: "No active cycle" };

  const submitDays = Number(process.env.ESCALATION_DAYS_SUBMIT || 7);
  const approveDays = Number(process.env.ESCALATION_DAYS_APPROVAL || 7);
  const now = new Date();

  const sheets = await prisma.goalSheet.findMany({
    where: { cycleYear: cycle.year },
    include: { employee: { include: { manager: true } } },
  });

  let escalations = 0;

  for (const sheet of sheets) {
    if (sheet.status === "DRAFT" || sheet.status === "RETURNED") {
      const baseDate = sheet.status === "RETURNED" ? sheet.updatedAt : cycle.goalSettingOpenAt;
      const dueDate = addDays(baseDate, submitDays);
      if (now > dueDate) {
        const action = "ESCALATION_SUBMIT";
        if (await alreadyEscalated(sheet.id, action)) continue;

        await sendEmail({
          to: [sheet.employee.email, sheet.employee.manager?.email],
          subject: "Goal sheet submission overdue",
          text: `Goal sheet for ${sheet.employee.name} is overdue for submission in cycle ${sheet.cycleYear}.`,
        });

        await logAudit({
          actorId: actorId || sheet.employee.managerId || sheet.employee.id,
          entityType: "GOAL_SHEET",
          entityId: sheet.id,
          action,
          field: "status",
          oldValue: sheet.status,
          newValue: sheet.status,
        });
        escalations += 1;
      }
    }

    if (sheet.status === "SUBMITTED" && sheet.submittedAt) {
      const dueDate = addDays(sheet.submittedAt, approveDays);
      if (now > dueDate) {
        const action = "ESCALATION_APPROVAL";
        if (await alreadyEscalated(sheet.id, action)) continue;

        const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
        await sendEmail({
          to: [sheet.employee.manager?.email, ...admins.map((admin) => admin.email)],
          subject: "Goal sheet approval overdue",
          text: `Goal sheet for ${sheet.employee.name} is overdue for manager approval in cycle ${sheet.cycleYear}.`,
        });

        await logAudit({
          actorId: actorId || sheet.employee.managerId || sheet.employee.id,
          entityType: "GOAL_SHEET",
          entityId: sheet.id,
          action,
          field: "status",
          oldValue: sheet.status,
          newValue: sheet.status,
        });
        escalations += 1;
      }
    }

    // Check-ins: for approved sheets, if quarter window closed and achievements missing/incomplete, escalate
    if (sheet.status === "APPROVED") {
      const quarters = [
        { key: "Q1", start: cycle.q1Start, end: cycle.q2Start },
        { key: "Q2", start: cycle.q2Start, end: cycle.q3Start },
        { key: "Q3", start: cycle.q3Start, end: cycle.q4Start },
        { key: "Q4", start: cycle.q4Start, end: cycle.q4End },
      ];

      for (const q of quarters) {
        const windowEnd = new Date(q.end);
        if (now <= windowEnd) continue; // window not yet closed

        // find any goal for this sheet where achievement for quarter is missing or incomplete
        const goals = await prisma.goal.findMany({ where: { goalSheetId: sheet.id }, include: { achievements: true } });
        let needs = false;
        for (const goal of goals) {
          const ach = goal.achievements.find((a) => a.quarter === q.key);
          if (!ach || ach.computedScore == null || ach.status === "NOT_STARTED") {
            needs = true;
            break;
          }
        }

        if (needs) {
          const action = "ESCALATION_CHECKIN";
          if (await alreadyEscalated(sheet.id, action)) continue;

          const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
          await sendEmail({
            to: [sheet.employee.manager?.email, sheet.employee.email, ...admins.map((a) => a.email)],
            subject: "Quarterly check-in overdue",
            text: `Quarterly check-in ${q.key} for ${sheet.employee.name} is overdue in cycle ${sheet.cycleYear}.`,
          });

          await logAudit({
            actorId: actorId || sheet.employee.managerId || sheet.employee.id,
            entityType: "GOAL_SHEET",
            entityId: sheet.id,
            action,
            field: "checkin",
            oldValue: null,
            newValue: q.key,
          });
          escalations += 1;
        }
      }
    }
  }

  return { run: true, escalations };
}

module.exports = { runEscalations };
