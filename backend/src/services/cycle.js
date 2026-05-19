const { prisma } = require("../utils/prisma");

async function getActiveCycle(year) {
  if (year) {
    return prisma.cycle.findUnique({ where: { year: Number(year) } });
  }
  const now = new Date();
  return prisma.cycle.findFirst({
    where: {
      goalSettingOpenAt: { lte: now },
      q4End: { gte: now },
    },
  });
}

module.exports = { getActiveCycle };
