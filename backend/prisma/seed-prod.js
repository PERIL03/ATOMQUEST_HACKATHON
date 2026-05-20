const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Seed skipped: users already exist.");
    return;
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const scoreMin = (actual, target) => (target === 0 ? 0 : clamp(actual / target, 0, 1));
  const scoreMax = (actual, target) => (actual === 0 ? 0 : clamp(target / actual, 0, 1));
  const scoreZero = (actual) => (actual === 0 ? 1 : 0);

  const password = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Avery Admin",
      email: "admin@atomquest.demo",
      passwordHash: password,
      role: "ADMIN",
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: "Morgan Manager",
      email: "manager@atomquest.demo",
      passwordHash: password,
      role: "MANAGER",
    },
  });

  const alice = await prisma.user.create({
    data: {
      name: "Alice Employee",
      email: "alice@atomquest.demo",
      passwordHash: password,
      role: "EMPLOYEE",
      managerId: manager.id,
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Employee",
      email: "bob@atomquest.demo",
      passwordHash: password,
      role: "EMPLOYEE",
      managerId: manager.id,
    },
  });

  await prisma.cycle.create({
    data: {
      year: 2026,
      goalSettingOpenAt: new Date("2026-05-01T00:00:00Z"),
      q1Start: new Date("2026-05-01T00:00:00Z"),
      q2Start: new Date("2026-08-01T00:00:00Z"),
      q3Start: new Date("2026-11-01T00:00:00Z"),
      q4Start: new Date("2027-02-01T00:00:00Z"),
      q4End: new Date("2027-04-30T23:59:59Z"),
    },
  });

  const sharedReliability = await prisma.sharedGoal.create({
    data: {
      thrustArea: "Ops",
      title: "Admin shared reliability goal",
      description: "Shared focus on incident reduction.",
      uom: "ZERO_BASED",
      performance: "MIN",
      targetValue: 0,
      weightage: 30,
      deadline: new Date("2027-03-31T00:00:00Z"),
      createdById: admin.id,
    },
  });

  const aliceSheet = await prisma.goalSheet.create({
    data: {
      employeeId: alice.id,
      status: "APPROVED",
      submittedAt: new Date("2026-05-05T00:00:00Z"),
      approvedAt: new Date("2026-05-08T00:00:00Z"),
      lockedAt: new Date("2026-05-08T00:00:00Z"),
      cycleYear: 2026,
      goals: {
        create: [
          {
            thrustArea: "Quality",
            title: "Reduce production defects",
            description: "Cut customer-reported issues by improving QA coverage.",
            uom: "PERCENTAGE",
            performance: "MAX",
            targetValue: 3,
            weightage: 35,
            deadline: new Date("2027-03-31T00:00:00Z"),
            source: "EMPLOYEE",
            createdBy: { connect: { id: alice.id } },
          },
          {
            thrustArea: "Delivery",
            title: "Improve release cadence",
            description: "Ship bi-weekly releases with no hotfixes.",
            uom: "NUMERIC",
            performance: "MIN",
            targetValue: 12,
            weightage: 35,
            deadline: new Date("2027-03-31T00:00:00Z"),
            source: "EMPLOYEE",
            createdBy: { connect: { id: alice.id } },
          },
          {
            thrustArea: sharedReliability.thrustArea,
            title: sharedReliability.title,
            description: sharedReliability.description,
            uom: sharedReliability.uom,
            performance: sharedReliability.performance,
            targetValue: sharedReliability.targetValue,
            weightage: sharedReliability.weightage,
            deadline: sharedReliability.deadline,
            source: "ADMIN_SHARED",
            createdBy: { connect: { id: admin.id } },
            sharedGoal: { connect: { id: sharedReliability.id } },
          },
        ],
      },
    },
    include: { goals: true },
  });

  const aliceAchievements = [];
  for (const goal of aliceSheet.goals) {
    const q1Actual = goal.uom === "ZERO_BASED" ? 0 : Math.max(1, goal.targetValue * 0.3);
    const computedScore = (() => {
      if (goal.uom === "ZERO_BASED") return scoreZero(q1Actual);
      if (goal.performance === "MAX") return scoreMax(q1Actual, goal.targetValue);
      return scoreMin(q1Actual, goal.targetValue);
    })();
    const achievement = await prisma.achievement.create({
      data: {
        goalId: goal.id,
        quarter: "Q1",
        actualValue: q1Actual,
        completionDate: new Date("2026-06-15T00:00:00Z"),
        status: "ON_TRACK",
        computedScore,
      },
    });
    aliceAchievements.push(achievement);
  }

  await prisma.goalSheet.create({
    data: {
      employeeId: bob.id,
      status: "SUBMITTED",
      submittedAt: new Date("2026-05-12T00:00:00Z"),
      cycleYear: 2026,
      goals: {
        create: [
          {
            thrustArea: "Customer",
            title: "Improve NPS",
            description: "Lift NPS by closing key feedback loops.",
            uom: "PERCENTAGE",
            performance: "MAX",
            targetValue: 8,
            weightage: 50,
            deadline: new Date("2027-03-31T00:00:00Z"),
            source: "EMPLOYEE",
            createdById: bob.id,
          },
          {
            thrustArea: "Process",
            title: "Reduce onboarding time",
            description: "Cut new hire ramp-up time by two weeks.",
            uom: "NUMERIC",
            performance: "MIN",
            targetValue: 6,
            weightage: 50,
            deadline: new Date("2027-03-31T00:00:00Z"),
            source: "EMPLOYEE",
            createdById: bob.id,
          },
        ],
      },
    },
  });

  const achievementForAudit = aliceAchievements[0];
  await prisma.checkIn.create({
    data: {
      achievementId: achievementForAudit.id,
      managerId: manager.id,
      comment: "Reviewing progress — keep it up.",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: manager.id,
      entityType: "GoalSheet",
      entityId: aliceSheet.id,
      action: "APPROVED",
      field: "status",
      oldValue: "SUBMITTED",
      newValue: "APPROVED",
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
